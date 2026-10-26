import { chromeApi } from "../infrastructure/chrome-api/chrome-api";
export const getRuntimeLastError = () => chromeApi.runtime.lastError;
