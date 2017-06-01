import {Injectable} from "@angular/core";
import {IpcService} from "../services/ipc.service";
import {Observable} from "rxjs/Observable";

@Injectable()
export class PlatformUserProfileService {

    constructor(private ipc: IpcService) {

    }

    getExpandedNodes(): Observable<string[]> {
        return Observable.of([]);
        // return this.ipc.watch("watchLocalProfile", {
        //     key: "expandedNodes"
        // });
    }
}
