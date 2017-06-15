import {RequestCallback} from "request";
import {PublicAPI} from "./controllers/public-api.controller";
import * as SearchController from "./controllers/search.controller";
import {AppQueryParams} from "./sbg-api-client/interfaces/queries";
import {SBGClient} from "./sbg-api-client/sbg-client";
import {DataRepository} from "./storage/data-repository";
import {LocalRepository} from "./storage/types/local-repository";
import {UserRepository} from "./storage/types/user-repository";

const fsController          = require("./controllers/fs.controller");
const acceleratorController = require("./controllers/accelerator.controller");
const resolver              = require("./schema-salad-resolver");


const repository     = new DataRepository();
const repositoryLoad = new Promise((resolve, reject) => repository.load((err) => err ? reject(err) : resolve(1))).catch(err => {
    console.log("Caught promise rejection", err);
    // return err;
});

module.exports = {

    // File System Routes

    saveFileContent: (data, callback) => {
        fsController.saveFileContent(data.path, data.content, callback);
    },
    createFile: (data, callback) => {
        fsController.createFile(data.path, data.content, callback);
    },
    readDirectory: (path, callback) => {
        fsController.readDirectory(path, callback);
    },
    readFileContent: (path, callback) => {
        fsController.readFileContent(path, callback);
    },
    deletePath: (path, callback) => {
        fsController.deletePath(path, callback);
    },
    createDirectory: (path, callback) => {
        fsController.createDirectory(path, callback);
    },
    pathExists: (path, callback) => {
        fsController.pathExists(path, callback);
    },

    resolve: (path, callback) => {
        resolver.resolve(path).then(result => {
            callback(null, result);
        }, err => {
            callback(err);
        });
    },

    getUserByToken: (data: { url, token }, callback: RequestCallback) => {
        const api = new PublicAPI(data.url, data.token);
        api.getUser(callback);
    },

    resolveContent: (data, callback) => {
        resolver.resolveContent(data.content, data.path).then(result => {
            callback(null, result);
        }, err => callback(err));
    },

    // Shortcut Routes
    accelerator: (name, callback) => {
        acceleratorController.register(name, callback);
    },

    searchLocalProjects: (data: { term: string, limit: number, folders: string[] }, callback) => {
        SearchController.searchLocalProjects(data.folders, data.term, data.limit, callback);
    },


    getProjects: (data: { url: string; token: string }, callback) => {
        SBGClient.create(data.url, data.token).projects.all().then(response => {
            callback(null, response.filter(project => project.type === "v2"));
        }, rejection => callback(rejection));
    },

    getApps: (data: { url: string, token: string, query?: AppQueryParams }, callback) => {
        SBGClient.create(data.url, data.token).apps.private(data.query || {})
            .then(
                response => callback(null, response),
                reject => callback(reject)
            );
    },

    getLocalRepository: (data: { key?: string } = {}, callback) => {


        repositoryLoad.then((repoData) => {
            const repositoryData = data.key ? repository.local[data.key] : repository.local;

            callback(null, repositoryData);
        }, err => {
            callback(err)
        });
    },

    watchLocalRepository: (data: { key: string }, callback) => {

        repositoryLoad.then((repoData) => {

            if (repository.local && repository.local.hasOwnProperty(data.key)) {
                callback(null, repository.local[data.key]);

                repository.on(`update.local.${data.key}`, (value) => {
                    callback(null, value);
                });
            } else {
                const keyList = Object.keys(repository.local).map(k => `“${k}”`).join(", ");
                callback(new Error(`
                    Key “${data.key}” does not exist in the local storage. 
                    Available keys: ${keyList}
                `));
            }
        }, err => {
            callback(err)
        });
    },


    patchLocalRepository: (patch: Partial<LocalRepository>, callback) => {
        repositoryLoad.then(() => {
            repository.updateLocal(patch, callback);
        }, err => {
            callback(err)
        });
    },

    getUserRepository: (data: { key?: string } = {}, callback) => {
        repositoryLoad.then(() => {
            const repositoryData = data.key ? repository.user[data.key] : repository.user;
            callback(null, repositoryData);
        }, err => callback(err));
    },

    watchUserRepository: (data: { key: string }, callback) => {
        repositoryLoad.then(() => {

            if (repository.user && repository.user.hasOwnProperty(data.key)) {
                callback(null, repository.user[data.key]);

                repository.on(`update.user.${data.key}`, (value) => {
                    callback(null, value);
                });
            } else {
                const keyList = Object.keys(repository.user).map(k => `“${k}”`).join(", ");
                callback(new Error(`Key “${data.key}” does not exist in the user storage. Available keys: ${keyList}`));
            }

        }, err => callback(err));
    },

    patchUserRepository: (patch: Partial<UserRepository>, callback) => {
        repositoryLoad.then(() => {
            repository.updateUser(patch, callback);
        }, err => callback(err));
    },

    activateUser: (credentialsID: string, callback) => {
        repositoryLoad.then(() => {
            repository.activateUser(credentialsID, callback);
        }, err => callback(err));
    },

    fetchPlatformData: (data = {}, callback) => {
        repositoryLoad.then(() => {

            if (!repository.local.activeCredentials) {
                return callback(new Error("Cannot fetch platform data when there is no active user."));
            }

            const {url, token} = repository.local.activeCredentials;

            const client            = SBGClient.create(url, token);
            const projectsPromise   = client.projects.all();
            const appsPromise       = client.apps.private();
            const publicAppsPromise = client.apps.public();

            Promise.all([projectsPromise, appsPromise, publicAppsPromise]).then(results => {
                const [projects, apps, publicApps] = results;

                const timestamp = Date.now();

                repository.updateUser({
                    apps,
                    projects,
                    publicApps,
                    appFetchTimestamp: timestamp,
                    projectFetchTimestamp: timestamp
                }, (err, data) => {
                    if (err) return callback(err);

                    callback(null, "success");
                });
            }, err => callback(err));


        }, err => callback(err));
    },

    /**
     * Retrive platform app content.
     * Checks for a swap data first, then falls back to fetching it from the API.
     */
    getPlatformApp: (data: { id: string }, callback) => {

        repositoryLoad.then(() => {

            const credentials    = repository.local.activeCredentials;
            const userRepository = repository.user;

            if (!credentials || !userRepository) {
                callback(new Error("Cannot fetch an app, you are not connected to any platform."));
            }


            if (userRepository.swap && userRepository.swap[data.id]) {
                callback(null, repository.user.swap[data.id]);
                return;
            }

            const api = new SBGClient(credentials.url, credentials.token);
            api.apps.get(data.id).then(response => {
                callback(null, JSON.stringify(response.raw, null, 4));
            }, err => callback(err));


        }, err => callback(err));
    },

    patchSwap: (data: { local: boolean, swapID: string, swapContent?: string }, callback) => {
        repositoryLoad.then(() => {

            if (data.local) {
                if (typeof data.swapContent !== "string") {
                    delete repository.local.swap[data.swapID];
                } else {
                    repository.local.swap[data.swapID] = data.swapContent;
                }

                repository.updateLocal({
                    swap: repository.local.swap
                }, callback);

                return;
            }

            if (!repository.user) {
                callback(new Error("Cannot save a swap file for a non-connected user."));
            }

            if (typeof data.swapContent !== "string") {
                delete repository.user.swap[data.swapID];
            } else {
                repository.user.swap[data.swapID] = data.swapContent;
            }

            repository.updateUser({
                swap: repository.user.swap
            }, callback);

            return;

        }, err => callback(err));
    },

    getLocalFileContent: (path, callback) => {

        repositoryLoad.then(() => {

            const repo = repository.local;
            if(repo && repo.swap && repo.swap[path]){
                callback(null, repo.swap[path]);
                return;
            }

            fsController.readFileContent(path, callback);

        }, err => callback(err));

    }
};
