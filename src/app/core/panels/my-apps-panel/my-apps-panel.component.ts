import {
    AfterContentInit,
    AfterViewInit,
    ChangeDetectorRef,
    Component,
    ElementRef,
    OnInit,
    QueryList,
    ViewChild,
    ViewChildren
} from "@angular/core";
import {FormControl} from "@angular/forms";

import "rxjs/add/operator/map";
import {Observable} from "rxjs/Observable";
import {App} from "../../../../../electron/src/sbg-api-client/interfaces/app";
import {AuthService} from "../../../auth/auth.service";
import {RepositoryService} from "../../../repository/repository.service";
import {UserPreferencesService} from "../../../services/storage/user-preferences.service";
import {ContextService} from "../../../ui/context/context.service";
import {MenuItem} from "../../../ui/menu/menu-item";
import {ModalService} from "../../../ui/modal/modal.service";
import {TreeNodeComponent} from "../../../ui/tree-view/tree-node/tree-node.component";
import {TreeViewComponent} from "../../../ui/tree-view/tree-view.component";
import {TreeViewService} from "../../../ui/tree-view/tree-view.service";
import {DirectiveBase} from "../../../util/directive-base/directive-base";
import {DataGatewayService} from "../../data-gateway/data-gateway.service";
import {FilesystemEntry, FolderListing} from "../../data-gateway/data-types/local.types";
import {AddSourceModalComponent} from "../../modals/add-source-modal/add-source-modal.component";
import {CreateAppModalComponent} from "../../modals/create-app-modal/create-app-modal.component";
import {CreateLocalFolderModalComponent} from "../../modals/create-local-folder-modal/create-local-folder-modal.component";
import {WorkboxService} from "../../workbox/workbox.service";
import {NavSearchResultComponent} from "../nav-search-result/nav-search-result.component";
import {MyAppsPanelService} from "./my-apps-panel.service";

@Component({
    selector: "ct-my-apps-panel",
    providers: [MyAppsPanelService],
    templateUrl: "./my-apps-panel.component.html",
    styleUrls: ["./my-apps-panel.component.scss"]
})
export class MyAppsPanelComponent extends DirectiveBase implements AfterContentInit, OnInit, AfterViewInit {

    searchContent = new FormControl();

    searchResults = undefined;

    expandedNodes: Observable<string[]>;

    @ViewChild(TreeViewComponent)
    treeView: TreeViewComponent;

    tree: TreeViewService;

    @ViewChildren(NavSearchResultComponent, {read: ElementRef})
    private searchResultComponents: QueryList<ElementRef>;

    constructor(private preferences: UserPreferencesService,
                private cdr: ChangeDetectorRef,
                private workbox: WorkboxService,
                private auth: AuthService,
                private modal: ModalService,
                private repository: RepositoryService,
                private dataGateway: DataGatewayService,
                private service: MyAppsPanelService,
                private context: ContextService) {
        super();

        this.expandedNodes = this.preferences.get("expandedNodes", []).take(1).publishReplay(1).refCount();
    }

    ngOnInit(): void {
    }

    ngAfterContentInit() {
        this.tree = this.treeView.getService();
        this.listenForLocalExpansion();
        this.listenForFolderExpansion();

        this.attachSearchObserver();
        this.listenForPlatformExpansion();
        this.listenForProjectExpansion();

        this.attachExpansionStateSaving();
        this.listenForAppOpening();
        this.listenForContextMenu();

    }

    ngAfterViewInit() {
        this.searchResultComponents.changes.subscribe(list => {
            list.forEach((el, idx) => setTimeout(() => el.nativeElement.classList.add("shown"), idx * 20));
        });
    }

