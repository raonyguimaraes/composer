import * as SearchController from "./controllers/search.controller";
import {RequestCallback} from "request";
const fsController          = require("./controllers/fs.controller");
const acceleratorController = require("./controllers/accelerator.controller");
const resolver              = require("./schema-salad-resolver");
import {PublicAPI} from "./controllers/public-api.controller";

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
        }, err => {
            callback(err);
        });
    },

    // Shortcut Routes
    accelerator: (name, callback) => {
        acceleratorController.register(name, callback);
    },

    searchLocalProjects: (data: { term: string, limit: number, folders: string[] }, callback) => {
        SearchController.searchLocalProjects(data.folders, data.term, data.limit, callback);
    }
};
