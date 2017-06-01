import {IncomingMessage} from "http";
import {reject} from "q";
import {RequestAPI} from "request";
import * as requestPromise from "request-promise-native";
import {RequestError, StatusCodeError, TransformError} from "request-promise-native/errors";
import {User, Project} from "./interfaces";
import {App} from "./interfaces/app";
import {AppQueryParams, QueryParams} from "./interfaces/queries";

export interface SBGClientPromise<T, K> {
    /**
     * Attaches callbacks for the resolution and/or rejection of the Promise.
     * @param onfulfilled The callback to execute when the Promise is resolved.
     * @param onrejected The callback to execute when the Promise is rejected.
     * @returns A Promise for the completion of which ever callback is executed.
     */
    then<TResult1 = T, TResult2 = K>(onfulfilled?: ((value: T) => TResult1 | PromiseLike<TResult1>) | undefined | null, onrejected?: ((reason: any) => TResult2 | PromiseLike<TResult2>) | undefined | null): Promise<TResult1 | TResult2>;
}

export type SBGClientResponse<T> = SBGClientPromise<T, RequestError | StatusCodeError | TransformError>;

export class SBGClient {

    private apiRequest: RequestAPI<any, any, any>;

    private static MAX_QUERY_LIMIT = 100;

    static create(url: string, token: string): SBGClient {
        return new SBGClient(url, token);
    }

    constructor(url: string, token: string) {

        this.apiRequest = requestPromise.defaults({

            baseUrl: url + "/v2/",
            timeout: 60000,
            json: true,
            headers: {
                "X-SBG-Auth-Token": token
            },
        });
    }

    get user() {
        return {
            get: (): SBGClientResponse<User> => this.apiRequest("user")
        };
    }

    get projects() {
        return {
            all: () => this.fetchAll<Project>("projects?fields=_all")
        }
    }

    get apps() {
        return {
            private: (query: AppQueryParams) => this.fetchAll<App>("apps", query),
            public: () => this.fetchAll<App>("apps?visibility=public")
        }
    }

    private fetchAll<T>(endpoint: string, qs?: QueryParams): SBGClientResponse<T[]> {
        const load = (offset = 0) => this.apiRequest.defaults({
            qs: {...qs, offset, limit: SBGClient.MAX_QUERY_LIMIT},
            resolveWithFullResponse: true
        })(endpoint);

        return new Promise((resolve, reject) => {

            load().then((result: IncomingMessage & { body: any }) => {
                const total = result.headers["x-total-matching-query"];
                const items = result.body.items;

                if (items.length === total) {
                    return resolve(items);
                }

                const allItems: any[]     = items;
                const additionalCallCount = Math.ceil(total / SBGClient.MAX_QUERY_LIMIT) - 1;
                const additionalCalls     = [];

                for (let i = 1; i <= additionalCallCount; i++) {
                    additionalCalls.push(load(i * SBGClient.MAX_QUERY_LIMIT));
                }

                return Promise.all(additionalCalls).then(results => {
                    resolve(allItems.concat(...results.map(r => r.body.items)));
                }, reject);
            }, reject);
        });
    }
}