    private attachSearchObserver() {

        const localFileSearch = (term) => this.dataGateway.searchLocalProjects(term).map(results => results.map(result => {

            const id    = result.path;
            const label = result.path.split("/").slice(-3, -1).join("/");
            const title = result.path.split("/").pop();

            let icon      = "fa-file";
            let relevance = result.relevance;

            if (result.type === "Workflow") {
                icon = "fa-share-alt";
                relevance++;
            } else if (result.type === "CommandLineTool") {
                icon = "fa-terminal";
                relevance++;
            }

            return {
                id, icon, title, label, relevance,
                dragEnabled: ["Workflow", "CommandLineTool"].indexOf(result.type) !== -1,
                dragTransferData: id,
                dragLabel: title,
                dragImageClass: result.type === "CommandLineTool" ? "icon-command-line-tool" : "icon-workflow",
                dragDropZones: ["zone1"]
            };
        }));


        const projectSearch = (term) => this.dataGateway.searchUserProjects(term)
            .map(resultGroups => {
                return resultGroups.map(group => {

                    const {results, hash} = group;

                    return results.map(result => {
                        const id    = hash + "/" + result["owner"] + "/" + result["slug"] + "/" + result["sbg:id"];
                        const title = result.label;

                        return {
                            id,
                            icon: result.class === "Workflow" ? "fa-share-alt" : "fa-terminal",
                            title,
                            label: result.id.split("/").slice(5, 7).join(" → "),
                            relevance: 1.5,

                            dragEnabled: true,
                            dragTransferData: id,
                            dragLabel: title,
                            dragImageClass: result["class"] === "CommandLineTool" ? "icon-command-line-tool" : "icon-workflow",
                            dragDropZones: ["zone1"]
                        };
                    });

                }).reduce((acc, item) => acc.concat(...item), []);
            });

        this.searchContent.valueChanges
            .do(term => this.searchResults = undefined)
            .debounceTime(250)
            .distinctUntilChanged()
            .filter(term => term.trim().length !== 0)
            .flatMap(term => Observable.zip(localFileSearch(term), projectSearch(term)))
            .subscribe(datasets => {
                const combined     = [].concat(...datasets).sort((a, b) => b.relevance - a.relevance);
                this.searchResults = combined;
                this.cdr.markForCheck();
            });
    }

    /**
     * Expansion of a source root
     */
    private listenForPlatformExpansion() {

        const platformExpansion = this.tree.expansionChanges
            .filter(node => node.isExpanded === true && node.type === "source" && node.id !== "local");

        platformExpansion.subscribe(n => n.modify(() => n.loading = true));

        platformExpansion
            .flatMap(node => this.service.projects, (node, projects) => ({node, projects}))
            .withLatestFrom(this.expandedNodes, (data, expanded) => ({...data, expanded}))
            .subscribe(data => {
                const {projects, expanded, node} = data;
                const auth                       = this.auth.active.getValue();


                const nodes = projects.map(project => {
                    const [owner] = project.id.split("/");
                    const label   = project.name + (auth.user.username === owner ? "" : ` (${owner})`);
                    const hash    = [auth.getHash(), project.id].join("/");

                    return {
                        id: hash,
                        data: project,
                        type: "project",
                        icon: "fa-folder",
                        label: label,
                        isExpanded: expanded.indexOf(hash) !== -1,
                        isExpandable: true,
                        iconExpanded: "fa-folder-open"

                    }
                });

                node.modify(() => {
                    node.loading  = false;
                    node.children = nodes;
                });

            });
    }

    private listenForLocalExpansion() {
        // Create a stream of local root expansion events
        const localRootExpansion = this.tree.expansionChanges.filter(n => n.isExpanded === true && n.id === "local");

        // When expanding, turn on the loader first
        localRootExpansion.subscribe((node) => node.modify(() => node.loading = true));

        // When expanding, check the local folders and expanded nodes
        localRootExpansion.flatMap(n => this.dataGateway.getLocalListing(), (node, listing) => ({node, listing}))
            .withLatestFrom(this.expandedNodes, (outer, expanded) => ({...outer, expanded}))
            .subscribe((data: { node: TreeNodeComponent<any>, listing: any, expanded: string[] }) => {
                const children = data.listing.map(path => {
                    return {
                        id: path,
                        type: "folder",
                        icon: "fa-folder",
                        label: path.split("/").pop(),
                        isExpandable: true,
                        isExpanded: data.expanded.indexOf(path) !== -1,
                        iconExpanded: "fa-folder-open",
                    };
                });

                // Update the tree view
                data.node.modify(() => {
                    data.node.children = children;
                    data.node.loading  = false;
                });
            });

    }

