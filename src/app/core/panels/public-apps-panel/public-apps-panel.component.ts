import {AfterViewInit, Component, ElementRef, OnInit, QueryList, ViewChild, ViewChildren} from "@angular/core";
import {FormControl} from "@angular/forms";
import "rxjs/add/operator/do";

import "rxjs/add/operator/map";
import {Observable} from "rxjs/Observable";
import {App} from "../../../../../electron/src/sbg-api-client/interfaces/app";

import {LocalFileRepositoryService} from "../../../file-repository/local-file-repository.service";
import {UserPreferencesService} from "../../../services/storage/user-preferences.service";
import {TreeNode} from "../../../ui/tree-view/tree-node";
import {TreeViewComponent} from "../../../ui/tree-view/tree-view.component";
import {TreeViewService} from "../../../ui/tree-view/tree-view.service";
import {DirectiveBase} from "../../../util/directive-base/directive-base";
import {WorkboxService} from "../../workbox/workbox.service";
import {NavSearchResultComponent} from "../nav-search-result/nav-search-result.component";
import {PublicAppsPanelService} from "./public-apps-panel.service";

@Component({
    selector: "ct-public-apps-panel",
    template: `
        <ct-search-field class="m-1" [formControl]="searchContent"
                         [placeholder]="'Search Public Apps...'"></ct-search-field>

        <div class="btn-group grouping-toggle" *ngIf="!searchContent?.value">
            <button type="button"
                    [class.active]="grouping === 'toolkit'"
                    (click)="switchGrouping('toolkit')"
                    class="btn btn-secondary">By Toolkit
            </button>

            <button type="button"
                    (click)="switchGrouping('category')"
                    [class.active]="grouping === 'category'"
                    class="btn btn-secondary">By Category
            </button>
        </div>

        <div class="scroll-container">

            <div *ngIf="searchContent?.value && searchResults" class="search-results">
                <ct-nav-search-result *ngFor="let entry of searchResults" class="pl-1 pr-1"
                                      [id]="entry?.id"
                                      [icon]="entry?.icon"
                                      [label]="entry?.label"
                                      [title]="entry?.title"

                                      [ct-drag-enabled]="entry?.dragEnabled"
                                      [ct-drag-transfer-data]="entry?.dragTransferData"
                                      [ct-drag-image-caption]="entry?.dragLabel"
                                      [ct-drag-image-class]="entry?.dragImageClass"
                                      [ct-drop-zones]="entry?.dragDropZones"

                                      (dblclick)="openSearchResult(entry)"></ct-nav-search-result>
            </div>
            <ct-line-loader class="m-1"
                            *ngIf="searchContent.value 
                             && !searchResults"></ct-line-loader>

            <div *ngIf="searchContent.value 
                        && (searchResults && searchResults?.length === 0)"
                 class="no-results m-1">
                <p class="explanation">
                    No search results for “{{ searchContent.value }}.”
                </p>
                <i class="icon fa-4x fa fa-search"></i>
            </div>

            <ct-tree-view #tree
                          [level]="1"
                          [class.hidden]="searchContent?.value"
                          [nodes]="grouping === 'toolkit' ? (appsByToolkit | async) : (appsByCategory | async)"></ct-tree-view>
        </div>
    `,
    providers: [LocalFileRepositoryService, PublicAppsPanelService],
    styleUrls: ["./public-apps-panel.component.scss"]
})
export class PublicAppsPanelComponent extends DirectiveBase implements OnInit, AfterViewInit {

    treeNodes: TreeNode<any>[] = [];

    searchContent = new FormControl();

    searchResults = undefined;

    expandedNodes;

    groupedNodes: TreeNode<any>[];

    grouping: "category" | "toolkit" | string = "toolkit";

    @ViewChild(TreeViewComponent)
    treeComponent: TreeViewComponent;

    @ViewChildren(NavSearchResultComponent, {read: ElementRef})
    private searchResultComponents: QueryList<ElementRef>;

