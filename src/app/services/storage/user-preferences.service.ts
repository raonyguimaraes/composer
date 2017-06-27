import {Injectable} from "@angular/core";
import "rxjs/add/observable/of";
import "rxjs/add/operator/map";
import "rxjs/add/operator/take";
import {Observable} from "rxjs/Observable";
import {ReplaySubject} from "rxjs/ReplaySubject";
import {Subject} from "rxjs/Subject";
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


    getSidebarHidden() {
        return Observable.of(false);
        // return this.ipc.watch("watchLocalProfile", {key: "sidebarHidden"});
    }

    setSidebarHidden(hidden: boolean) {
        return this.ipc.request("patchLocalRepository", {
            sidebarHidden: hidden
        });
    }

}
