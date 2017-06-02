import {Component} from "@angular/core";
import {Observable} from "rxjs/Observable";
import {AuthService} from "../../../auth/auth.service";
import {UserPreferencesService} from "../../../services/storage/user-preferences.service";
import {ModalService} from "../../../ui/modal/modal.service";
import {DirectiveBase} from "../../../util/directive-base/directive-base";
import {DataGatewayService} from "../../data-gateway/data-gateway.service";
import {Project} from "../../../../../electron/src/sbg-api-client/interfaces/project";
import {PlatformRepositoryService} from "../../../repository/platform-repository.service";

const {app, dialog} = window["require"]("electron").remote;

@Component({
    selector: "ct-add-source-modal",
    styleUrls: ["./add-source-modal.component.scss"],
    template: `
        <div class="header">
            <ct-tab-selector [distribute]="'auto'" [(active)]="activeTab">
                <ct-tab-selector-entry tabName="local">Local</ct-tab-selector-entry>
                <ct-tab-selector-entry tabName="platform">Platform</ct-tab-selector-entry>
            </ct-tab-selector>
        </div>

        <div class="body">

            <!--If we are on the local tab, we just need a button to choose a folder and that's it-->
            <div *ngIf="activeTab === 'local'" class="dialog-centered dialog-content">
                <p>Add one or more folders from your computer to the workspace.</p>
                <p>
                    <button class="btn btn-secondary" (click)="selectLocalFolders()">Select a Folder...</button>
                </p>
            </div>

            <!--If we want to add a platform projects, we may have multiple steps-->
            <ng-container *ngIf="activeTab === 'platform'">

                <!--If we have an active connection we should show the choice of projects to add-->
                <div class="dialog-content dialog-connection" *ngIf="auth.active | async; else noActiveConnection">

                    <!--Projects are loaded-->
                    <ng-container *ngIf="allProjects !== undefined; else projectsNotLoadedYet">

                        <!--Offer projects so users can choose which to add-->
                        <div *ngIf="nonAddedUserProjects.length > 0; else allProjectsAreAdded">
                            <p>Choose projects to add to the workspace:</p>
                            <div>
                                <ct-auto-complete [(ngModel)]="selectedProjects" [options]="nonAddedUserProjects"></ct-auto-complete>
                            </div>
                        </div>

                    </ng-container>


                </div>
            </ng-container>

            <ng-template #noActiveConnection>

                <div *ngIf="(auth.credentials | async).length === 0; else platformActivation" class="dialog-content dialog-centered">
                    User has no platforms listed
                </div>

            </ng-template>

            <ng-template #platformActivation>
                <div class="dialog-content dialog-centered">
                    User has platforms listed but no connected ones.
                </div>
            </ng-template>

            <ng-template #projectsNotLoadedYet>
                Loading projects...
            </ng-template>

            <ng-template #allProjectsAreAdded>
                All your projects are added to the workspace.
            </ng-template>

            <div class="modal-footer">
                <button type="button" class="btn btn-secondary" (click)="modal.close()">Cancel</button>
                <button type="button" class="btn btn-primary" [disabled]="selectedProjects.length === 0" (click)="onDone()">Done</button>
            </div>
        </div>
    `,
})
export class AddSourceModalComponent extends DirectiveBase {

    activeTab            = "local";
    allProjects: Project[];
    selectedProjects     = [];
    localFoldersToAdd    = [];
    nonAddedUserProjects = [];

    constructor(private data: DataGatewayService,
                public modal: ModalService,
                private repository: PlatformRepositoryService,
                public auth: AuthService,
                private preferences: UserPreferencesService) {

        super();

        const projects          = this.repository.projects;
        const openProjects      = this.preferences.getOpenProjects();
        const activeCredentials = this.auth.active;

        this.tracked = Observable
            .combineLatest(
                projects, openProjects, activeCredentials,
                (projects, openProjects, activeCredentials) => ({projects, openProjects, activeCredentials})
            )
            .subscribe(data => {
                const {projects, openProjects, activeCredentials} = data;

                this.nonAddedUserProjects = projects.filter(project => {
                    const ID = [activeCredentials.getHash(), project.id].join("/");
                    return openProjects.indexOf(ID) === -1;
                }).map(project => {
                    return {value: project.id, text: project.name};
                });

                this.allProjects = projects;

            });
    }

    onDone() {

        const activePlatform = this.auth.active.getValue();
        if (!activePlatform) {
            throw new Error("Trying to open a project, but there is no active platform set.");
        }

        const selectedProjectIDs = this.selectedProjects.map(id => [activePlatform.getHash(), id].join("/"));

        this.preferences.getOpenProjects().take(1).subscribe(openProjects => {
            const update = openProjects.concat(selectedProjectIDs).filter((v, i, a) => a.indexOf(v) === i);

            this.preferences.setOpenProjects(update);
            this.modal.close();
        });

        return;
    }

    selectLocalFolders() {
        dialog.showOpenDialog({
            title: "Choose a Directory",
            defaultPath: app.getPath("home"),
            buttonLabel: "Add to Workspace",
            properties: ["openDirectory", "multiSelections"]
        }, (paths) => {
            this.localFoldersToAdd = paths || [];

            this.preferences.addLocalFolders(paths);
            this.modal.close();
        });
    }


}
