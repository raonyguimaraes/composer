import {AfterViewInit, Component, Injector, Input, OnDestroy, OnInit, TemplateRef, ViewChild, ViewContainerRef} from "@angular/core";
import {FormBuilder, FormControl, FormGroup} from "@angular/forms";
import {CommandLineToolFactory} from "cwlts/models/generic/CommandLineToolFactory";
import {CommandLinePart} from "cwlts/models/helpers/CommandLinePart";
import * as Yaml from "js-yaml";

import "rxjs/add/observable/combineLatest";
import "rxjs/add/operator/skip";
import "rxjs/add/operator/take";

import {Observable} from "rxjs/Observable";
import {ReplaySubject} from "rxjs/ReplaySubject";
import {Subject} from "rxjs/Subject";
import {CodeSwapService} from "../core/code-content-service/code-content.service";
import {DataGatewayService} from "../core/data-gateway/data-gateway.service";
import {PublishModalComponent} from "../core/modals/publish-modal/publish-modal.component";
import {AppTabData} from "../core/workbox/app-tab-data";
import {ProceedToEditingModalComponent} from "../core/modals/proceed-to-editing-modal/proceed-to-editing-modal.component";
import {AppValidatorService, AppValidityState} from "../editor-common/app-validator/app-validator.service";
import {PlatformAppService} from "../editor-common/components/platform-app-common/platform-app.service";
import {EditorInspectorService} from "../editor-common/inspector/editor-inspector.service";
import {APP_SAVER_TOKEN, AppSaver} from "../editor-common/services/app-saving/app-saver.interface";
import {LocalFileSavingService} from "../editor-common/services/app-saving/local-file-saving.service";
import {PlatformAppSavingService} from "../editor-common/services/app-saving/platform-app-saving.service";
import {ErrorBarService} from "../layout/error-bar/error-bar.service";
import {StatusBarService} from "../layout/status-bar/status-bar.service";
import {IpcService} from "../services/ipc.service";
import {ModalService} from "../ui/modal/modal.service";
import {DirectiveBase} from "../util/directive-base/directive-base";
import "../util/rx-extensions/subscribe-tracked";
import LoadOptions = jsyaml.LoadOptions;

@Component({
    selector: "ct-tool-editor",
    styleUrls: ["./tool-editor.component.scss"],
    providers: [
        EditorInspectorService,
        ErrorBarService,
        CodeSwapService,
        PlatformAppService,
        {
            provide: APP_SAVER_TOKEN,
            useFactory(comp: ToolEditorComponent, ipc: IpcService, modal: ModalService) {

                if (comp.data.dataSource === "local") {
                    return new LocalFileSavingService(ipc);
                }

                return new PlatformAppSavingService(ipc, modal);
            },
            deps: [ToolEditorComponent, IpcService, ModalService]
        }
    ],
    templateUrl: "./tool-editor.component.html"
})
export class ToolEditorComponent extends DirectiveBase implements OnInit, OnDestroy, AfterViewInit {

    @Input()
    data: AppTabData;

    /** Default view mode. */
    @Input()
    viewMode: "code" | "gui" | "test" | "info";

    @Input()
    showInspector = false;

    validationState: AppValidityState;

    /** Flag to indicate the document is loading */
    isLoading = true;

    /** Flag for showing reformat prompt on GUI switch */
    showReformatPrompt = true;

    /** Flag for bottom panel, shows validation-issues, commandline, or neither */
    reportPanel: "validation" | "commandLinePreview" | undefined = "commandLinePreview";

    /** Flag for validity of CWL document */
    isValidCWL = false;

    /** Flag to indicate if CWL validation is in progress */
    isValidatingCWL = false;

    /** Flag to indicate if resolving content is in progress */
    isResolvingContent = false;

    /** Model that's recreated on document change */
    toolModel = CommandLineToolFactory.from(null, "document");

