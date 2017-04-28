import {Component, EventEmitter, Input, Output} from "@angular/core";
import {Http, Headers} from "@angular/http";
import {AbstractControl, FormControl, FormGroup, Validators} from "@angular/forms";
import {ConnectionState, CredentialsEntry} from "app/services/storage/user-preferences-types";
import {AuthService} from "../../auth/auth/auth.service";
import {SystemService} from "../../platform-providers/system.service";
import {Observable} from "rxjs/Observable";

@Component({
    selector: "ct-credentials-form",
    styleUrls: ["./credentials-form.component.scss"],
    template: `
        <form class="auth-form m-2" data-test="form" (ngSubmit)="submit()" [formGroup]="form">

            <div class="row form-group" [class.has-warning]="form.get('url').invalid">
                <label class="col-xs-4 col-form-label">Platform:</label>
                <div class="col-xs-8">
                    <ct-auto-complete #url
                                      [mono]="true"
                                      [create]="true"
                                      [sortField]="false"
                                      formControlName="url"
                                      [options]="platformList"
                                      data-test="platform-field"
                    ></ct-auto-complete>
                </div>
            </div>

            <div class="row form-group" [class.has-warning]="form.get('token').invalid">
                <label class="col-xs-4 col-form-label">Developer Token:</label>
                <div class="col-xs-8  form-inline token-form">
                    <input data-test="token-field"
                           [formControl]="form.get('token')"
                           class="form-control token-control"
                           type="password"/>

                    <button class="ml-1 btn btn-secondary" type="button"
                            [disabled]="form.get('url').invalid"
                            (click)="openTokenPage()">Get Token
                    </button>
                </div>

            </div>

            <div class="alert alert-info" *ngIf="form.hasError('isValidating')">
                Validating...
            </div>

            <div class="alert alert-warning pl-2" *ngIf="form.dirty && form.invalid && !form.hasError('isValidating')">

                <ul>
                    <li *ngIf="form.hasError('tokenCheck')">
                        Token is not valid for selected platform.
                    </li>

                    <li *ngIf="form.get('url').hasError('name')">
                        Given platform does not exist.
                    </li>
                    <li *ngIf="form.get('token').hasError('minlength') 
                                || form.get('token').hasError('required')
                                || form.get('token').hasError('maxlength')">
                        Developer token should be 32 characters long.
                    </li>
                </ul>
            </div>
        </form>
    `
})
export class CredentialsFormComponent {

    /** Whether entries can be removed from the list. Disabling is useful when using this component outside the settings page. */
    @Input() removable = true;

    @Input() credentials: Partial<CredentialsEntry>[] = [];

    @Input() form: FormGroup;

    /** Emits an event each time the form is submitted. */
    @Output() onSubmit = new EventEmitter<CredentialsEntry[]>();

    isValidating = false;

    platformList = [
        {text: "Seven Bridges (Default)", value: "igor"},
        {text: "Seven Bridges (Google Cloud Platform)", value: "gcp"},
        {text: "Seven Bridges (EU)", value: "eu"},
        {text: "Cancer Genomics Cloud", value: "cgc"},
        {text: "Cavatica", value: "pgc"},
        {text: "Blood Profiling Atlas", value: "bpa"},
    ];

    constructor(private system: SystemService, private http: Http) {

    }

    ngOnInit() {
        if (!this.form) {
            this.form = new FormGroup({});
        }


        this.form.addControl("url", new FormControl("igor", [
            Validators.required,
            (ctrl: AbstractControl) => {
                const val = ctrl.value || "";
                //
                if (this.platformList.map(e => e.value).indexOf(val) === -1
                    && !val.endsWith("-vayu")
                    && !val.startsWith("staging-")) {
                    return {name: true};
                }

                return null;
            }

        ]));

        this.form.addControl("token", new FormControl("", [
            Validators.required,
            Validators.minLength(32),
            Validators.maxLength(32)
        ]));

        // this.form.valueChanges.subscribe(() => {
        //     this.isValidating = true;
        //     this.form.setErrors({validating: true});
        // });

        this.form.valueChanges
            .filter(() => this.form.valid)
            .do(() => {
                this.form.setErrors({isValidating: true});
            })
            .debounceTime(150).map(values => {
            const token   = values.token;
            let subdomain = "api";
            if (values.url !== "igor" && !values.url.endsWith("-vayu")) {
                subdomain = values.url + "-api";
            }

            let url = `https://${subdomain}.sbgenomics.com`;
            if (values.url.endsWith("-vayu")) {
                url += ":27445";
            }
            url += "/v2/user";

            return {url, token};
        }).flatMap(vals => {
            return this.http.get(vals.url, {
                headers: new Headers({
                    "X-SBG-Auth-Token": vals.token
                })
            }).catch(ex => {
                return Observable.of(ex);
            });
        }).subscribe((res) => {
            if (res.status === 200) {
                this.form.setErrors(null);
            } else {
                this.form.setErrors({
                    tokenCheck: true
                });
            }
        }, err => {
            console.log("Got the api error");
        });
    }

    /**
     * Pushes values from the form into the authentication service
     */
    applyValues(): void {
        const values = this.form.get("pairs").value.map(val => {
            const hash    = AuthService.hashUrlTokenPair(val.url, val.token);
            const profile = AuthService.urlToProfile(val.url);

            return {...val, hash, profile, status: ConnectionState.Connecting};
        }).filter((item, index, arr) => {
            return arr.findIndex(it => it.hash === item.hash) === index;
        });

        this.onSubmit.emit(values);
    }

    openTokenPage() {
        const url = `https://${this.form.get("url").value}.sbgenomics.com/developer#token`;
        this.system.openLink(url);
    }

}