    private listenForProjectExpansion() {

        const expansion: Observable<TreeNodeComponent<App>> = this.tree.expansionChanges
            .filter(n => n.isExpanded === true && n.type === "project");

        this.tracked = expansion.subscribe(n => n.modify(() => n.loading = true));

        this.tracked = expansion
            .flatMap(n => this.repository.getAppsForProject(n.data.id), (node, apps) => ({node, apps}))
            .subscribe(data => {

                const {node, apps} = data;
                const hash         = this.auth.active.getValue().getHash();

                const nodes = apps.map(app => {
                    const id = [hash, app.id].join("/");
                    return {
                        id,
                        type: "app",
                        label: app.name,
                        icon: app.raw.class === "CommandLineTool" ? "fa-terminal" : "fa-share-alt",
                        data: app,
                        dragEnabled: true,
                        dragTransferData: id,
                        dragDropZones: ["zone1"],
                        dragLabel: app.name,
                        dragImageClass: app.raw.class === "CommandLineTool" ? "icon-command-line-tool" : "icon-workflow",
                    }
                });

                data.node.modify(() => {
                    data.node.children = nodes;
                    data.node.loading  = false;
                });
            });
    }

    private listenForFolderExpansion() {
        this.tree.expansionChanges
            .filter(n => n.isExpanded === true && n.type === "folder")
            .do(n => n.modify(() => n.loading = true))
            .flatMap(n => this.dataGateway.getFolderListing(n.id), (node, listing) => ({
                node,
                listing
            }))
            .withLatestFrom(this.expandedNodes, (outer, expanded) => ({...outer, expanded}))
            .subscribe((data: {
                node: TreeNodeComponent<FilesystemEntry>
                listing: FolderListing,
                expanded: string[]
            }) => {
                const children = data.listing.map(entry => {

                    let icon = "fa-file";
                    let iconExpanded;

                    if (entry.isDir) {
                        icon         = "fa-folder";
                        iconExpanded = "fa-folder-open";
                    } else if (entry.type === "Workflow") {
                        icon = "fa-share-alt";
                    } else if (entry.type === "CommandLineTool") {
                        icon = "fa-terminal";
                    }

                    const id    = entry.path;
                    const label = entry.path.split("/").pop();

                    return {
                        id,
                        icon,
                        label,
                        data: entry,
                        iconExpanded,
                        isExpandable: entry.isDir,
                        isExpanded: entry.isDir && data.expanded.indexOf(entry.path) !== -1,
                        type: entry.isDir ? "folder" : "file",
                        dragEnabled: ["Workflow", "CommandLineTool"].indexOf(entry.type) !== -1,
                        dragTransferData: entry.path,
                        dragDropZones: ["zone1"],
                        dragLabel: label,
                        dragImageClass: entry.type === "CommandLineTool" ? "icon-command-line-tool" : "icon-workflow",
                    };
                });


                data.node.modify(() => {
                    data.node.children = children;
                    data.node.loading  = false;
                });
            });
    }

    private attachExpansionStateSaving() {
        this.tree.expansionChanges
            .flatMap(node => this.preferences.get("expandedNodes", []).take(1), (node, expanded) => ({node, expanded}))
            .subscribe(data => {
                const {node, expanded} = data;

                if (node.isExpanded && expanded.indexOf(node.id) === -1) {
                    this.preferences.put("expandedNodes", expanded.concat(node.id));
                } else if (!node.isExpanded) {
                    const idx = expanded.indexOf(node.id);
                    if (idx !== -1) {
                        expanded.splice(idx, 1);
                        this.preferences.put("expandedNodes", expanded);
                    }
                }
            });
    }

