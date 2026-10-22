/** Decode literal \\uXXXX sequences (e.g. Khmer/Vietnamese names from FB GraphQL). */
export function decodeUnicodeEscapes(value: string): string {
  if (typeof value !== "string" || !value) return "";
  if (!/\\u[0-9a-fA-F]{4}/.test(value)) return value;
  try {
    return JSON.parse(`"${value.replace(/\\/g, "\\\\").replace(/"/g, '\\"')}"`);
  } catch {
    return value.replace(/\\u([0-9a-fA-F]{4})/gi, (_, hex) =>
      String.fromCharCode(parseInt(hex, 16)),
    );
  }
}

function readId(value: unknown): string {
  if (typeof value === "string" && value.trim()) return value.trim();
  if (typeof value === "number" && Number.isFinite(value)) return String(value);
  return "";
}

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
    readId(headerUser?.id) ||
    readId(profileUser?.id) ||
    readId(root.data?.user?.id);

  const rawName =
    (typeof headerUser?.name === "string" && headerUser.name) ||
    (typeof profileUser?.name === "string" && profileUser.name) ||
    "";

  const name = decodeUnicodeEscapes(rawName.trim());
  if (!id || !name) return null;
  return { id, name };
}

export function isProfileCometHeaderPayload(payload: unknown): boolean {
  const root = parsePayloadRoot(payload);
  return Boolean(root?.data?.user?.profile_header_renderer);
}

/** Map value: decoded display name (legacy JSON blobs still supported). */
export function resolveFacebookUserNameFromMapValue(value: string): string {
  if (typeof value !== "string") return "";
  const trimmed = value.trim();
  if (!trimmed) return "";

  if (trimmed.startsWith("{")) {
    const extracted = extractFacebookUserIdAndName(trimmed);
    if (extracted?.name) return extracted.name;
  }

  return decodeUnicodeEscapes(trimmed);
}

export function normalizeFacebookUserInfoMap(
  map: Record<string, string> | null | undefined,
): Record<string, string> {
  if (!map || typeof map !== "object") return {};
  const out: Record<string, string> = {};
  for (const [id, raw] of Object.entries(map)) {
    const key = readId(id);
    if (!key) continue;
    const name = resolveFacebookUserNameFromMapValue(String(raw ?? ""));
    if (name) out[key] = name;
  }
  return out;
}

export function buildFacebookUserInfoMapEntry(identity: {
  id: string;
  name: string;
}): Record<string, string> {
  return { [identity.id]: identity.name };
}
