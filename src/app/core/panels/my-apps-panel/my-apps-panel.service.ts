import {Injectable} from "@angular/core";
import {Observable} from "rxjs/Observable";
import {AuthService} from "../../../auth/auth.service";
import {AuthCredentials} from "../../../auth/model/auth-credentials";
import {UserPreferencesService} from "../../../services/storage/user-preferences.service";
import {TreeNode} from "../../../ui/tree-view/tree-node";
import {DataGatewayService} from "../../data-gateway/data-gateway.service";

@Injectable()
export class MyAppsPanelService {

    rootFolders: Observable<TreeNode<any>[]>;

    constructor(private auth: AuthService,
                private preferences: UserPreferencesService,
                private data: DataGatewayService) {

        this.rootFolders = this.watchRootFolders();
    }

    watchRootFolders(): Observable<TreeNode<any>[]> {

        const expanded = this.preferences.getExpandedNodes().share();

        const nodify = data => Object.assign(data, {
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

        const platformEntry = this.auth.active.map(credentials => nodify({
            id: credentials.getHash(),
            data: credentials,
            label: AuthCredentials.getPlatformLabel(credentials.url),
        }));

        const folderListing = Observable.combineLatest(localFolder, platformEntry, (local, platform) => {
            return [local, platform];
        });

        return Observable.combineLatest(expanded, folderListing, (exp, listing) => {
            return listing.map(folder => Object.assign(folder, {
                isExpanded: exp.indexOf(folder.id) !== -1
            }));
        });
    }


}