    /** Sorted array of resulting command line parts */
    commandLineParts: Subject<CommandLinePart[]> = new ReplaySubject();

    toolGroup: FormGroup;

    codeEditorContent = new FormControl(undefined);

    priorityCodeUpdates = new Subject<string>();

    /** Template of the status controls that will be shown in the status bar */
    @ViewChild("statusControls")
    private statusControls: TemplateRef<any>;

    @ViewChild("inspector", {read: ViewContainerRef})
    private inspectorHostView: ViewContainerRef;

    private changeTabLabel: (title: string) => void;
    private originalTabLabel: string;
    private appSavingService: AppSaver;

    constructor(private appValidator: AppValidatorService,
                private formBuilder: FormBuilder,
                private inspector: EditorInspectorService,
                private statusBar: StatusBarService,
                private dataGateway: DataGatewayService,
                private modal: ModalService,
                private codeSwapService: CodeSwapService,
                private injector: Injector,
                private errorBarService: ErrorBarService,
                public platformAppService: PlatformAppService,) {

        super();

        this.toolGroup = formBuilder.group({});

        // @fixme Bring this back with the new service
        // this.tracked = this.userPrefService.get("show_reformat_prompt", true, true).subscribe(x => this.showReformatPrompt = x);

        this.tracked = this.inspector.inspectedObject
            .map(obj => obj !== undefined)
            .subscribe(show => this.showInspector = show);
    }

    ngOnInit(): void {
        // Push status controls to the status bar
        this.statusBar.setControls(this.statusControls);

        // Get the app saver from the injector
        this.appSavingService = this.injector.get(APP_SAVER_TOKEN) as AppSaver;

        // @FIXME we should not modify the data input
        if (this.data.dataSource === "app" && this.hasCopyOfProperty()) {
            this.data.isWritable = false;
        }

        if (!this.data.isWritable) {
            this.codeEditorContent.disable();
        }

        // Set this app's ID to the code content service
        this.codeSwapService.appID = this.data.id;

        this.codeEditorContent.valueChanges.subscribeTracked(this, content => this.codeSwapService.codeContent.next(content));

        /** Changes to the code that did not come from user's typing. */
        const externalCodeChanges = Observable.merge(this.data.fileContent, this.priorityCodeUpdates).distinctUntilChanged().share();

        /** Changes to the code from user's typing, slightly debounced */
        const codeEditorChanges = this.codeEditorContent.valueChanges.debounceTime(300).distinctUntilChanged().share();

        /** Observe all code changes */
        const allCodeChanges = Observable.merge(externalCodeChanges, codeEditorChanges).distinctUntilChanged().share();

        /** First time that user types something in the code editor */
        const firstDirtyCodeChange = codeEditorChanges.filter(() => this.codeEditorContent.dirty === true).take(1);

        /** Attach a CWL validator to code updates and observe the validation state changes. */
        const validation = this.appValidator.createValidator(allCodeChanges).share();

        /** Get the end of first validation check */
        const firstValidationEnd = validation.filter(state => !state.isPending).take(1);

        /**
         * For each code change from outside the ace editor, update the content of the editor form control.
         * Check for RDF as well
         */
        externalCodeChanges.subscribeTracked(this, (code: string) => {
            // Exteral code changes should update the internal state as well
            this.codeEditorContent.setValue(code);

        });

        /**
         * After the initial validation, external code changes should resolve and recreate the model.
         * The issue is that model creation registers a validation callback that overrides validation state
         * provided by the {@link validation} stream. For the first input, however, the app might not be
         * validated yet, so we should not create the model before the first validation ends.
         * We therefore skip the input until the first validation, but need to preserve the latest
         * code change that might have been there in the meantime so we know what to use as the base for
         * the model creation.
         */
        firstValidationEnd.withLatestFrom(externalCodeChanges, (_, inner) => inner)
            .switchMap(inner => Observable.of(inner).merge(externalCodeChanges).distinctUntilChanged())
            .subscribeTracked(this, code => {
                this.resolveToModel(code).then(() => {
                    this.isLoading = false;
                });
            });


        /** When types something in the code editor for the first time, add a star to the tab label */
        /** This does not work very well, so disable it for now */
        // firstDirtyCodeChange.subscribeTracked(this, isDirty => this.changeTabLabel(this.originalTabLabel + (isDirty ? " (modified)" : "")));

        /**
         * We will store the validation state from the validator to avoid excessive template subscribers.
         * Also, we will at some times override the data from the state validity with model validation.
         */
        validation.subscribe(state => this.validationState = state);

        /** When the first validation ends, turn off the loader and determine which view we can show. Invalid app forces code view */
        firstValidationEnd.subscribe(state => {
            this.viewMode = state.isValid ? "gui" : "code";
        });
    }

