import {Injectable, Optional} from "@angular/core";
import {BehaviorSubject} from "rxjs/BehaviorSubject";
import {User} from "../../../electron/src/sbg-api-client/interfaces/user";
import {UserPreferencesService} from "../services/storage/user-preferences.service";
import {AuthCredentials} from "./model/auth-credentials";
import {Observable} from "rxjs/Observable";

@Injectable()
export class AuthService {

    user: BehaviorSubject<User>                     = new BehaviorSubject(undefined);
    active: BehaviorSubject<AuthCredentials>        = new BehaviorSubject(undefined);
    credentials: BehaviorSubject<AuthCredentials[]> = new BehaviorSubject([]);

    constructor(@Optional() store: UserPreferencesService) {

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

        }).map(c => c ? c.user : undefined).subscribe(user => {
            this.user.next(user);
        });

        if (store) {
            this.bindPersistence(store);
        }
    }

    private bindPersistence(store: UserPreferencesService) {

        const storedCredentials = store.getCredentials().take(1);
        const storedActiveUser  = store.getActiveUser().take(1);

        storedCredentials.subscribe(data => this.credentials.next(data));

        Observable.forkJoin(storedCredentials, storedActiveUser, (credentials, active) => ({credentials, active}))
            .subscribe((data: { credentials: AuthCredentials[], active: AuthCredentials }) => {

                const {credentials, active} = data;
                this.credentials.next(credentials || []);

                if (active) {
                    this.activate(active);
                } else {
                    this.deactivate();
                }

            });


        this.credentials.subscribe(data => {
            store.setCredentials(data)
        });
        this.active.subscribe(user => {
            store.setActiveUser(user);
        });
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
