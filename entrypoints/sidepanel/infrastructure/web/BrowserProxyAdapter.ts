import type { BrowserProxyPort } from "../../types/BrowserPorts";
export class BrowserProxyAdapter implements BrowserProxyPort { async getCurrent(): Promise<any | null> { return null; } }
