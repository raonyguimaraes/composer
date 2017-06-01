import {User} from "../../../../electron/src/sbg-api-client/interfaces/user";

export interface UserPlatformIdentifier {
    user: User;
    id: string;
    url: string;
    token: string;
}

export class AuthCredentials implements UserPlatformIdentifier {

    static readonly URL_VALIDATION_REGEXP = "^(https:\/\/)(.+)(\.sbgenomics\.com)$";

    static readonly TOKEN_VALIDATION_REGEXP = "^[0-9a-f]{8}[0-9a-f]{4}[0-9a-f]{4}[0-9a-f]{4}[0-9a-f]{12}$";

    id: string;
    user: User;
    url: string;
    token: string;

    constructor(url: string, token: string, user: User) {
        this.ensureValidURL(url);
        this.ensureValidToken(token);

        this.url   = url;
        this.token = token;
        this.user  = user;

        this.id = this.getHash();
    }

    static isValidToken(token: string): boolean {
        return new RegExp(AuthCredentials.TOKEN_VALIDATION_REGEXP).test(token);
    }

    static isValidURL(url: string): boolean {
        return new RegExp(AuthCredentials.URL_VALIDATION_REGEXP).test(url);
    }

    static getSubdomain(url: string): string {
        return url.slice(8, url.length - 15);
    }

    static getPlatformLabel(url: string): string {
        const subdomain = AuthCredentials.getSubdomain(url);
        switch (subdomain) {
            case "api":
                return "Seven Bridges";
            case "gcp-api":
                return "Seven Bridges (Google Cloud Platform)";
            case "eu-api":
                return "Seven Bridges (EU)";
            case "cgc-api":
                return "Cancer Genomics Cloud";
            case "pgc-api":
                return "Cavatica";
            case "bpa-api":
                return "Blood Profiling Atlas";
            default:
                return subdomain;
        }
    }

    static from(obj: UserPlatformIdentifier) {
        return new AuthCredentials(obj.url, obj.token, obj.user);
    }

    getHash(): string {
        const subdomain = AuthCredentials.getSubdomain(this.url);
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
}
