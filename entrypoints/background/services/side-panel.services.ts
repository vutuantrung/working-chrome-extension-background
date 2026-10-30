export interface ISidePanelService {
    openSidePanel(windowId: number): Promise<void>;
}

export class SidePanelService implements ISidePanelService {
    constructor() { }

    openSidePanel(windowId: number): Promise<void> {
        throw new Error("Method not implemented.");
    }
}