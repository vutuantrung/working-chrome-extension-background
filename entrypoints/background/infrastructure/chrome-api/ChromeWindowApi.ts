import { IBrowserWindowApi } from "../../services/window.api";
import { chromeApi } from "./chrome-api";

export class ChromeWindowApi implements IBrowserWindowApi {
    constructor() { }

    isWindowClosed(windowId: number): boolean {
        return windowId === chromeApi.windows.WINDOW_ID_NONE;
    }
}