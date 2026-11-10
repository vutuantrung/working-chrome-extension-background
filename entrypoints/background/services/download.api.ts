export interface DownloadOptions {
    url: string;
    filename?: string;
    saveAs?: boolean;
    body?: string;
    headers?: Record<string, string>;
    [key: string]: any;
}

export interface IDownloadApi {
    download(options: DownloadOptions): Promise<number>;
    download(options: DownloadOptions, callback: (downloadId: number) => void): void;
    download(options: DownloadOptions, callback?: (downloadId: number) => void): Promise<number> | void;
}

export class BrowserApplicationDownloadApi {
    constructor(private browserApi: IDownloadApi) { }

    download(options: DownloadOptions, callback?: (downloadId: number) => void): Promise<number> | void {
        return this.browserApi.download(options, callback);
    }
}