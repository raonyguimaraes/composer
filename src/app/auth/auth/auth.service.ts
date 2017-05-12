import {Injectable, Optional} from "@angular/core";
import {BehaviorSubject} from "rxjs/BehaviorSubject";
import {Observable} from "rxjs/Observable";
import {ReplaySubject} from "rxjs/ReplaySubject";

import {ErrorBarService} from "../../layout/error-bar/error-bar.service";
import {ConnectionState, CredentialsEntry} from "../../services/storage/user-preferences-types";
import {UserPreferencesService} from "../../services/storage/user-preferences.service";
import {PlatformAPIGatewayService} from "../api/platform-api-gateway.service";

@Injectable()
export class OldAuthService {

    authenticationProgress = new BehaviorSubject(false);

    connections = new ReplaySubject<any[]>(1);

    credentials: Map<string, CredentialsEntry> = new Map();

    credentialsChange: ReplaySubject<Map<string, CredentialsEntry>> = new ReplaySubject();

    constructor(private errorBar: ErrorBarService,
                private api: PlatformAPIGatewayService,
                @Optional() private store: UserPreferencesService) {


        this.invalidateSessions();

        this.credentialsChange.next(this.credentials);

    }

    setConnection(subdomain: string, token: string, user: any): void {
        const hash   = `${subdomain}_${user.username}`;
        const status = ConnectionState.Connecting;

        let url = `https://${subdomain}.sbgenomics.com`;
        if (subdomain === "igor") {
            url = `https://api.sbgenomics.com`;
        }


        this.credentials.set(hash, {user, token, subdomain, status, url, hash} as CredentialsEntry);
        this.credentialsChange.next(this.credentials);
    }

    removeConnection(hash: string): void {
        this.credentials.delete(hash);
        this.credentialsChange.next(this.credentials);
    }

    watchCredentials() {
        this.store.getCredentials()
            .distinctUntilChanged((a, b) => {
                const hashesA = a.map(c => c.hash).toString();
                const hashesB = b.map(c => c.hash).toString();
                return hashesA === hashesB;
            })
            .flatMap(creds => {
                const m = creds.map(c => ({
                    ...c,
                    status: ConnectionState.Connecting
                }));
                this.authenticationProgress.next(true);
                return this.store.setCredentials(m);
            })
            .flatMap((creds: CredentialsEntry[]) => {
                const checks = creds.map(c => {
                    const platform = this.api.forHash(c.hash);

                    const call = platform ? platform.openSession
                        : Observable.throw(
                            new Error("Could not open session because you are not connected to the necessary platform."));

                    return call
                        .flatMap(session => platform.getUser(session), (session, user) => ({session, user}))
                        .timeout(10000)
                        .catch(err => {

                            let errorMessage = `Cannot connect to ${c.url}.`;
                            if (err.status === 0) {
                                errorMessage += "Platform doesn't exist on that URL.";
                            } else if (err.status === 504) {
                                errorMessage += " API has timed out.";
                            } else if (err instanceof Error) {
                                errorMessage += " " + err.message + ".";
                            } else if (err.status === 401) {
                                errorMessage += " Invalid token.";
                            }

                            this.errorBar.showError(errorMessage);
                            return Observable.of(err);
                        });
                });

                if (checks.length === 0) {
                    return Observable.of([]);
                }

                return Observable.forkJoin(...checks);
            }, (credentials, sessions) => ({credentials, sessions}))
            .subscribe(data => {
                this.authenticationProgress.next(false);
                const update = data.credentials.map((c, i) => {
                    const {session, user} = data.sessions[i] as any;
                    return {
                        ...c,
                        status: typeof session === "string" ? ConnectionState.Connected : ConnectionState.Disconnected,
                        sessionID: typeof session === "string" ? session : null,
                        user
                    };
                });
                this.store.setCredentials(update);

            }, err => {
                console.log("Error on watch", err);
            });
    }

    invalidateSessions() {


        return this.store.getCredentials().take(1).flatMap(creds => {
            const invalidated = creds.map(c => {
                return {
                    ...c,
                    status: ConnectionState.Disconnected,
                    sessionID: undefined
                };
            });
            return this.store.setCredentials(invalidated);

        });
    }
}