    hasCopyOfProperty() {
        return this.data.parsedContent["sbg:copyOf"] !== undefined;
    }

    edit() {
        const modal = this.modal.fromComponent(ProceedToEditingModalComponent, {
            title: `Edit ${(this.data.parsedContent.label)}?`,
        });

        modal.appName = this.data.parsedContent.label;
        modal.response.subscribe(val => {
            this.data.isWritable = val;
            if (val) {
                this.codeEditorContent.enable();
            }
        })
    }

    /**
     * When click on Resolve button (visible only if app is a local file and you are in Code mode)
     */
    resolveButtonClick() {
        this.resolveToModel(this.codeEditorContent.value);
    }

    save() {

        const proc = this.statusBar.startProcess(`Saving: ${this.originalTabLabel}`);
        const text = this.viewMode === "code" ? this.codeEditorContent.value : this.getModelText();

        this.appSavingService
            .save(this.data.id, text)
            .then(update => {
                this.priorityCodeUpdates.next(update);
                this.statusBar.stopProcess(proc, `Saved: ${this.originalTabLabel}`);
            }, err => {
                if (!err || !err.message) {
                    this.statusBar.stopProcess(proc);
                    return;
                }

                this.errorBarService.showError(`Saving failed: ${err.message}`);
                this.statusBar.stopProcess(proc, `Could not save ${this.originalTabLabel} (${err.message})`);
            });
    }

    toggleReport(panel: "validation" | "commandLinePreview") {
        this.reportPanel = this.reportPanel === panel ? undefined : panel;

        // Force reflow, layout gets messed up otherwise
        setTimeout(() => window.dispatchEvent(new Event("resize")));
    }

    openRevision(revisionNumber: number | string) {

        const fid = this.data.id.split("/").slice(0, 3).concat(revisionNumber.toString()).join("/");

        this.dataGateway.fetchFileContent(fid).subscribe(txt => {
            this.priorityCodeUpdates.next(txt);
            this.codeSwapService.discardSwapContent();
            this.toolGroup.reset();
        });
    }

    onJobUpdate(job) {
        this.toolModel.setJobInputs(job.inputs);
        this.toolModel.setRuntime(job.allocatedResources);
        this.toolModel.updateCommandLine();
    }

    resetJob() {
        this.toolModel.resetJobDefaults();
    }

    switchTab(tabName) {

        if (!tabName) return;

        // setTimeout(() => {

        /** If switching to code mode, serialize the model first and update the editor text */
        if (this.viewMode !== "code" && tabName === "code") {
            this.priorityCodeUpdates.next(this.getModelText());
            this.viewMode = tabName;
            return;
        }

        /** If going from code mode to gui, resolve the content first */
        if ((this.viewMode === "code" || !this.viewMode) && tabName !== "code") {

            // Trick that will change reference for tabselector highlight line (to reset it to a Code mode if resolve fails)
            this.viewMode = undefined;
            this.resolveToModel(this.codeEditorContent.value).then(() => {
                this.viewMode = tabName;
            }, err => {
                this.viewMode = "code";
                this.errorBarService.showError(`Cannot resolve RDF schema: “${err}”`);

            });
            return;
        }

        // If changing from|to mode that is not a Code mode, just switch
        this.viewMode = tabName;
    }

