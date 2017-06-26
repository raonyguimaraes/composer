import {Component, OnDestroy, OnInit, ViewChild} from "@angular/core";
import {WorkflowFactory, WorkflowModel} from "cwlts/models";
import * as Yaml from "js-yaml";
import "rxjs/add/operator/debounceTime";
import "rxjs/add/operator/merge";
import "rxjs/add/operator/switchMap";
import {CodeSwapService} from "../core/code-content-service/code-content.service";
import {AppEditorBase} from "../editor-common/app-editor-base/app-editor-base";
import {PlatformAppService} from "../editor-common/components/platform-app-common/platform-app.service";
import {EditorInspectorService} from "../editor-common/inspector/editor-inspector.service";
import {APP_SAVER_TOKEN} from "../editor-common/services/app-saving/app-saver.interface";
import {LocalFileSavingService} from "../editor-common/services/app-saving/local-file-saving.service";
import {PlatformAppSavingService} from "../editor-common/services/app-saving/platform-app-saving.service";
import {ErrorBarService} from "../layout/error-bar/error-bar.service";
import {IpcService} from "../services/ipc.service";
import {ModalService} from "../ui/modal/modal.service";
import {WorkflowGraphEditorComponent} from "./graph-editor/graph-editor/workflow-graph-editor.component";
import {WorkflowEditorService} from "./workflow-editor.service";


@Component({
    selector: "ct-workflow-editor",
    providers: [EditorInspectorService, ErrorBarService, WorkflowEditorService, CodeSwapService, PlatformAppService,
        {
            provide: APP_SAVER_TOKEN,
            useFactory(comp: WorkflowEditorComponent, ipc: IpcService, modal: ModalService) {

                if (comp.tabData.dataSource === "local") {
                    return new LocalFileSavingService(ipc);
                }

                return new PlatformAppSavingService(ipc, modal);
            },
            deps: [WorkflowEditorComponent, IpcService, ModalService]
        }
    ],
    styleUrls: ["./workflow-editor.component.scss"],
    templateUrl: "./workflow-editor.component.html"
})
export class WorkflowEditorComponent extends AppEditorBase implements OnDestroy, OnInit {
    protected getPreferredTab(): string {
        return "graph";
    }

    protected recreateModel(json: Object): void {
        this.dataModel = WorkflowFactory.from(json as any, "document");
        this.dataModel.setValidationCallback(this.afterModelValidation.bind(this));
        this.dataModel.validate().then(this.afterModelValidation.bind(this));
    }


    /** Default view mode. */
    viewMode: "info" | "graph" | "code" | string;

    /** Model that's recreated on document change */
    dataModel: WorkflowModel = WorkflowFactory.from(null, "document");

    @ViewChild(WorkflowGraphEditorComponent)
    private graphEditor: WorkflowGraphEditorComponent;

    // ngOnInit(): void {
    //
    //     // Whenever the editor content is changed, validate it using a JSON Schema.
    //     this.tracked = this.codeEditorContent.valueChanges
    //         .debounceTime(300)
    //         .merge(this.priorityCodeUpdates)
    //         .do(() => {
    //             this.isValidatingCWL = true;
    //         })
    //         .switchMap(latestContent => {
    //             return Observable.fromPromise(this.cwlValidatorService.validate(latestContent)).map((result) => {
    //                     return {
    //                         latestContent: latestContent,
    //                         result: result
    //                     };
    //                 }
    //             );
    //         })
    //         .subscribe(r => {
    //
    //             this.isValidatingCWL = false;
    //
    //             // Wrap it in zone in order to see changes immediately in status bar (cwlValidatorService.validate is
    //             // in world out of Angular)
    //             this.zone.run(() => {
    //
    //                 this.isLoading = false;
    //
    //                 if (!r.result.isValidCWL) {
    //                     // turn off loader and load document as code
    //                     this.viewMode   = "code";
    //                     this.isValidCWL = false;
    //
    //                     this.validation = r.result;
    //                     return r;
    //                 }
    //
    //                 this.isValidCWL = true;
    //
    //                 // If you are in mode other than Code mode or mode is undefined (opening app)
    //                 // ChangingRevision is when you are in Code mode and you are changing revision to know to generate
    //                 // a new dataModel
    //                 if (this.viewMode !== "code" || this.changingRevision) {
    //                     this.changingRevision = false;
    //                     this.resolveContent(r.latestContent).then(noop, noop);
    //                 } else {
    //                     // In case when you are in Code mode just reset validations
    //                     const v = {
    //                         errors: [],
    //                         warnings: [],
    //                         isValidatableCWL: true,
    //                         isValidCWL: true,
    //                         isValidJSON: true
    //                     };
    //
    //                     this.validation = v;
    //                 }
    //             });
    //         });
    //
    //     this.tracked = this.tabData.fileContent.subscribe(txt => {
    //         this.codeEditorContent.setValue(txt)
    //     });
    // }

