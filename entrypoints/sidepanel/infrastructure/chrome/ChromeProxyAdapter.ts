import type { BrowserProxyPort } from "../../types/BrowserPorts";

export class ChromeProxyAdapter implements BrowserProxyPort {
  async getCurrent(): Promise<any | null> {
    try {
      const proxyApi = (chrome as any)?.proxy?.settings;
      if (!proxyApi?.get) return null;
      return await new Promise((resolve) => {
        proxyApi.get({ incognito: false }, (details: any) => {
          resolve(details?.value ?? null);
        });
      });
    } catch {
      return null;
    }
  }
}
