import {Injectable} from "@angular/core";
import {FormControl} from "@angular/forms";
import * as YAML from "js-yaml";
import "rxjs/add/observable/empty";
import "rxjs/add/observable/fromPromise";
import "rxjs/add/observable/merge";
import "rxjs/add/observable/throw";
import "rxjs/add/observable/zip";
import "rxjs/add/operator/catch";

import "rxjs/add/operator/mergeMap";
import {Observable} from "rxjs/Observable";
import {Subject} from "rxjs/Subject";
import {PlatformAPIGatewayService} from "../../auth/api/platform-api-gateway.service";
import {noop} from "../../lib/utils.lib";
import {IpcService} from "../../services/ipc.service";
import {ModalService} from "../../ui/modal/modal.service";

@Injectable()
export class DataGatewayService {

    cacheInvalidation = new Subject<string>();

    static getFileSource(id): "local" | "public" | "app" {
        if (id.startsWith("/")) {
            return "local";
        }

        if (id.startsWith("https://") || id.startsWith("http://")) {
            return "public";
        }

        return "app";
    }


    constructor(private modal: ModalService,
                private apiGateway: PlatformAPIGatewayService,
                private ipc: IpcService) {
    }

    checkIfPathExists(path) {
        return this.ipc.request("pathExists", path);
    }

    createLocalFolder(folderPath) {
        return this.ipc.request("createDirectory", folderPath);
    }

    invalidateFolderListing(folder) {
        this.cacheInvalidation.next(`readDirectory.${folder}`);
    }

    searchLocalProjects(term, limit = 20): Promise<{
        type: "Workflow" | "CommandLineTool" | string;
        path: string;
        name: string;
        isReadable: boolean;
        isWritable: boolean;
        isDir: boolean;
        isFile: boolean;
        dirname: string;
        language: "cwl" | "json" | "yaml" | string;
        relevance: number;
    }[]> {

        return this.ipc.request("searchLocalProjects", {term, limit,}).toPromise();
    }

    fetchFileContent(almostID: string, parse = false): Observable<string> {

        const source = DataGatewayService.getFileSource(almostID);

        if (source === "local") {

            const fetch = Observable.empty().concat(this.ipc.request("getLocalFileContent", almostID)) as Observable<string>;

            if (parse) {
                return fetch
                    .map(content => {
                        try {
                            return YAML.safeLoad(content, {json: true, onWarning: noop} as any);
                        } catch (err) {
                            return new Error(err);
                        }
                    });
            }

            return fetch;
        }

        if (source === "app" || source === "public") {

            const fetch = Observable.empty().concat(this.ipc.request("getPlatformApp", {
                id: almostID
            }));

            if (parse) {
                return fetch.map(content => JSON.parse(content));
            }
            return fetch;
        }
    }

    resolveContent(content, path): Observable<Object | any> {

        if (!path.startsWith("/")) {
            return Observable.of(content).map(txt => YAML.safeLoad(txt, {json: true} as any));
        }

        return this.ipc.request("resolveContent", ({content, path})).take(1);
    }


    saveLocalFileContent(path, content) {
        return this.ipc.request("saveFileContent", {path, content});
    }

    saveFile(fileID, content): Observable<string> {
        const fileSource = DataGatewayService.getFileSource(fileID);

        if (fileSource === "public") {
            return Observable.throw("Cannot save a public file.");
        }

        if (fileSource === "local") {
            return this.saveLocalFileContent(fileID, content).map(() => content);
        }

        const [hash] = fileID.split("/");

        const revNote = new FormControl("");
        return Observable.fromPromise(this.modal.prompt({
            title: "Publish New App Revision",
            content: "Revision Note",
            cancellationLabel: "Cancel",
            confirmationLabel: "Publish",
            formControl: revNote
        })).catch(() => {
            // In case when you click on Cancel button or Esc button on your keyboard
            return Observable.empty()
        }).flatMap(() => {
            const platform = this.apiGateway.forHash(hash);

            const call = platform ? platform.saveApp(YAML.safeLoad(content, {json: true} as any), revNote.value)
                : Observable.throw(
                    new Error("Could not save the app because you are not connected to the necessary platform."));

            return call.map(r => JSON.stringify(r.message, null, 4));

        });
    }

    /**
     *
     * @param url
     * @param token
     */
    getUserWithToken(url, token): Observable<any> {
        return this.ipc.request("getUserByToken", {url, token});
    }

    updateSwap(fileID, content): Observable<any> {
        const isLocal = fileID.startsWith("/");

        let swapID = fileID;
        if (!isLocal) {
            swapID = fileID.split("/").slice(0, 3).join("/");
        }

        return this.ipc.request("patchSwap", {
            local: isLocal,
            swapID: swapID,
            swapContent: content
        });
    }

    sendFeedbackToPlatform(type: string, text: string): Promise<any> {
        return this.ipc.request("sendFeedback", {type, text}).toPromise();
    }


}
