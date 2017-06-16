import {Injectable} from "@angular/core";
import "rxjs/add/observable/combineLatest";
import "rxjs/add/operator/debounceTime";
import "rxjs/add/operator/distinctUntilChanged";
import "rxjs/add/operator/filter";
import "rxjs/add/operator/map";
import {Observable} from "rxjs/Observable";
import {ReplaySubject} from "rxjs/ReplaySubject";
import {IpcService} from "../../services/ipc.service";


@Injectable()
export class CodeContentService {

    originalCodeContent = new ReplaySubject<string>(1);
    codeContent         = new ReplaySubject<string>(1);

    appID: string;

    constructor(private ipc: IpcService) {

        this.codeContent.debounceTime(500)
            .filter(() => this.appID !== undefined)
            .subscribe(content => {
                this.patchSwap(content);
            });
    }

    getOriginalCodeContent(): Observable<string> {
        return this.originalCodeContent.asObservable();
    }

    getCodeContent(): Observable<string> {
        return this.codeContent.asObservable();
    }

    isContentChanged(): Observable<boolean> {
        return Observable.combineLatest(this.originalCodeContent, this.codeContent)
            .map(pair => pair[0] === pair[1])
            .distinctUntilChanged();
    }

    discardSwapContent() {
        this.patchSwap(null);
    }

    private patchSwap(content): void {
        this.ipc.request("patchSwap", {
            local: this.appID.startsWith("/"),
            swapID: this.appID,
            swapContent: content
        });
    }
}
