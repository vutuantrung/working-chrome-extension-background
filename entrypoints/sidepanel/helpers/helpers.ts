import { http } from "../helpers/helpers-http";
import { GetProfileCasesResponse, ImageItem, ImageMeta, Persona, PlatformId, ProfileCase, SavedImage } from "../types/types";
import { localStorageService } from "../application/services/SidepanelServices";
import {
    PLATFORM_CHANGED_EVENT,
    PLATFORM_LABELS,
    SELECTED_PLATFORM_KEY
} from "./constants";
import { useState, useEffect } from "react";
import { AppLanguage, translate } from "./i18n";

export function formatTime(timestamp: number) {
    const date = new Date(timestamp);
    return date.toLocaleTimeString("en-US", {
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
    });
};

export function formatDuration(start: number, end?: number) {
    const duration = (end || Date.now()) - start;
    const seconds = Math.floor(duration / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);

    if (hours > 0) {
        return `${hours}h ${minutes % 60}m`;
    } else if (minutes > 0) {
        return `${minutes}m ${seconds % 60}s`;
    } else {
        return `${seconds}s`;
    }
};

export function formatBytes(bytes: number, decimals: number = 2): string {
    if (bytes < 0) return "0 B";
    if (bytes < 1_000) return `${bytes} B`;
    if (bytes < 1_000_000) return `${(bytes / 1_000).toFixed(decimals)} KB`;
    return `${(bytes / 1_000_000).toFixed(decimals)} MB`;
};

export function normalizeSameSite(value: any) {
    if (value === "no_restriction") return "no_restriction" as const;
    if (value === "lax") return "lax" as const;
    if (value === "strict") return "strict" as const;
    return "unspecified" as const;
};

export function itemKey(item: ImageItem): string {
    return item.kind === "saved" ? item.image.id : String(item.timestamp);
};

export function defaultPendingMeta(timestamp: number): ImageMeta {
    return { name: "", description: "", capture_time: timestamp, capacity: 0 };
};

export function defaultSavedMeta(img: SavedImage): ImageMeta {
    return {
        name: img.name ?? "",
        description: img.description ?? "",
        capture_time: img.capture_time ?? Date.now(),
        capacity: img.capacity
    };
};

export function buildImageUrl(baseUrl: string, caseId: string, evidenId: string): string {
    return `${baseUrl}/profile-cases/${caseId}/evidens/${evidenId}`;
};

export function countryFlag(code: string) {
    if (!code || code.length !== 2) return "🌐";
    return String.fromCodePoint(
        ...code
            .toUpperCase()
            .split("")
            .map((c) => 0x1f1e0 - 65 + c.charCodeAt(0)),
    );
}

export function parseList(data: any): Persona[] {
    if (Array.isArray(data)) return data;
    if (Array.isArray(data?.data)) return data.data;
    return [];
}

export function parsePersonaRecord(data: unknown): Persona | null {
    if (!data || typeof data !== "object") return null;
    const row = data as Record<string, unknown>;
    if (row.data && typeof row.data === "object") {
        return row.data as Persona;
    }
    return row as Persona;
}

export function isTimeValid(time: string): boolean {
    // matches 00:00:00 to 23:59:59
    const regex = /^([01]\d|2[0-3]):([0-5]\d):([0-5]\d)$/;
    return regex.test(time);
}

export function isPlatformId(value: string | null | undefined): value is PlatformId {
    return ["facebook", "tiktok", "x", "threads", "youtube"].includes(value ?? "")
}

export function dataUrlToBlob(dataUrl: string): Blob {
    const [header, base64] = dataUrl.split(',');
    const mime = header.match(/:(.*?);/)?.[1] ?? 'image/png';
    const binary = atob(base64);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) {
        bytes[i] = binary.charCodeAt(i);
    }
    return new Blob([bytes], { type: mime });
}

export function useDebounce<T>(value: T, delay: number) {
    const [debouncedValue, setDebouncedValue] = useState(value);

    useEffect(() => {
        const handler = setTimeout(() => { setDebouncedValue(value); }, delay);
        return () => { clearTimeout(handler); };
    }, [value, delay]);

    return debouncedValue;
}

export function getPlatformLabel(id: PlatformId | string | null | undefined): string | null {
    if (!id || !isPlatformId(id)) return null;
    return PLATFORM_LABELS[id];
}

export function getSelectedPlatformId(): PlatformId | null {
    try {
        const id = localStorageService.getItem(SELECTED_PLATFORM_KEY);
        return isPlatformId(id) ? id : null;
    } catch {
        return null;
    }
}

export function setSelectedPlatformId(id: PlatformId): void {
    try {
        localStorageService.setItem(SELECTED_PLATFORM_KEY, id);
        window.dispatchEvent(
            new CustomEvent(PLATFORM_CHANGED_EVENT, { detail: { id } }),
        );
    } catch { }
}

export function getSelectedPlatformLabel(): string | null {
    return getPlatformLabel(getSelectedPlatformId());
}

export function getCaseStorageKey(caseId: string) {
    return `screenshots_${caseId}`;
}

export const getPageNumbers = (current: number, total: number): (number | string)[] => {
    const pages: (number | string)[] = [];
    if (total <= 5) {
        for (let i = 1; i <= total; i++) pages.push(i);
    } else {
        pages.push(1);
        let start = Math.max(2, current - 1);
        let end = Math.min(total - 1, current + 1);

        if (current <= 3) {
            end = 4;
        } else if (current >= total - 2) {
            start = total - 3;
        }

        if (start > 2) {
            pages.push("...");
        }
        for (let i = start; i <= end; i++) {
            pages.push(i);
        }
        if (end < total - 1) {
            pages.push("...");
        }
        pages.push(total);
    }
    return pages;
};




/** Format elapsed time from an API timestamp in milliseconds. */
export function formatTimeSince(timestamp: number, language: AppLanguage): string {
    const elapsed = Date.now() - timestamp;
    if (!Number.isFinite(elapsed)) return "";
    if (elapsed < 0) return translate(language, "inFuture");
    const minutes = Math.floor(elapsed / 60000);
    if (minutes < 1) return translate(language, "justUpdated");
    const units: [number, Intl.RelativeTimeFormatUnit][] = [
        [365 * 24 * 60, "year"],
        [30 * 24 * 60, "month"],
        [7 * 24 * 60, "week"],
        [24 * 60, "day"],
        [60, "hour"],
        [1, "minute"],
    ];
    const formatter = new Intl.RelativeTimeFormat(language === "vi" ? "vi-VN" : "en-US", { numeric: "always" });
    for (const [size, unit] of units) {
        if (minutes >= size) return formatter.format(-Math.floor(minutes / size), unit);
    }
    return translate(language, "justUpdated");
}