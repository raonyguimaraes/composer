import {Injectable} from "@angular/core";
import {FormControl} from "@angular/forms";
import {IpcService} from "../../../services/ipc.service";
import {ModalService} from "../../../ui/modal/modal.service";
import {AppSaver} from "./app-saver.interface";

/**
 * @deprecated use {@link PlatformRepositoryService.createApp)
 */
@Injectable()
export class PlatformAppSavingService implements AppSaver {

    constructor(private ipc: IpcService,
                private modal: ModalService) {
    }

    save(appID: string, content: string, revisionNote?: string): Promise<any> {

        if (revisionNote !== undefined) {
            return this.saveWithNote(appID, content, revisionNote);
        }

        return new Promise((resolve, reject) => {

            const revisionNoteControl = new FormControl("");

            this.modal.prompt({
                title: "Publish New App Revision",
                content: "Revision Note:",
                cancellationLabel: "Cancel",
                confirmationLabel: "Publish",
                formControl: revisionNoteControl
            }).then(() => this.saveWithNote(appID, content, revisionNoteControl.value), reject);
        }) as Promise<string>;
    };

    private saveWithNote(appID: string, content: string, revisionNote: string): Promise<any> {
        const appContent                = JSON.parse(content);
        appContent["sbg:revisionNotes"] = revisionNote;
        const serialized                = JSON.stringify(appContent);

        return this.ipc.request("createPlatformApp", {
            id: appID,
            content: serialized
        }).toPromise();
    }
}
