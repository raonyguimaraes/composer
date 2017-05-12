import {User} from "../../../../electron/src/sbg-api-client/interfaces/user";

export class AuthCredentials {

    static readonly URL_VALIDATION_REGEXP = "^(https:\/\/)(.+)(\.sbgenomics\.com)$";

    static readonly TOKEN_VALIDATION_REGEXP = "^[0-9a-f]{8}[0-9a-f]{4}[0-9a-f]{4}[0-9a-f]{4}[0-9a-f]{12}$";

    url: string;
    token: string;
    user: User;

    static isValidToken(token: string): boolean {
        return new RegExp(AuthCredentials.TOKEN_VALIDATION_REGEXP).test(token);
    }

    static isValidURL(url: string): boolean {
        return new RegExp(AuthCredentials.URL_VALIDATION_REGEXP).test(url);
    }

    constructor(url: string, token: string, user: User) {
        this.ensureValidURL(url);
        this.ensureValidToken(token);

        this.url   = url;
        this.token = token;
        this.user  = user;
    }

    private ensureValidToken(token: string): void {
        if (AuthCredentials.isValidToken(token) === false) {
            throw `Invalid token: ${token}`;
        }
    }

    private ensureValidURL(url: string): void {
        if (AuthCredentials.isValidURL(url) === false) {
            throw `Invalid URL: ${url}`;
        }
    }

    getHash(): string {
        const subdomain = this.url.slice(8, this.url.length - 15);
        return `${subdomain}_${this.user.username}`;
    }

    equals(credentials: AuthCredentials): boolean {
        return this.getHash() === credentials.getHash();
    }

    updateToMatch(credentials: AuthCredentials) {
        this.url   = credentials.url;
        this.token = credentials.token;
        this.user  = credentials.user;
    }
}
