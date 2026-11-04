import { IBrowserStorageApi } from "../../services/storage.api";
import { chromeApi } from "./chrome-api";

export class ChromeStorageApi implements IBrowserStorageApi {
    set(value: any): Promise<void>;
    set(value: any, callback: () => void): void;
    set(value: any, callback?: () => void): void | Promise<void> {
        if (callback) {
            return chromeApi.storage.local.set(value, callback);
        }
        return chromeApi.storage.local.set(value);
    }

    get(keys: string[]): Promise<any>;
    get(keys: string[], callback: (item: any) => void): void;
    get(keys: string[], callback?: (item: any) => void): void | Promise<any> {
        if (callback) {
            return chromeApi.storage.local.get(keys, callback);
        }
        return chromeApi.storage.local.get(keys);
    }

    remove(keys: string[]): Promise<void>;
    remove(keys: string[], callback: () => void): void;
    remove(keys: string[], callback?: () => void): void | Promise<void> {
        if (callback) {
            return chromeApi.storage.local.remove(keys, callback);
        }
        return chromeApi.storage.local.remove(keys);
    }
}