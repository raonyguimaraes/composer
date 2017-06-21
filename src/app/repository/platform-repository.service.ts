import {Injectable} from "@angular/core";
import {Observable} from "rxjs/Observable";
import {ReplaySubject} from "rxjs/ReplaySubject";
import {App} from "../../../electron/src/sbg-api-client/interfaces/app";
import {Project} from "../../../electron/src/sbg-api-client/interfaces/project";
import {AuthService} from "../auth/auth.service";
import {DataGatewayService} from "../core/data-gateway/data-gateway.service";
import {IpcService} from "../services/ipc.service";

@Injectable()
export class PlatformRepositoryService {

    private projects = new ReplaySubject<Project[]>(1);

    private openProjects = new ReplaySubject<string[]>(1);

    private expandedNodes = new ReplaySubject<string[]>(1);

    apps = new ReplaySubject<App[]>(1);

    constructor(private auth: AuthService,
                private dataGateway: DataGatewayService,
                private ipc: IpcService) {

        this.auth.active.switchMap(active => {
            if (!active) {
                return Observable.of([]);
            }

            const {url, token} = active;
            return this.dataGateway.getProjects(url, token);
        }).subscribe(data => {
            this.projects.next(data);
        }, err => {
            console.log("Error in repository projects", err);
        });


        this.auth.active.switchMap(active => {
            if (!active) {
                return Observable.of([]);
            }

            const {url, token} = active;
            return this.dataGateway.getApps(url, token);
        }).subscribe(data => {
            this.apps.next(data)
        }, err => {
            console.log("Err in repository apps", err);
        });

        this.listen("openProjects").subscribe(list => {
            this.openProjects.next(list);
        });

        this.listen("apps").subscribe(list => {
            this.apps.next(list);
        });

        this.listen("expandedNodes").subscribe(list => {
            this.expandedNodes.next(list);
        })

    }

    getAppsForProject(projectID) {
        return this.apps
            .map(apps => apps.filter(app => app.project === projectID));
    }

    getProjects() {
        return this.projects;
    }

    fetch() {
        return this.ipc.request("fetchPlatformData");
    }

    getOpenProjects() {
        return Observable
            .combineLatest(this.projects, this.openProjects)
            .map(data => {
                const [all, open] = data;
                if (open.length === 0) return [];

                const mapped = all.reduce((acc, item) => ({...acc, [item.id]: item}), {});
                return open.map(id => mapped[id] || undefined).filter(v => v);
            })
    }

    private listen(key: string) {
        return this.ipc.watch("watchUserRepository", {key});
    }

    private patch(data: { [key: string]: any }) {
        return this.ipc.request("patchUserRepository", data);
    }

    setNodeExpansion(id: string, isExpanded: boolean): void {
        this.expandedNodes.take(1)
            .subscribe(expandedNodes => {
                const index = expandedNodes.indexOf(id);

                const shouldBeAdded   = isExpanded && index === -1;
                const shouldBeRemoved = !isExpanded && index !== -1;

                const patch = expandedNodes.slice();

                if (shouldBeAdded) {
                    patch.push(id);
                } else if (shouldBeRemoved) {
                    patch.splice(index, 1);
                }

                if (shouldBeAdded || shouldBeRemoved) {
                    this.patch({
                        expandedNodes: patch
                    });
                }
            });
    }

    addOpenProjects(...projectIDs: string[]) {
        return this.openProjects.take(1).toPromise().then(openProjects => {

            const missing = projectIDs.filter(id => openProjects.indexOf(id) === -1);

            if (missing.length) {
                return this.patch({openProjects: openProjects.concat(missing)}).toPromise();
            }

            return Promise.resolve();
        });
    }

    removeOpenProjects(...projectIDs: string[]) {
        return this.openProjects.take(1).toPromise().then(openProjects => {

            const update = openProjects.filter(id => projectIDs.indexOf(id) === -1);

            if (update.length !== openProjects.length) {
                return this.patch({openProjects: update}).toPromise();
            }

            return Promise.resolve();
        });
    }

    getExpandedNodes() {
        return this.expandedNodes;
    }

    createApp(appID: string, content: string): Promise<string> {
        const nulledRevision = appID.split("/").slice(0, 3).concat("0").join("/");

        return this.ipc.request("createPlatformApp", {
            id: nulledRevision,
            content: content
        }).toPromise();
    }
}
