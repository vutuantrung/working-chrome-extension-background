import { IActionApi, BadgeTextDetails, BadgeBackgroundColorDetails } from "../../services/action.api";
import { chromeApi } from "./chrome-api";

export class ChromeActionApi implements IActionApi {
    constructor() { }

    setBadgeText(details: BadgeTextDetails): Promise<void>;
    setBadgeText(details: BadgeTextDetails, callback: () => void): void;
    setBadgeText(details: BadgeTextDetails, callback?: () => void): Promise<void> | void {
        if (callback) {
            return chromeApi.action.setBadgeText(details, callback);
        }
        return chromeApi.action.setBadgeText(details);
    }

    setBadgeBackgroundColor(details: BadgeBackgroundColorDetails): Promise<void>;
    setBadgeBackgroundColor(details: BadgeBackgroundColorDetails, callback: () => void): void;
    setBadgeBackgroundColor(details: BadgeBackgroundColorDetails, callback?: () => void): Promise<void> | void {
        if (callback) {
            return chromeApi.action.setBadgeBackgroundColor(details, callback);
        }
        return chromeApi.action.setBadgeBackgroundColor(details);
    }
}