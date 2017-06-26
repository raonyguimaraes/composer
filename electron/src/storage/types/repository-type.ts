import {RecentAppTab} from "./recent-app-tab";

export class RepositoryType {
    activeTab: { tabID: string; activationTime: number; };

    expandedNodes: string[] = [];

    openTabs: Object[] = [];

    swap: { [path: string]: string } = {};

    recentApps: RecentAppTab[] = [];

    appMeta: {
        [path: string]: {
            workingDirectory?: string,
            jobFilePath?: string
        }
    } = {};
}
