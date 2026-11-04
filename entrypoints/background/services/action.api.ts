export interface BadgeTextDetails {
    text?: string;
    tabId?: number;
}

export interface BadgeBackgroundColorDetails {
    color: string;
    tabId?: number;
}

export interface IActionApi {
    setBadgeText(details: BadgeTextDetails): Promise<void>;
    setBadgeText(details: BadgeTextDetails, callback: () => void): void;
    setBadgeText(details: BadgeTextDetails, callback?: () => void): Promise<void> | void;

    setBadgeBackgroundColor(details: BadgeBackgroundColorDetails): Promise<void>;
    setBadgeBackgroundColor(details: BadgeBackgroundColorDetails, callback: () => void): void;
    setBadgeBackgroundColor(details: BadgeBackgroundColorDetails, callback?: () => void): Promise<void> | void;
}


export class BrowserApplicationActionApi {
    constructor(private browserApi: IActionApi) { }

    setBadgeText(details: BadgeTextDetails): Promise<void> {
        return this.browserApi.setBadgeText(details);
    }

    setBadgeBackgroundColor(details: BadgeBackgroundColorDetails): Promise<void> {
        return this.browserApi.setBadgeBackgroundColor(details);
    }
}