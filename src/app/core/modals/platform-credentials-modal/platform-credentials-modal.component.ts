import {Component, OnInit} from "@angular/core";
import {FormGroup} from "@angular/forms";
import {ModalService} from "../../../ui/modal/modal.service";

@Component({
    selector: "ct-platform-credentials-modal",
    template: `
        <ct-credentials-form [form]="form"></ct-credentials-form>
        <div class="modal-footer">
            <button class="btn btn-secondary" (click)="modal.close()">Cancel</button>
            <button class="btn btn-primary" [disabled]="form.invalid">Apply</button>
        </div>
    `,
    styleUrls: ["./platform-credentials-modal.component.scss"],
})
export class PlatformCredentialsModalComponent implements OnInit
{

    form = new FormGroup({});

    constructor(public modal: ModalService) {
    }

    ngOnInit() {
    }

}
