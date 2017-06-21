import {Component, forwardRef, Input, OnInit} from "@angular/core";
import {ControlValueAccessor, NG_VALUE_ACCESSOR} from "@angular/forms";
import {Subject} from "rxjs/Subject";
import {noop} from "../../lib/utils.lib";
import "rxjs/add/operator/distinctUntilChanged"
import {SelectComponent} from "./select/select.component";

@Component({
    selector: "ct-auto-complete",
    providers: [{
        provide: NG_VALUE_ACCESSOR,
        useExisting: forwardRef(() => AutoCompleteComponent), multi: true
    }],
    template: `<input #el [placeholder]="placeholder" [disabled]="readonly">`,
    styleUrls: ["./auto-complete.component.scss"],
})
export class AutoCompleteComponent extends SelectComponent implements ControlValueAccessor, OnInit {

    // Important inputs -> [options], [create], see parent class...

    // True makes control mono-selection (suggested input)
    @Input() mono        = false;
    @Input() readonly    = false;
    @Input() disabled    = false;
    @Input() placeholder = "";


    private update          = new Subject();
    private onTouched       = noop;
    private propagateChange = noop;


    ngOnInit() {
        if (this.mono) {
            this.maxItems = 1;
        }

        this.update.distinctUntilChanged().subscribe((value) => {
            this.propagateChange(value);
        });
    }

    ngOnChanges() {
        this.setDisabledState(this.disabled);
    }

    writeValue(obj: any): void {
        this.updateOptions(obj ? obj : []);
    }

    onChange(value: string) {
        this.update.next(this.mono ? value : (value ? value.split(this.delimiter) : []));

        // Component is initialized through jQuery after view init
        if (this.component) {
            (this.disabled || this.readonly) ? this.component.disable() : this.component.enable();
        }
    }

    registerOnChange(fn: any): void {
        this.propagateChange = fn;
    }

    registerOnTouched(fn: any): void {
        this.onTouched = fn;
    }

    setDisabledState(isDisabled: boolean): void {
        this.disabled = isDisabled;
    }
}

