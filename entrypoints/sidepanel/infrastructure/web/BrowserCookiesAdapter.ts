import type { BrowserCookie, BrowserCookiesPort, CookieSetDetails } from "../../types/BrowserPorts";
export class BrowserCookiesAdapter implements BrowserCookiesPort {
  async getAllByDomain(_domain: string): Promise<BrowserCookie[]> { return []; }
  async set(details: CookieSetDetails): Promise<BrowserCookie | null> {
    if (typeof document === "undefined") return null;
    document.cookie = `${encodeURIComponent(details.name)}=${encodeURIComponent(details.value)}; path=${details.path ?? "/"}`;
    return { name: details.name, value: details.value, domain: details.domain ?? location.hostname, path: details.path ?? "/" };
  }
  async remove(_url: string, name: string): Promise<void> {
    if (typeof document !== "undefined") document.cookie = `${encodeURIComponent(name)}=; Max-Age=0; path=/`;
  }
}
