import {ChangeDetectionStrategy, Component, Input} from "@angular/core";

@Component({
    selector: "ct-loader-button-content",
    changeDetection: ChangeDetectionStrategy.OnPush,
    styleUrls: ["loader-button-content.component.scss"],
    template: `
        <ng-content *ngIf="!isLoading"></ng-content>
        <span class="loader" *ngIf="isLoading"></span>
    `
})

export class LoaderButtonContentComponent {

    @Input() isLoading = false;

}
