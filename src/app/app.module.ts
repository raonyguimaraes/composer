import {NgModule} from "@angular/core";
import {FormBuilder, FormsModule, ReactiveFormsModule} from "@angular/forms";
import {HttpModule, RequestOptions, XHRBackend} from "@angular/http";
import {BrowserModule} from "@angular/platform-browser";
import {PlatformAPIGatewayService} from "./auth/api/platform-api-gateway.service";
import {OldAuthService} from "./auth/auth/auth.service";
import {MainComponent} from "./components/main/main.component";
import {PlatformConnectionService} from "./core/auth/platform-connection.service";
import {CoreModule} from "./core/core.module";
import {DataGatewayService} from "./core/data-gateway/data-gateway.service";
import {CWLModule} from "./cwl/cwl.module";
import {EditorCommonModule} from "./editor-common/editor-common.module";
import {CtHttp} from "./http/ct-http.service";
import {DomEventService} from "./services/dom/dom-event.service";
import {GuidService} from "./services/guid.service";
import {IpcService} from "./services/ipc.service";
import {SettingsService} from "./services/settings/settings.service";
import {UserPreferencesService} from "./services/storage/user-preferences.service";
import {ToolEditorModule} from "./tool-editor/tool-editor.module";
import {ModalService} from "./ui/modal/modal.service";
import {UIModule} from "./ui/ui.module";
import {WorkflowEditorModule} from "./workflow-editor/workflow-editor.module";
import {AuthService} from "./auth/auth.service";
import {JavascriptEvalService} from "./services/javascript-eval/javascript-eval.service";

@NgModule({
    providers: [
        AuthService,
        FormBuilder,
        UserPreferencesService,
        DomEventService,
        ModalService,
        IpcService,
        GuidService,
        SettingsService,
        PlatformConnectionService,
        PlatformAPIGatewayService,
        DataGatewayService,
        OldAuthService,
        {
            provide: CtHttp,
            useFactory: ctHttpFactory,
            deps: [XHRBackend, RequestOptions]
        },
        JavascriptEvalService

    ],
    declarations: [
        MainComponent,
    ],
    imports: [
        BrowserModule,
        FormsModule,
        HttpModule,
        CoreModule,
        ReactiveFormsModule,
        UIModule,
        CWLModule,
        EditorCommonModule,
        ToolEditorModule,
        WorkflowEditorModule
    ],
    bootstrap: [MainComponent]
})
export class AppModule {

    constructor (userPref: UserPreferencesService) {
        // When having an active connection, and restarting the app, new session ID call may end up in a race
        // condition with other API calls which are using the old session ID, which gets invalidated in the meantime
        userPref.clearSessions();
    }
}

export function ctHttpFactory(xhrBackend: XHRBackend, requestOptions: RequestOptions): CtHttp {
    return new CtHttp(xhrBackend, requestOptions);
}
