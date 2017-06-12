import {Injectable} from "@angular/core";
import "rxjs/add/observable/of";
import "rxjs/add/operator/map";
import "rxjs/add/operator/take";
import {Observable} from "rxjs/Observable";
import {ReplaySubject} from "rxjs/ReplaySubject";
import {Subject} from "rxjs/Subject";
import {AuthCredentials, UserPlatformIdentifier} from "../../auth/model/auth-credentials";
import {IpcService} from "../ipc.service";
import {UserProfileCacheKey} from "./user-profile-cache-key";

@Injectable()
export class UserPreferencesService {

    private updates = new Subject<{
        key: string;
        value: any;
        profile: "local" | string
    }>();

    local = new ReplaySubject<Object>(1);

    profile = new ReplaySubject<Object>(1);


    constructor(private ipc: IpcService) {

        // this.updates.subscribe(update => {
        //     const patch = {
        //         profile: update.profile,
        //         data: {
        //             [update.key]: update.value
        //         }
        //     };
        //     this.ipc.request("patchPreferences", patch)
        // });
        //
        // this.ipc.request("getPreferences").subscribe(prefs => {
        //     console.log("Got preferences from server", prefs);
        //     this.local.next(prefs);
        // });
    }

    public put<T>(key: UserProfileCacheKey, value: T, profile = "local"): Observable<T> {

        this.updates.next({key, value, profile});

        return Observable.of(value);
    }

    public get<T>(key: UserProfileCacheKey, fallback?: T, profile = "local"): Observable<T> {

        const dataStream = profile === "local" ? this.local : this.profile;

        const val = dataStream.map(data => {
            if ([undefined, null, "undefined", "null"].indexOf(data[key]) !== -1) {
                return fallback;
            }

            return data[key];
        });

        return val.merge(this.updates.filter(u => u.key === key).map(u => u.value)).distinctUntilChanged();
    }

    getCredentials(): Observable<AuthCredentials[]> {
        return this.get("credentials", []).map(list => list.map(item => AuthCredentials.from(item)));
    }

    setCredentials(credentials) {
        return this.put("credentials", credentials || []);
    }

    getOpenProjects() {
        return this.get("openProjects", []);
    }

    setOpenProjects(projects = []) {
        return this.put("openProjects", projects);
    }


    /**
     * @deprecated This doesn't use multiple sources, split it into multiple profile services
     */
    getExpandedNodes() {
        return this.get("expandedNodes", []);
    }

    getSidebarHidden() {
        return Observable.of(false);
        // return this.ipc.watch("watchLocalProfile", {key: "sidebarHidden"});
    }

    setSidebarHidden(hidden: boolean) {
        return this.ipc.request("patchLocalRepository", {
            sidebarHidden: hidden
        });
    }

    setActiveUser(user: any) {

        return this.put("activeUser", user || "");
    }

    getActiveUser(): Observable<AuthCredentials> {
        return this.get("activeUser").map((data?: UserPlatformIdentifier) => {
            if (!data) return;

            return AuthCredentials.from(data);
        });
    }


    addLocalFolders(paths: string[]) {
        this.getOpenFolders()
            .take(1)
            .map(folders => {
                return (folders || []).concat(paths).filter((v, i, a) => a.indexOf(v) === i);
            })
            .subscribe(folders => {
                console.log("Pushing new localFolders list", folders);
                this.put("localFolders", folders, "local");
            });
    }

    getOpenFolders() {
        return this.get("localFolders", [], "local");
    }
}
