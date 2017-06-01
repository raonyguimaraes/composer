export class RepositoryType {
    activeTab: { tabID: string; activationTime: number; };
    expandedNodes: string[]          = [];
    openTabs: Object[]         = [];
    swap: { [path: string]: string } = {};
    recentApps: Object[]       = [];

    appMeta: {
        [path: string]: {
            workingDirectory?: string,
            jobFilePath?: string
        }
    } = {};
}
