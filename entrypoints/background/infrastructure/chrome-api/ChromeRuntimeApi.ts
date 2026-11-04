import { IBrowserRuntimeApi, Manifest } from "../../services/runtime.api";
import { chromeApi } from "./chrome-api";

export class ChromeRuntimeApi implements IBrowserRuntimeApi {
    constructor() { }

    sendMessage(message: unknown): Promise<void>;
    sendMessage(message: unknown, callback: (response: any) => void): void;
    sendMessage(message: unknown, callback?: (response: any) => void): Promise<void> | void {
        if (callback) {
            return chromeApi.runtime.sendMessage(message, callback);
        }
        return chromeApi.runtime.sendMessage(message);
    }

    getRuntimeLastError(): Error | null {
        const error = chromeApi.runtime.lastError;
        return error ? new Error(error.message) : null;
    }
    
    getManifest(): Manifest {
        const chromeManifest = chromeApi.runtime.getManifest();
        const manifest: Manifest = {
            name: chromeManifest.name,
            version: chromeManifest.version,
            permissions: chromeManifest.permissions,
            author: chromeManifest.author,
        };
        return manifest;
    }
}