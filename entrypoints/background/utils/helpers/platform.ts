import { Platform } from "../../types/types";
import { Constants } from "../constants";

export function isPlatformId(value: string | null | undefined): value is Platform {
  return ["facebook", "tiktok", "x", "threads", "youtube"].includes(value ?? "")
}

export function getSelectedPlatformId(): Platform | null {
  try {
    const id = localStorage.getItem(Constants.SELECTED_PLATFORM_KEY);
    return isPlatformId(id) ? id : null;
  } catch {
    return null;
  }
}

export function getPlatformLabel(id: Platform | string | null | undefined): string | null {
  if (!id || !isPlatformId(id)) return null;
  return Constants.PLATFORM_LABELS[id];
}

export function getSelectedPlatformLabel(): string | null {
  return getPlatformLabel(getSelectedPlatformId());
}

export function setSelectedPlatformId(id: Platform): void {
  try {
    localStorage.setItem(Constants.SELECTED_PLATFORM_KEY, id);
    window.dispatchEvent(new CustomEvent(Constants.PLATFORM_CHANGED_EVENT, { detail: { id } }));
  } catch { }
}
