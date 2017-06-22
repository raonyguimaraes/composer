import {Injectable} from "@angular/core";
import {Observable} from "rxjs/Observable";
import {ReplaySubject} from "rxjs/ReplaySubject";
import {App} from "../../../electron/src/sbg-api-client/interfaces/app";
import {Project} from "../../../electron/src/sbg-api-client/interfaces/project";
import {IpcService} from "../services/ipc.service";

@Injectable()
export class PlatformRepositoryService {

    private projects = new ReplaySubject<Project[]>(1);

    private openProjects = new ReplaySubject<string[]>(1);

    private expandedNodes = new ReplaySubject<string[]>(1);

    apps = new ReplaySubject<App[]>(1);

    private publicApps = new ReplaySubject<App[]>(1);

    constructor(private ipc: IpcService) {

        this.listen("projects").subscribe(list => this.projects.next(list));

        this.listen("openProjects").subscribe(list => this.openProjects.next(list));

        this.listen("apps").subscribe(list => this.apps.next(list));

        this.listen("expandedNodes").subscribe(list => this.expandedNodes.next(list));

        this.listen("publicApps").subscribe(list => this.publicApps.next(list));

    }

    getAppsForProject(projectID): Observable<App[]> {
        return this.apps.map(apps => apps.filter(app => app.project === projectID));
    }

    getProjects(): Observable<Project[]> {
        return this.projects;
    }

    getPublicApps(): Observable<App[]> {
        return this.publicApps;
    }

    fetch(): Observable<any> {
        return this.ipc.request("fetchPlatformData");
    }

    getOpenProjects(): Observable<Project[]> {
        return Observable
            .combineLatest(this.projects, this.openProjects)
            .map(data => {
                const [all, open] = data;
                if (open.length === 0) return [];

                const mapped = all.reduce((acc, item) => ({...acc, [item.id]: item}), {});
                return open.map(id => mapped[id] || undefined).filter(v => v);
            })
    }

    getClosedProjects(): Observable<Project[]> {
        return Observable.combineLatest(this.projects, this.openProjects)
            .map(data => {
                const [all, open] = data;

                if (open.length === 0) return all;

                return all.filter(p => open.indexOf(p.id) === -1);
            });
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
