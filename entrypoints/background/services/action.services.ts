export interface IActionService {
    setBadgeText(details: any): Promise<void>;
    setBadgeBackgroundColor(details: any): Promise<void>;
}

export class ActionService {
    constructor() { }

    setBadgeText(details: any): Promise<void> {
        throw new Error("Method not implemented.");
    }

    setBadgeBackgroundColor(details: any): Promise<void> {
        throw new Error("Method not implemented.");
    }
}