    // /**
    //  * Resolve content and create a new tool model
    //  * @TODO: this became kinda spaghetti, make the code better organized
    //  */
    // resolveContent(latestContent) {
    //
    //
    //     this.isLoading          = true;
    //     this.isResolvingContent = true;
    //
    //     return new Promise((resolve, reject) => {
    //
    //         // Create ToolModel from json and set model validations
    //         const createWorkflowModel = (json) => {
    //             console.time("Workflow Model");
    //             this.workflowModel = WorkflowFactory.from(json as any, "document");
    //             console.timeEnd("Workflow Model");
    //
    //             // update validation stream on model validation updates
    //
    //             this.workflowModel.setValidationCallback((res) => {
    //                 this.validation = {
    //                     errors: this.workflowModel.errors,
    //                     warnings: this.workflowModel.warnings,
    //                     isValidatableCWL: true,
    //                     isValidCWL: true,
    //                     isValidJSON: true
    //                 };
    //             });
    //
    //             this.workflowModel.validate();
    //
    //             const out       = {
    //                 errors: this.workflowModel.errors,
    //                 warnings: this.workflowModel.warnings,
    //                 isValidatableCWL: true,
    //                 isValidCWL: true,
    //                 isValidJSON: true
    //             };
    //             this.validation = out;
    //
    //             // After wf is created get updates for steps
    //             // this.getStepUpdates();
    //
    //             if (!this.viewMode) {
    //                 this.viewMode = "graph";
    //             }
    //             this.isLoading = false;
    //         };
    //
    //         // If app is a local file
    //         if (this.tabData.dataSource !== "local") {
    //             // load JSON to generate model
    //             const json = Yaml.safeLoad(latestContent, {
    //                 json: true
    //             } as LoadOptions);
    //
    //             createWorkflowModel(json);
    //             this.isResolvingContent = false;
    //             resolve();
    //
    //         } else {
    //             this.tabData.resolve(latestContent).subscribe((resolved) => {
    //
    //                 createWorkflowModel(resolved);
    //                 this.isResolvingContent = false;
    //                 resolve();
    //
    //             }, (err) => {
    //                 this.isLoading          = false;
    //                 this.isResolvingContent = false;
    //                 this.viewMode           = "code";
    //                 this.validation         = {
    //                     isValidatableCWL: true,
    //                     isValidCWL: false,
    //                     isValidJSON: true,
    //                     warnings: [],
    //                     errors: [{
    //                         message: err.message,
    //                         loc: "document",
    //                         type: "error"
    //                     }]
    //                 };
    //
    //                 reject();
    //             });
    //         }
    //     });
    // }

    protected toggleLock(locked: boolean): void {
        super.toggleLock(locked);

        this.graphEditor.setGraphManipulationsLock(locked);
    }

    /**
     * @FIXME don't forget this
     * Call updates service to get information about steps if they have updates and mark ones that can be updated
     */
    private getStepUpdates() {
        throw "Not implemented";

        // Observable.of(1).switchMap(() => {
        //     // Call service only if wf is in user projects
        //     if (this.tabData.dataSource !== "local" && this.tabData.isWritable) {
        //
        //         const [appHash] = this.tabData.id.split("/");
        //         const api       = this.apiGateway.forHash(appHash);
        //
        //         return api.getUpdates(this.workflowModel.steps
        //             .map(step => step.run ? step.run.customProps["sbg:id"] : null)
        //             .filter(s => !!s));
        //
        //         // return this.platform.getUpdates(this.workflowModel.steps
        //         //     .map(step => step.run ? step.run.customProps["sbg:id"] : null)
        //         //     .filter(s => !!s))
        //     }
        //
        //     return Observable.of(undefined);
        // }).subscribe((response) => {
        //
        //     if (response) {
        //         Object.keys(response).forEach(key => {
        //             if (response[key] === true) {
        //                 this.workflowModel.steps
        //                     .filter(step => step.run.customProps["sbg:id"] === key)
        //                     .forEach(step => step.hasUpdate = true);
        //             }
        //         });
        //     }
        //
        //     // load document in GUI and turn off loader, only if loader was active
        //     if (this.isLoading) {
        //         this.isLoading = false;
        //     }
        //
        // });
    }

    /**
     * Serializes model to text. It also adds sbg:modified flag to indicate
     * the text has been formatted by the GUI editor
     */
    protected getModelText(embed = false): string {
        const wf          = embed ? this.dataModel.serializeEmbedded() : this.dataModel.serialize();
        const modelObject = Object.assign(wf, {"sbg:modified": true});

        return this.tabData.language === "json" || this.tabData.dataSource === "app" ?
            JSON.stringify(modelObject, null, 4) : Yaml.dump(modelObject);
    }

    onTabActivation(): void {
        if (this.graphEditor) {
            this.graphEditor.checkOutstandingGraphFitting();
        }
    }

    isValidatingOrResolvingCWL() {
        return this.isValidatingCWL || this.isResolvingContent;
    }
}
