import { chromeApi } from "../infrastructure/chrome-api/chrome-api";
export const getCookie = (details: { url: string; name: string; storeId?: string }) => chromeApi.cookies.get(details);
