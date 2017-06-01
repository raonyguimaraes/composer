import {Injectable, Optional} from "@angular/core";
import {UserPreferencesService} from "../../services/storage/user-preferences.service";
import "rxjs/add/operator/take";

@Injectable()
export class LayoutService {
    public sidebarHidden = false;

    constructor(@Optional() private preferences: UserPreferencesService) {
        if (this.preferences) {
            this.preferences.getSidebarHidden().subscribe(val => {
                console.log("Loaded sidebar state from prefs", this.sidebarHidden);
                this.sidebarHidden = val;
            });
        }
    }

    toggleSidebar() {
        this.sidebarHidden = !this.sidebarHidden;

        if (this.preferences) {
            this.preferences.setSidebarHidden(this.sidebarHidden);
        }
    }
}
