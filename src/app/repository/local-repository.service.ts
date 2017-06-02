import {Injectable} from "@angular/core";
import {BehaviorSubject} from "rxjs/BehaviorSubject";
import {Observable} from "rxjs/Observable";
import {AuthCredentials} from "../auth/model/auth-credentials";
import {IpcService} from "../services/ipc.service";

@Injectable()
export class LocalRepositoryService {

    private localFolders      = new BehaviorSubject<string[]>([]);
    private credentials       = new BehaviorSubject<AuthCredentials[]>([]);
    private activeCredentials = new BehaviorSubject<AuthCredentials>(undefined);

    constructor(private ipc: IpcService) {

    }

    getLocalFolders(): Observable<string[]> {
        return this.listen("localFolders");
    }

    getExpandedFolders(): Observable<string[]> {
        return this.listen("expandedNodes");
    }

    getCredentials(): Observable<AuthCredentials[]> {

        return this.listen("credentials").map(creds => creds.map(c => AuthCredentials.from(c)));

    }

    getActiveCredentials(): Observable<AuthCredentials> {
        return this.listen("activeCredentials").map(cred => AuthCredentials.from(cred));
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

    private listen(key: string) {
        return this.ipc.watch("watchLocalRepository", {key});
    }


}
