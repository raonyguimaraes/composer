import {Injectable} from "@angular/core";
import {FormControl} from "@angular/forms";
import {IpcService} from "../../../services/ipc.service";
import {ModalService} from "../../../ui/modal/modal.service";
import {AppSaver} from "./app-saver.interface";

@Injectable()
export class PlatformAppSavingService implements AppSaver {

    constructor(private ipc: IpcService,
                private modal: ModalService) {
    }

    save(appID: string, content: string) {

        return new Promise((resolve, reject) => {

            const revisionNoteControl = new FormControl("");

            this.modal.prompt({
                title: "Publish New App Revision",
                content: "Revision Note:",
                cancellationLabel: "Cancel",
                confirmationLabel: "Publish",
                formControl: revisionNoteControl
            }).then(() => {

                const appContent                = JSON.parse(content);
                appContent["sbg:revisionNotes"] = revisionNoteControl.value;
                const serialized                = JSON.stringify(appContent);

                this.ipc.request("saveAppRevision", {
                    id: appID,
                    content: serialized
                }).toPromise().then(resolve, reject);
            }, reject);
        });
    };
}
