import { Message, ProxyHealth } from "../types/types";

interface Proxy {
    host: string;
    port: string;
}

export interface IProxyService {
    getProxySettings(): any;
    clearProxy(): void;
    setProxy(httpProxy?: Proxy, httpsProxy?: Proxy): void;
    storeProxyData(proxyData: ProxyHealth): void;
    checkProxyStatus(proxyData: ProxyHealth): Promise<void>;
    handleProxy(message: Message, sendResponse: (resp: any) => void): Promise<void>;
}

export class ProxyService {
    constructor(private browserProxyService: IProxyService) { }
    storeProxyData(proxyData: ProxyHealth) {
        return this.browserProxyService.storeProxyData(proxyData);
    }
    getProxySettings(): any {
        return this.browserProxyService.getProxySettings();
    }
    setProxy(httpProxy?: Proxy, httpsProxy?: Proxy): void {
        return this.browserProxyService.setProxy(httpProxy, httpsProxy);
    }
    clearProxy(): void {
        return this.browserProxyService.clearProxy();
    }
    async checkProxyStatus(proxyData: ProxyHealth): Promise<void> {
        return this.browserProxyService.checkProxyStatus(proxyData);
    }
    async handleProxy(message: Message, sendResponse: (resp: any) => void): Promise<void> {
        return this.browserProxyService.handleProxy(message, sendResponse);
    }
}
