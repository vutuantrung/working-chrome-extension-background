export interface Manifest {
    name: string;
    version: string;
    permissions?: string[];
    author?: any;
}

export interface IBrowserRuntimeApi {
    getRuntimeLastError(): Error | null;
    getManifest(): Manifest;

    sendMessage(message: unknown): Promise<void>;
    sendMessage(message: unknown, callback: (response: any) => void): void;
    sendMessage(message: unknown, callback?: (response: any) => void): Promise<void> | void;
}

export class BrowserApplicationRuntimeApi {
    constructor(private browserApi: IBrowserRuntimeApi) { }
    getRuntimeLastError(): Error | null {
        return this.browserApi.getRuntimeLastError();
    }
    getManifest(): Manifest {
        return this.browserApi.getManifest();
    }
    sendMessage(message: unknown, callback?: (response: any) => void): Promise<void> | void {
        return this.browserApi.sendMessage(message, callback);
    }
}