    ngAfterViewInit() {
        this.inspector.setHostView(this.inspectorHostView);
        super.ngAfterViewInit();
    }

    provideStatusControls() {
        return this.statusControls;
    }

    publish() {

        if (!this.validationState.isValid) {
            this.errorBarService.showError(`Cannot publish this app because because it's doesn't match the proper JSON schema`);
            return;
        }

        this.syncModelAndCode(true).then(() => {
            const modal      = this.modal.fromComponent(PublishModalComponent, {title: "Publish an App"});
            modal.appContent = Yaml.safeLoad(this.codeEditorContent.value, {json: true} as LoadOptions);
        });
    }

    registerOnTabLabelChange(update: (label: string) => void, originalLabel: string) {
        this.changeTabLabel   = update;
        this.originalTabLabel = originalLabel;
    }

    private recreateToolModel(json: Object | any): void {

        this.toolModel = CommandLineToolFactory.from(json, "document");

        this.toolModel.onCommandLineResult(cmdResult => {
            this.commandLineParts.next(cmdResult);
        });

        this.toolModel.updateCommandLine();
        this.toolModel.setValidationCallback(this.afterModelValidation.bind(this))
        this.toolModel.validate().then(this.afterModelValidation.bind(this));
    }

    private afterModelValidation() {
        Object.assign(this.validationState, {
            errors: this.toolModel.errors || [],
            warnings: this.toolModel.warnings || []
        });
    }

    /**
     * Resolve RDF code content and return a promise of the resolved content
     * Side effect: recreate a tool model from resolved code
     * @param content
     * @returns Promise of resolved code content
     */
    private resolveToModel(content: string): Promise<Object> {
        const appMightBeRDF     = this.data.dataSource === "local";
        this.isResolvingContent = true;

        return new Promise((resolve, reject) => {
            if (appMightBeRDF) {
                const statusMessage = this.statusBar.startProcess("Resolving RDF Schema...");

                this.data.resolve(content).subscribe((resolved: Object) => {
                    this.recreateToolModel(resolved);
                    this.statusBar.stopProcess(statusMessage, "");
                    resolve(resolved);
                }, err => {
                    this.statusBar.stopProcess(statusMessage, "Failed to resolve RDF schema.");
                    reject(err);
                });

                return;
            }

            const json = Yaml.safeLoad(content, {json: true} as LoadOptions);
            this.recreateToolModel(json);
            resolve(json);

        }).then(result => {
            this.isResolvingContent = false;
            return result;
        }, err => {
            this.errorBarService.showError("RDF resolution error: " + err.message);
            this.isResolvingContent = false;
            return err;
        });


    }

    /**
     * Serializes model to text. It also adds sbg:modified flag to indicate
     * the text has been formatted by the GUI editor.
     *
     */
    private getModelText(): string {

        const modelObject = Object.assign(this.toolModel.serialize(), {"sbg:modified": true});

        if (this.data.language === "json" || this.data.dataSource === "app") {
            return JSON.stringify(modelObject, null, 4);
        }

        return Yaml.dump(modelObject);
    }

    private syncModelAndCode(resolveRDF = true): Promise<any> {
        if (this.viewMode === "code") {
            const codeVal = this.codeEditorContent.value;

            if (resolveRDF) {
                return this.resolveToModel(codeVal);
            }

            try {
                const json = Yaml.safeLoad(codeVal, {json: true} as LoadOptions);
                this.recreateToolModel(json);
                return Promise.resolve();
            } catch (err) {
                return Promise.reject(err);
            }

        }

        this.codeEditorContent.setValue(this.getModelText());

        return Promise.resolve();
    }


}
