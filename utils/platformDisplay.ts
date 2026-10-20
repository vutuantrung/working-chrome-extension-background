export type PlatformId = "facebook" | "tiktok" | "x" | "threads" | "youtube";

export const SELECTED_PLATFORM_KEY = "selectedPlatform";

export const PLATFORM_LABELS: Record<PlatformId, string> = {
  facebook: "Facebook",
  tiktok: "TikTok",
  x: "X (Twitter)",
  threads: "Threads",
  youtube: "Youtube"
};

export function isPlatformId(value: string | null | undefined): value is PlatformId {
  return ["facebook", "tiktok", "x", "threads", "youtube"].includes(value ?? "")
}

export function getSelectedPlatformId(): PlatformId | null {
  try {
    const id = localStorage.getItem(SELECTED_PLATFORM_KEY);
    return isPlatformId(id) ? id : null;
  } catch {
    return null;
  }
}

export function getPlatformLabel(id: PlatformId | string | null | undefined): string | null {
  if (!id || !isPlatformId(id)) return null;
  return PLATFORM_LABELS[id];
}

export function getSelectedPlatformLabel(): string | null {
  return getPlatformLabel(getSelectedPlatformId());
}

export const PLATFORM_CHANGED_EVENT = "hydra:login-success-redirectplatform-changed";

export function setSelectedPlatformId(id: PlatformId): void {
  try {
    localStorage.setItem(SELECTED_PLATFORM_KEY, id);
    window.dispatchEvent(
      new CustomEvent(PLATFORM_CHANGED_EVENT, { detail: { id } }),
    );
  } catch { }
}
