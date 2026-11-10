export interface IBrowserStorageApi {
    set(value: any): Promise<void>;
    set(value: any, callback: () => void): void;
    set(value: any, callback?: () => void): Promise<void> | void;

    get(key: string[] | null): Promise<any>;
    get(key: string[] | null, callback: (item: any) => void): void;
    get(key: string[] | null, callback?: (item: any) => void): Promise<any> | void;

    remove(key: string[]): Promise<void>;
    remove(key: string[], callback: () => void): void;
    remove(key: string[], callback?: () => void): Promise<void> | void;
}

export class BrowserApplicationStorageApi {
    constructor(private browserApi: IBrowserStorageApi) { }

    get(keys: string[] | null) {
        return this.browserApi.get(keys);
    }

    set(value: any) {
        return this.browserApi.set(value);
    }

    remove(keys: string[]) {
        return this.browserApi.remove(keys);
    }
}