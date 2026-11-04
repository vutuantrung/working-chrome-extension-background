export interface IBrowserWindowApi {
    isWindowClosed(windowId: number): boolean;
}

export class BrowserApplicationWindowApi {
    constructor(private browserApi: IBrowserWindowApi) { }

    isWindowClosed(windowId: number): boolean {
        return this.browserApi.isWindowClosed(windowId);
    }
}