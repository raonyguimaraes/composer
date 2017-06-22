import {Injectable} from "@angular/core";
import {BehaviorSubject} from "rxjs/BehaviorSubject";
import {Observable} from "rxjs/Observable";
import {ReplaySubject} from "rxjs/ReplaySubject";
import {AuthCredentials} from "../auth/model/auth-credentials";
import {IpcService} from "../services/ipc.service";

@Injectable()
export class LocalRepositoryService {

    private localFolders      = new ReplaySubject<string[]>(1);
    private expandedFolders   = new ReplaySubject<string[]>(1);
    private credentials       = new BehaviorSubject<AuthCredentials[]>([]);
    private activeCredentials = new BehaviorSubject<AuthCredentials>(undefined);

    constructor(private ipc: IpcService) {

        this.listen("credentials")
            .map(creds => creds.map(c => AuthCredentials.from(c)))
            .subscribe(this.credentials);

        this.listen("activeCredentials")
            .map(cred => AuthCredentials.from(cred))
            .subscribe(this.activeCredentials);

        this.listen("localFolders").subscribe(this.localFolders);

        this.listen("expandedNodes").subscribe(this.expandedFolders);

    }

    getLocalFolders(): Observable<string[]> {
        return this.localFolders;
    }

    getExpandedFolders(): Observable<string[]> {
        return this.expandedFolders;
    }

    getCredentials(): Observable<AuthCredentials[]> {
        return this.credentials;
    }

    getActiveCredentials(): Observable<AuthCredentials> {
        return this.activeCredentials;
    }

    setActiveCredentials(credentials: AuthCredentials = null): Observable<any> {
        return this.ipc.request("patchLocalRepository", {
            activeCredentials: credentials
        });
    }

    setCredentials(credentials: AuthCredentials[]): Observable<any> {

        const activeCredentials    = this.activeCredentials.getValue();
        const updateContainsActive = credentials.findIndex(c => c.equals(activeCredentials)) !== -1;

        const update = {credentials} as { credentials: AuthCredentials[], activeCredentials?: AuthCredentials };

        if (!updateContainsActive) {
            update.activeCredentials = null;
        }

        return this.ipc.request("patchLocalRepository", update);
    }

    setFolderExpansion(nodeID: string, expanded: boolean): void {
        this.expandedFolders.take(1)
            .subscribe(expandedFolders => {
                const index = expandedFolders.indexOf(nodeID);

                const shouldBeAdded   = expanded && index === -1;
                const shouldBeRemoved = !expanded && index !== -1;

                const patch = expandedFolders.slice();

                if (shouldBeAdded) {
                    patch.push(nodeID);
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

    private listen(key: string) {
        return this.ipc.watch("watchLocalRepository", {key});
    }

    private patch(data: { [key: string]: any }): Observable<any> {
        return this.ipc.request("patchLocalRepository", data);
    }

    addLocalFolders(...folders): Promise<any> {
        return this.getLocalFolders().take(1).toPromise().then(existingFolders => {
            const missing = folders.filter(folder => existingFolders.indexOf(folder) === -1);

            if (missing.length === 0) {
                return Promise.resolve();
            }

            return this.patch({
                localFolders: existingFolders.concat(missing)
            }).toPromise();
        });
    }

    removeLocalFolders(...folders): Promise<any> {
        return this.getLocalFolders().take(1).toPromise().then(existing => {
            const update = existing.filter(path => folders.indexOf(path) === -1);

            if (update.length === existing.length) {
                return Promise.resolve();
            }

            return this.patch({
                localFolders: update
            }).toPromise();
        });
    }
}
