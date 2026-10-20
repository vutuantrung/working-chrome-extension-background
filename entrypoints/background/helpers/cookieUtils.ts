import { SOCIAL_COOKIE_DOMAINS } from "@/utils/social-cookie-domains";

function cookieRemovalUrl(cookie: chromeApi.cookies.Cookie): string {
  const host = cookie.domain.startsWith(".")
    ? cookie.domain.slice(1)
    : cookie.domain;
  const path = cookie.path || "/";
  return `https://${host}${path}`;
}

export async function clearCookiesForDomain(domain: string): Promise<void> {
  return new Promise((resolve) => {
    chromeApi.cookies.getAll({ domain }, (cookies) => {
      const removePromises = (cookies || []).map(
        (cookie) =>
          new Promise<void>((res) => {
            chromeApi.cookies.remove(
              { url: cookieRemovalUrl(cookie), name: cookie.name },
              () => res(),
            );
          }),
      );
      Promise.all(removePromises).then(() => resolve());
    });
  });
}

export async function clearSocialPlatformCookies(): Promise<void> {
  await Promise.all(SOCIAL_COOKIE_DOMAINS.map((domain) => clearCookiesForDomain(domain)));
}
