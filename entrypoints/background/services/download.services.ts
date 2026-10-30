export interface IDownloadService {
    download(options: chrome.downloads.DownloadOptions): Promise<string>;
}

export class DownloadService implements IDownloadService {
    constructor() { }

    download(options: chrome.downloads.DownloadOptions): Promise<string> {
        throw new Error("Method not implemented.");
    }
}