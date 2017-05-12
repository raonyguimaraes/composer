import {Injectable} from "@angular/core";
import {Observable} from "rxjs/Observable";
import {BehaviorSubject} from "rxjs/BehaviorSubject";
import {AuthCredentials} from "./model/auth-credentials";
import {User} from "../../../electron/src/sbg-api-client/interfaces/user";

@Injectable()
export class AuthService {

    user: BehaviorSubject<User>                     = new BehaviorSubject(undefined);
    active: BehaviorSubject<AuthCredentials>        = new BehaviorSubject(undefined);
    credentials: BehaviorSubject<AuthCredentials[]> = new BehaviorSubject([]);

    constructor() {
        this.active.distinctUntilChanged((x, y) => {

            const onlyXExists  = x !== undefined && y === undefined;
            const onlyYExists  = y !== undefined && x === undefined;
            const neitherExist = x === undefined && y === undefined;

            if (onlyXExists || onlyYExists) {
                return false;
            }

            if (neitherExist) {
                return true;
            }

            return x.equals(y);

        }).map(c => c ? c.user : undefined).subscribe(this.user);
    }

    activate(credentials: AuthCredentials) {
        const c = this.credentials.getValue().find(c => c.equals(credentials));
        if (!c) {
            throw "Could not activate an unregistered credential set";
        }

        this.active.next(c);
    }

    deactivate() {
        this.active.next(undefined);
    }

    addCredentials(credentials: AuthCredentials): void {
        const current = this.credentials.getValue();
        const similar = current.find(c => c.equals(credentials));

        if (similar) {
            console.log("Found similar", credentials, " to", similar, credentials.getHash(), similar.getHash());
            similar.updateToMatch(credentials);
            return;
        }

        const updatedCredentials = current.concat(credentials);
        this.credentials.next(updatedCredentials);
    }

    removeCredentials(credentials: AuthCredentials): void {
        const current = this.credentials.getValue();
        const index   = current.findIndex(c => c.equals(credentials));

        if (index) {
            const updated = current.splice(index, 1);
            this.credentials.next(updated);
        }
    }

}
