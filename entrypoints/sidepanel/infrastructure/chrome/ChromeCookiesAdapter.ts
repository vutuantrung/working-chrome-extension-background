import type {
  BrowserCookie,
  BrowserCookiesPort,
  CookieSetDetails,
} from "../../types/BrowserPorts";

const toBrowserCookie = (cookie: chrome.cookies.Cookie): BrowserCookie => ({
  name: cookie.name,
  value: cookie.value,
  domain: cookie.domain,
  path: cookie.path,
  secure: cookie.secure,
  httpOnly: cookie.httpOnly,
  sameSite: cookie.sameSite,
  session: cookie.session,
  expirationDate: cookie.expirationDate,
});

export class ChromeCookiesAdapter implements BrowserCookiesPort {
  async getAllByDomain(domain: string): Promise<BrowserCookie[]> {
    const cookies = await chrome.cookies.getAll({ domain });
    return cookies.map(toBrowserCookie);
  }

  async set(details: CookieSetDetails): Promise<BrowserCookie | null> {
    const cookie = await chrome.cookies.set(details as chrome.cookies.SetDetails);
    return cookie ? toBrowserCookie(cookie) : null;
  }

  async remove(url: string, name: string): Promise<void> {
    await chrome.cookies.remove({ url, name });
  }
}
