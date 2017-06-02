import {Injectable} from "@angular/core";
import {Project} from "app/auth/api/dto-interfaces/project";
import {Observable} from "rxjs/Observable";
import {ReplaySubject} from "rxjs/ReplaySubject";
import {AuthService} from "../../../auth/auth.service";
import {AuthCredentials} from "../../../auth/model/auth-credentials";
import {LocalProfileService} from "../../../profiles/local-profile.service";
import {PlatformUserProfileService} from "../../../profiles/platform-user-profile.service";
import {UserPreferencesService} from "../../../services/storage/user-preferences.service";
import {TreeNode} from "../../../ui/tree-view/tree-node";
import {PlatformRepositoryService} from "../../../repository/platform-repository.service";

@Injectable()
export class MyAppsPanelService {

    rootFolders: Observable<TreeNode<any>[]>;

    projects: Observable<Project[]> = new ReplaySubject<Project[]>(1);

    constructor(private auth: AuthService,
                private localProfile: LocalProfileService,
                private platformProfile: PlatformUserProfileService,
                private repository: PlatformRepositoryService,
                private preferences: UserPreferencesService) {

        this.rootFolders = this.watchRootFolders();

        Observable
            .combineLatest(
                repository.projects,
                preferences.getOpenProjects(),
                (projects, openProjects) => ({projects, openProjects})
            )
            .withLatestFrom(auth.active, (data, creds) => ({...data, creds}))
            .map(data => {
                const {projects, openProjects, creds} = data;

                const hash = creds.getHash();
                return projects.filter(project => openProjects.indexOf([hash, project.id].join("/")) !== -1);

            })
            .subscribe(this.projects as any, error => {
                console.log("Error on projects", error);
            });
    }

    /**
     * Gives an observable of root tree nodes.
     */
    watchRootFolders(): Observable<TreeNode<any>[]> {

        const expandedNodes = Observable.combineLatest(
            this.localProfile.getExpandedNodes(),
            this.platformProfile.getExpandedNodes(),
            (local, platform) => [...local, ...platform]
        );

        const nodify = (data) => Object.assign(data, {
            type: "source",
            icon: "fa-folder",
            isExpanded: false,
            isExpandable: true,
            iconExpanded: "fa-folder-open",
        }) as TreeNode<any>;

        const localFolder = Observable.of(nodify({
            id: "local",
            label: "Local Files",
        }));

        const platformEntry = this.auth.active.map(credentials => {
            if (!credentials) {
                return null;
            }
            return nodify({
                id: credentials.getHash(),
                data: credentials,
                label: AuthCredentials.getPlatformLabel(credentials.url),
            });
        });

        const folderListing = Observable.combineLatest(localFolder, platformEntry, (local, platform) => {
            return [local, platform].filter(a => a);
        });

        return Observable.combineLatest(expandedNodes, folderListing, (exp, listing) => {
            return listing.map(folder => Object.assign(folder, {
                isExpanded: exp.indexOf(folder.id) !== -1
            }));
        });
    }


}