    private tree: TreeViewService;

    appsByToolkit: Observable<TreeNode<any>[]>;
    appsByCategory: Observable<TreeNode<any>[]>;

    constructor(private preferences: UserPreferencesService,
                private workbox: WorkboxService,
                private service: PublicAppsPanelService) {
        super();


        this.appsByToolkit  = this.service.getAppsGroupedByToolkit();
        this.appsByCategory = this.service.getAppsGroupedByCategory();
    }

    ngOnInit() {

    }

    ngAfterViewInit() {

        this.tree = this.treeComponent.getService();

        this.listenForAppOpening();

        // setTimeout(() => {
        //     this.loadDataSources();
        //     this.attachSearchObserver();
        //     this.attachExpansionStateSaving();
        //     this.listenForAppOpening();
        // });

        // this.searchResultComponents.changes.subscribe(list => {
        //     list.forEach((el, idx) => setTimeout(() => el.nativeElement.classList.add("shown"), idx * 20));
        // });
    }

    switchGrouping(type: "toolkit" | "category") {
        this.grouping = type;
    }


    private attachSearchObserver() {


        // const search = (term) => {
        //
        //
        //     const reversedTerm = term.split("").reverse().join("");
        //     return this.treeNodes.reduce((acc, node) => {
        //         return acc.concat(node.children.map(child => Object.assign(child, {parentLabel: node.label})));
        //     }, []).map((child) => {
        //         const fuzziness = DataGatewayService.fuzzyMatch(reversedTerm, child.id.split("").reverse().join(""));
        //         return {
        //             id: child.id,
        //             title: child.label,
        //             label: [child["parentLabel"], child.data["sbg:toolkit"], (child.data["sbg:categories"] || []).join(", ")].join("/"),
        //             icon: child.data.class === "Workflow" ? "fa-share-alt" : "fa-terminal",
        //
        //             dragEnabled: true,
        //             dragTransferData: child.id,
        //             dragLabel: child.label,
        //             dragImageClass: child.data["class"] === "CommandLineTool" ? "icon-command-line-tool" : "icon-workflow",
        //             dragDropZones: ["zone1"],
        //
        //             fuzziness
        //         };
        //     }).filter(child => child.fuzziness > 0.01)
        //         .sort((a, b) => b.fuzziness - a.fuzziness)
        //         .slice(0, 20);
        // };
        //
        // this.searchContent.valueChanges
        //     .do(term => this.searchResults = undefined)
        //     .debounceTime(250)
        //     .distinctUntilChanged()
        //     .filter(term => term.trim().length !== 0)
        //     .switchMap(term => Observable.of(search(term)))
        //     .subscribe(results => {
        //         this.searchResults = results;
        //         this.cdr.markForCheck();
        //     });
    }

    private attachExpansionStateSaving() {
        this.tree.expansionChanges
            .flatMap(node => this.preferences.get("expandedNodes"), (node, expanded) => ({node, expanded}))
            .subscribe((data: { node: any, expanded: string[] }) => {
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

        const appOpening = this.tree.open.filter(n => n.type === "app");

        appOpening.subscribeTracked(this, (node: TreeNode<App>) => {
            const app = node.data;
            if (!app.raw || !app.raw.class) {
                return;
            }

            const tab = this.workbox.getOrCreateAppTab({
                id: app.id,
                language: "json",
                isWritable: false,
                type: app.raw.class,
                label: app.name
            });

            this.workbox.openTab(tab);
        });

        // this.tree.open.filter(n => n.)
        // this.tree.open.filter(n => n.type === "app")
        //     .flatMap(node => this.workbox.getOrCreateFileTab(node.id).catch(() => {
        //         return Observable.empty()
        //     }))
        //     .subscribe(tab => this.workbox.openTab(tab));
    }

    openSearchResult(entry: {
        id: string
    }) {
        this.workbox.getOrCreateFileTab(entry.id).take(1).subscribe(tab => this.workbox.openTab(tab));
    }
}
