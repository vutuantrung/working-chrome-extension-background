import { IProxyService } from "../../services/proxy.services";
import { Message, ProxyHealth } from "../../types/types";

interface Proxy {
    host: string;
    port: string
}

export class ChromeProxyService implements IProxyService {
    constructor() {

    }
    handleProxy(message: Message, sendResponse: (resp: any) => void): Promise<void> {
        throw new Error("Method not implemented.");
    }
    checkProxyStatus(proxyData: ProxyHealth): Promise<void> {
        throw new Error("Method not implemented.");
    }

    storeProxyData(proxyData: ProxyHealth): void {
        throw new Error("Method not implemented.");
    }

    clearProxy(): void {
        throw new Error("Method not implemented.");
    }

    setProxy(httpProxy?: Proxy, httpsProxy?: Proxy): void {
        throw new Error("Method not implemented.");
    }

    getProxySettings(): any {
        throw new Error("Method not implemented.");
    }
}