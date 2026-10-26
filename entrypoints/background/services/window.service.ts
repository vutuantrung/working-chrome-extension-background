import { chromeApi } from "../infrastructure/chrome-api/chrome-api";
export const isWindowClosed = (windowId: number) => windowId === chromeApi.windows.WINDOW_ID_NONE;
