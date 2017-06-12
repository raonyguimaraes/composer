import {Injectable} from "@angular/core";
import {BehaviorSubject} from "rxjs/BehaviorSubject";
import {Observable} from "rxjs/Observable";
import {User} from "../../../electron/src/sbg-api-client/interfaces/user";
import {LocalRepositoryService} from "../repository/local-repository.service";
import {AuthCredentials} from "./model/auth-credentials";


@Injectable()
export class AuthService {

    user: BehaviorSubject<User>                     = new BehaviorSubject(undefined);
    active: BehaviorSubject<AuthCredentials>        = new BehaviorSubject(undefined);
    credentials: BehaviorSubject<AuthCredentials[]> = new BehaviorSubject([]);

    constructor(private repository: LocalRepositoryService) {

        // Proxy all credentials rom the repository
        this.repository.getCredentials().subscribe(c => this.credentials.next(c));

        // Proxy active credentials from the repository
        this.repository.getActiveCredentials().map(active => {

            // It is really convenient for components to be able to check for credentials by reference
            // So, whenever we get new active entry, try to find a similar reference in the array of all credentials
            // If it's not there, then we shouldn't have an active user anyway, so it's a bit of a safeguard as well

            if (!active) return active;
            return this.credentials.getValue().find(c => c.equals(active));
        }).subscribe(c => this.active.next(c));

        // Filter whenever active credentials change, check if the user has changed.
        // It might not change if only the token changed, but the owner is the same
        this.active
            .distinctUntilChanged((x, y) => AuthCredentials.isSimilar(x, y))
            .map(c => c ? c.user : undefined)
            .subscribe(u => this.user.next(u));
    }

    /**
     * Sets an AuthCredentials instance as an active one
     * @returns {Observable<any>} Observable that completes when the activation is completed
     */
    setActiveCredentials(credentials?: AuthCredentials): Observable<any> {

        if (!credentials) {
            return this.repository.setActiveCredentials(undefined);
    }

        const c = this.credentials.getValue().find(c => c.equals(credentials));
        if (!c) {
            throw "Could not activate an unregistered credential set";
        }

        return this.repository.setActiveCredentials(c);
    }

    addCredentials(credentials: AuthCredentials): Observable<any> {
        const current = this.credentials.getValue();
        const similar = current.find(c => c.equals(credentials));

        if (similar) {
            similar.updateToMatch(credentials);
            return;
        }

        const updatedCredentials = current.concat(credentials);

        return this.repository.setCredentials(updatedCredentials);
    }

    removeCredentials(credentials: AuthCredentials): void {
        const current = this.credentials.getValue();
        const index   = current.findIndex(c => c.equals(credentials));

        if (index !== -1) {
            const updated = current.slice(0, index).concat(current.slice(index + 1));
            this.repository.setCredentials(updated);
        }
    }
}
