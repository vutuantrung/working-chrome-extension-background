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
    console.warn(
      "[cookieCipher] Failed to encrypt cookies, storing as is:",
      err,
    );
    return trimmed;
  }
}

/**
 * Decrypt an encrypted cookie string back into its original JSON string.
 * If the input is not encrypted (e.g. legacy plaintext JSON), returns it as is.
 */
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
