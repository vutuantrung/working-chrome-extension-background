/** Decode literal \\uXXXX sequences (e.g. Khmer/Vietnamese names from FB GraphQL). */

import { decodeUnicodeEscapes } from "./utils";
import { readTrimmedId } from "./utils";

function parsePayloadRoot(payload: unknown): any | null {
  let root: any = payload;
  if (typeof root === "string") {
    const trimmed = root.trim();
    if (!trimmed) return null;
    try {
      root = JSON.parse(trimmed);
    } catch {
      return null;
    }
  }
  if (!root || typeof root !== "object" || Array.isArray(root)) return null;
  return root;
}

/**
 * ProfileCometHeader only: data.user.profile_header_renderer.user (id + name).
 */
export function extractFacebookUserIdAndName(payload: unknown): { id: string; name: string } | null {
  const root = parsePayloadRoot(payload);
  if (!root) return null;

  const header = root.data?.user?.profile_header_renderer;
  if (!header || typeof header !== "object") return null;

  const headerUser = header.user;
  const profileUser = headerUser?.header_top_row?.profile_user;

  const id =
    readTrimmedId(headerUser?.id) ||
    readTrimmedId(profileUser?.id) ||
    readTrimmedId(root.data?.user?.id);

  const rawName =
    (typeof headerUser?.name === "string" && headerUser.name) ||
    (typeof profileUser?.name === "string" && profileUser.name) ||
    "";

  const name = decodeUnicodeEscapes(rawName.trim());
  if (!id || !name) return null;
  return { id, name };
}

/** Map value: decoded display name (legacy JSON blobs still supported). */
function resolveFacebookUserNameFromMapValue(value: string): string {
  if (typeof value !== "string") return "";
  const trimmed = value.trim();
  if (!trimmed) return "";

  if (trimmed.startsWith("{")) {
    const extracted = extractFacebookUserIdAndName(trimmed);
    if (extracted?.name) return extracted.name;
  }

  return decodeUnicodeEscapes(trimmed);
}

export function normalizeFacebookUserInfoMap(map: Record<string, string> | null | undefined): Record<string, string> {
  if (!map || typeof map !== "object") return {};
  const out: Record<string, string> = {};
  for (const [id, raw] of Object.entries(map)) {
    const key = readTrimmedId(id);
    if (!key) continue;
    const name = resolveFacebookUserNameFromMapValue(String(raw ?? ""));
    if (name) out[key] = name;
  }
  return out;
}
