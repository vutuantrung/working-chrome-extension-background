export interface IWindowService {
    isWindowClosed(windowId: number): boolean;
}

export class WindowService implements IWindowService {
    constructor() { }

    isWindowClosed(windowId: number): boolean {
        throw new Error("Method not implemented.");
    }
}