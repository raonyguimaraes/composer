import {Injectable} from "@angular/core";
import {IpcService} from "../services/ipc.service";
import {Observable} from "rxjs/Observable";
import {AuthCredentials} from "../auth/model/auth-credentials";

@Injectable()
export class LocalProfileService {

    constructor(private ipc: IpcService) {

    }

    getWorkspaceFolders() {

    }

    getExpandedNodes(): Observable<string[]> {
        return Observable.of([]);
    }

    getCredentials(): Observable<AuthCredentials[]> {
        return this.ipc.request("getLocalRepository", {
            key: "credentials"
        }).map(data => data.map(entry => AuthCredentials.from(entry)));
    }

    getActiveUser(): Observable<AuthCredentials> {
        return this.ipc.request("getLocalRepository", {
            key: "activeCredentials"
        }).map(entry => entry && AuthCredentials.from(entry));
    }

    setCredentials(credentials: AuthCredentials[] = []) {
        return this.ipc.request("patchLocalRepository", {credentials});
    }

    setActiveUser(credentials?: AuthCredentials) {
        return this.ipc.request("patchLocalRepository", {activeCredentials: credentials || null});
    }
}
