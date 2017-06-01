import {Injectable} from "@angular/core";
import {Observable} from "rxjs/Observable";
import {ReplaySubject} from "rxjs/ReplaySubject";
import {App} from "../../../electron/src/sbg-api-client/interfaces/app";
import {Project} from "../../../electron/src/sbg-api-client/interfaces/project";
import {AuthService} from "../auth/auth.service";
import {DataGatewayService} from "../core/data-gateway/data-gateway.service";

@Injectable()
export class RepositoryService {

    projects = new ReplaySubject<Project[]>(1);

    apps = new ReplaySubject<App[]>(1);

    constructor(private auth: AuthService, private dataGateway: DataGatewayService) {

        this.auth.active.switchMap(active => {
            if (!active) {
                return Observable.of([]);
            }

            const {url, token} = active;
            return this.dataGateway.getProjects(url, token);
        }).subscribe(data => {
            this.projects.next(data);
        }, err => {
            console.log("Error in repository projects", err);
        });


        this.auth.active.switchMap(active => {
            if (!active) {
                return Observable.of([]);
            }

            const {url, token} = active;
            return this.dataGateway.getApps(url, token);
        }).subscribe(data => {
            this.apps.next(data)
        }, err => {
            console.log("Err in repository apps", err);
        });

    }

    getAppsForProject(projectID) {
        return this.apps.map(apps => {
            return apps.filter(app => {

                return app.project === projectID;
            });
        });
    }

}
