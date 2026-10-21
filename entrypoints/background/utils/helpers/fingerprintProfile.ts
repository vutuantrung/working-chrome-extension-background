import { hasExtensionConfigId } from "./proxy";

export function resolveFingerprintOwnerId(input: {
  extensionConfigId: unknown;
  extensionUserId?: unknown;
  personaId?: unknown;
  fallbackUserId?: unknown;
}): string | undefined {
  if (hasExtensionConfigId(input.extensionConfigId)) {
    const id = input.extensionUserId ?? input.fallbackUserId ?? undefined;
    if (id === null || id === undefined) return undefined;
    const s = String(id).trim();
    return s.length > 0 ? s : undefined;
  }

  if (input.personaId === null || input.personaId === undefined) {
    return undefined;
  }
  const persona = String(input.personaId).trim();
  return persona.length > 0 ? persona : undefined;
}