    private listenForAppOpening() {
        this.tree.open.filter(n => n.type === "app")
            .flatMap(node => this.workbox.getOrCreateFileTab(node.id).catch(() => {
                return Observable.empty();
            }))
            .subscribe(tab => this.workbox.openTab(tab));

        this.tree.open.filter(n => n.type === "file")
            .flatMap(node => this.workbox.getOrCreateFileTab(node.data.path).catch(() => {
                return Observable.empty();
            }))
            .subscribe(tab => this.workbox.openTab(tab));
    }

    private listenForContextMenu() {

        // When click on user project
        this.tree.contextMenu.filter((data) => data.node.type === "project")
            .subscribe(data => {
                const contextMenu = [
                    new MenuItem("Remove from Workspace", {
                        click: () => {
                            this.preferences.get("openProjects", []).take(1).subscribe(openProjects => {

                                this.preferences.put("openProjects", openProjects.filter((el) => el !== data.node.id));
                            });
                        }
                    }),
                    new MenuItem("Create new Workflow", {
                        click: () => {
                            const modal = this.modal.fromComponent(CreateAppModalComponent, {
                                closeOnOutsideClick: false,
                                backdrop: true,
                                title: `Create a New App`,
                                closeOnEscape: true
                            });

                            modal.appType = "workflow";
                            modal.destination = 'remote';
                            modal.defaultProject = data.node.id;
                        }
                    }),
                    new MenuItem("Create new Command Line Tool", {
                        click: () => {
                            const modal = this.modal.fromComponent(CreateAppModalComponent, {
                                closeOnOutsideClick: false,
                                backdrop: true,
                                title: `Create a New App`,
                                closeOnEscape: true
                            });

                            modal.appType = "tool";
                            modal.destination = 'remote';
                            modal.defaultProject = data.node.id;
                        }
                    })
                ];
                this.context.showAt(data.node.getViewContainer(), contextMenu, data.coordinates);
            });

        // When click on some root local folder
        this.tree.contextMenu.filter((data) => data.node.type === "folder" && data.node.level === 2)
            .subscribe(data => {
                const contextMenu = [
                    new MenuItem("Create new Folder", {
                        click: () => {
                            const modal = this.modal.fromComponent(CreateLocalFolderModalComponent, {
                                closeOnOutsideClick: false,
                                backdrop: true,
                                title: `Create New Folder`,
                                closeOnEscape: true
                            });

                            modal.folderPath = data.node.id;
                        }
                    }),
                    new MenuItem("Remove from Workspace", {
                        click: () => {
                            this.preferences.get("localFolders", []).take(1).subscribe(openFolders => {

                                this.preferences.put("localFolders", openFolders.filter((el) => el !== data.node.id));
                            });
                        }
                    }),
                    new MenuItem("Create new Workflow", {
                        click: () => {
                            const modal = this.modal.fromComponent(CreateAppModalComponent, {
                                closeOnOutsideClick: false,
                                backdrop: true,
                                title: `Create a New App`,
                                closeOnEscape: true
                            });

                            modal.appType = 'workflow';
                            modal.defaultFolder = data.node.id;
                        }
                    }),
                    new MenuItem("Create new Command Line Tool", {
                        click: () => {
                            const modal = this.modal.fromComponent(CreateAppModalComponent, {
                                closeOnOutsideClick: false,
                                backdrop: true,
                                title: `Create a New App`,
                                closeOnEscape: true
                            });

                            modal.appType = 'tool';
                            modal.defaultFolder = data.node.id;
                        }
                    })
                ];

                this.context.showAt(data.node.getViewContainer(), contextMenu, data.coordinates);
            });
    }

    openAddAppSourcesDialog() {
        this.modal.fromComponent(AddSourceModalComponent, {
            title: "Open a Project",
            backdrop: true
        });
    }

    openSearchResult(entry: { id: string }) {
        this.workbox.getOrCreateFileTab(entry.id)
            .take(1)
            .subscribe(tab => this.workbox.openTab(tab));
    }
}
