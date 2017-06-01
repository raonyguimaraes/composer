export interface QueryParams {
    fields?: string;
}

export interface AppQueryParams extends QueryParams {
    project?: string;
    project_owner?: string;
    visibility?: string;
}
