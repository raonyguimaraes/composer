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
                    console.log("Received user update of", data.key);
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

            const client     = SBGClient.create(url, token);
            const projects   = client.projects.all();
            const apps       = client.apps.private();
            const publicApps = client.apps.public();

            Promise.all([projects, apps, publicApps]).then(results => {
                console.log("Fetched all data");
                const [projects, apps, publicApps] = results;

                const timestamp = Date.now();

                repository.updateUser({
                    apps,
                    projects,
                    publicApps,
                    appFetchTimestamp: timestamp,
                    projectFetchTimestamp: timestamp
                }, (err, data) => {
                    console.log("Update user callback", err, data);
                    if (err) return callback(err);

                    callback(null, "success");
                });
            }, err => callback(err));


        }, err => callback(err));
    }
};
