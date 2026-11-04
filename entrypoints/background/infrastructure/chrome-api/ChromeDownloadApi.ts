import type { IDownloadApi, DownloadOptions } from "../../services/download.api";

export class ChromeDownloadApi implements IDownloadApi {
    download(options: DownloadOptions): Promise<number>;
    download(options: DownloadOptions, callback: (downloadId: number) => void): void;
    download(options: DownloadOptions, callback?: (downloadId: number) => void): Promise<number> | void {
        let chromeDownloadOptions: chrome.downloads.DownloadOptions;
        try {
            chromeDownloadOptions = options as chrome.downloads.DownloadOptions;
        } catch (error: any) {
            throw new Error("Failed casting Chrome details settings: " + error.message);
        }

        if (callback) {
            return chrome.downloads.download(chromeDownloadOptions, callback);
        }
        return chrome.downloads.download(chromeDownloadOptions);
    }
}