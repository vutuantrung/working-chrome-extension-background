import { IRuntimeService } from "../../services/runtime.services";

export class ChromeRuntimeService implements IRuntimeService {
    constructor() { }
    getRuntimeLastError(): Error | null {
        throw new Error("Method not implemented.");
    }
    getManifest() {
        throw new Error("Method not implemented.");
    }
}