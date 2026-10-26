import { chromeApi } from "../infrastructure/chrome-api/chrome-api";
export const getCookie = (details: chrome.cookies.CookieDetails) => chromeApi.cookies.get(details);
