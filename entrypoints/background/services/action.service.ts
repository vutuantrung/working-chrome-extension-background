import { chromeApi } from "../infrastructure/chrome-api/chrome-api";
export const setBadgeText = (details: chrome.action.BadgeTextDetails) => chromeApi.action.setBadgeText(details);
export const setBadgeBackgroundColor = (details: chrome.action.BadgeColorDetails) => chromeApi.action.setBadgeBackgroundColor(details);
