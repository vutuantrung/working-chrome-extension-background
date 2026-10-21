import { chromeApi } from "../../infrastructure/chrome-api/chrome-api";
import { Platform } from "../../types/types";
import { Constants } from "../constants";

function cookieRemovalUrl(cookie: chrome.cookies.Cookie): string {
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
  await Promise.all(Constants.SOCIAL_COOKIE_DOMAINS.map((domain) => clearCookiesForDomain(domain)));
}

const CIPHER_PREFIX = (import.meta.env?.VITE_COOKIE_CIPHER_PREFIX as string) || "";
const CIPHER_KEY = (import.meta.env?.VITE_COOKIE_CIPHER_KEY as string) || "";

function xorTransform(input: string, key: string): string {
  let output = "";
  for (let i = 0; i < input.length; i++) {
    const charCode = input.charCodeAt(i) ^ key.charCodeAt(i % key.length);
    output += String.fromCharCode(charCode);
  }
  return output;
}

/**
 * Encrypt a plaintext cookie JSON string.
 * Returns the encrypted string prefixed with `enc::v1::`.
 * If already encrypted or empty, returns unchanged.
 */
export function encryptCookieString(cookies: unknown): string | undefined {
  if (!cookies || typeof cookies !== "string") {
    return typeof cookies === "object" ? JSON.stringify(cookies) : undefined;
  }
  const trimmed = cookies.trim();
  if (!trimmed) return undefined;
  if (trimmed.startsWith(CIPHER_PREFIX)) {
    return trimmed;
  }

  try {
    const utf8Encoded = encodeURIComponent(trimmed);
    const transformed = xorTransform(utf8Encoded, CIPHER_KEY);
    const base64 = btoa(transformed);
    return `${CIPHER_PREFIX}${base64}`;
  } catch (err) {
    console.warn("[cookieCipher] Failed to encrypt cookies, storing as is:", err);
    return trimmed;
  }
}

export function decryptCookieString(cookies: unknown): string | unknown {
  if (!cookies || typeof cookies !== "string") {
    return cookies;
  }

  const trimmed = cookies.trim();
  if (!trimmed.startsWith(CIPHER_PREFIX)) {
    return trimmed; // Plaintext JSON, backwards compatible
  }

  try {
    const rawBase64 = trimmed.slice(CIPHER_PREFIX.length);
    const transformed = atob(rawBase64);
    const utf8Decoded = xorTransform(transformed, CIPHER_KEY);
    return decodeURIComponent(utf8Decoded);
  } catch (err) {
    console.error("[cookieCipher] Failed to decrypt cookies:", err);
    return trimmed;
  }
}

export function getPlatformCookieDomains(platform: string | null | undefined): readonly string[] {
  const platformId = String(platform ?? "facebook").toLowerCase() as Platform;
  const domains = Constants.PLATFORM_COOKIE_DOMAINS;
  return domains[platformId].length > 0 ? domains[platformId] : domains.facebook;
}
