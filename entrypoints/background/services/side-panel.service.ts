import { chromeApi } from "../infrastructure/chrome-api/chrome-api";
export const openSidePanel = (windowId: number) => chromeApi.sidePanel.open({ windowId });
