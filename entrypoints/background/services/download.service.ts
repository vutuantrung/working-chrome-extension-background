import { chromeApi } from "../infrastructure/chrome-api/chrome-api";
export const download = (options: chrome.downloads.DownloadOptions) => chromeApi.downloads.download(options);
