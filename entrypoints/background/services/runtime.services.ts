export interface IRuntimeService {
    getRuntimeLastError(): Error | null;
    getManifest(): any;
}

export class RuntimeService {
    constructor() { }
    getRuntimeLastError(): Error | null {
        throw new Error("Method not implemented.");
    }
    getManifest(): any {
        throw new Error("Method not implemented.");
    }
}