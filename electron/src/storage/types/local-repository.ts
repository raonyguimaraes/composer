import {User} from "../../sbg-api-client/interfaces/user";
import {RepositoryType} from "./repository-type";

export class LocalRepository extends RepositoryType {

    activeCredentials: { id: string; user: User, url: string, token: string };

    credentials: { id: string; user: User, url: string, token: string }[] = [];

    localFolders: string[] = [];

    publicAppsGrouping: "toolkit" | "category" = "toolkit";

    selectedAppPanel: "myApps" | "publicApps" = "myApps";

    sidebarHidden = false;
}
