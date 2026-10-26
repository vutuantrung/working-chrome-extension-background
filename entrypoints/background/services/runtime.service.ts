import { chromeApi } from "../infrastructure/chrome-api/chrome-api";
export const getRuntimeLastError = () => chromeApi.runtime.lastError;

export const getManifest = () => chromeApi.runtime.getManifest();
