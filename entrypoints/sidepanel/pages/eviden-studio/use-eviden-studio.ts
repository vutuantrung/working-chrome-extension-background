import { AxiosError } from "axios";
import { useState, useEffect, useCallback, useRef } from "react";
import type { ProfileCase } from "../../types/types";
import {
  extensionStorage,
  screenshotCapture,
} from "../../../sidepanel/application/services/SidepanelServices";
import { ImageItem, ImageMeta, SavedImage } from "../../types/types";
import {
  buildImageUrl,
  defaultPendingMeta,
  defaultSavedMeta,
  getCaseStorageKey,
  itemKey
} from "../../helpers/helpers";
import { DEFAULT_CASE_ID } from "../../helpers/constants";
import api from "../../infrastructure/api";


export interface Screenshot {
  dataUrl: string;
  timestamp: number;
}

interface UseEvidenStudioOptions {
  selectedCase: ProfileCase;
  onSaved?: (updatedCase: ProfileCase, currentCase: ProfileCase) => void;
}

export function useEvidenStudio({ selectedCase, onSaved }: UseEvidenStudioOptions) {
  const [pending, setPending] = useState<Screenshot[]>([]);
  const [deletedIds, setDeletedIds] = useState<Set<string>>(new Set());
  const [metaMap, setMetaMap] = useState<Record<string, ImageMeta>>({});
  const [caseFields, setCaseFields] = useState({
    name: selectedCase.name ?? "",
    profile_url: selectedCase.profile_url ?? "",
    origin_url: selectedCase.origin_url ?? "",
    description: selectedCase.description ?? ""
  });

  const [capturing, setCapturing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const initialMetaMapRef = useRef<Record<string, ImageMeta>>({});
  const initialCaseFieldsRef = useRef({
    name: selectedCase.name ?? "",
    profile_url: selectedCase.profile_url ?? "",
    origin_url: selectedCase.origin_url ?? "",
    description: selectedCase.description ?? ""
  });
  const storageKey = getCaseStorageKey(selectedCase.id);
  const isNewCase = selectedCase.id === DEFAULT_CASE_ID;
  // const baseUrl = import.meta.env.VITE_AXIOS_BASE_URL as string;
  const baseUrl = 'https://services-delivery-dev.intelsys.group';

  // ── Seed metaMap from server images ───────────────────────────────────────
  useEffect(() => {
    const initial: Record<string, ImageMeta> = {};
    (selectedCase.profileCaseEvidens ?? []).forEach((e) => {
      const img: SavedImage = {
        id: e.id,
        url: buildImageUrl(baseUrl, selectedCase.id, e.id),
        name: e.name ?? "",
        description: e.description ?? "",
        capture_time: e.capture_time ?? Date.now(),
        capacity: e.capacity,
      };
      initial[img.id] = defaultSavedMeta(img);
    });
    setMetaMap(initial);
    initialMetaMapRef.current = { ...initial };

    setDeletedIds(new Set());
    setError(null);
  }, [selectedCase.id]);

  useEffect(() => {
    const fields = {
      name: selectedCase.name ?? "",
      profile_url: selectedCase.profile_url ?? "",
      origin_url: selectedCase.origin_url ?? "",
      description: selectedCase.description ?? ""
    };
    setCaseFields(fields);
    initialCaseFieldsRef.current = { ...fields };
  }, [
    selectedCase.id,
    selectedCase.origin_url,
  ]);

  // ── Load pending screenshots from local storage ────────────────────────────
  useEffect(() => {
    extensionStorage.get([storageKey]);
  }, [storageKey]);

  // ── Seed metaMap when new pending shots arrive (after popup re-open) ──────
  useEffect(() => {
    setMetaMap((prev) => {
      const next = { ...prev };
      pending.forEach((s) => {
        const k = String(s.timestamp);
        if (!next[k]) next[k] = defaultPendingMeta(s.timestamp);
      });
      return next;
    });
  }, [pending]);

  // ── Derived values ────────────────────────────────────────────────────────

  /** Saved images whose name or description changed since last load/save */
  const changedSavedMeta = Object.entries(metaMap)
    .filter(([key, meta]) => {
      const initial = initialMetaMapRef.current[key];
      if (!initial) return false; // pending image, not a saved one
      return meta.name !== initial.name || meta.description !== initial.description;
    })
    .map(([id, meta]) => ({ id, meta }));

  const caseFieldsChanged =
    caseFields.name !== initialCaseFieldsRef.current.name ||
    caseFields.profile_url !== initialCaseFieldsRef.current.profile_url ||
    caseFields.origin_url !== initialCaseFieldsRef.current.origin_url ||
    caseFields.description !== initialCaseFieldsRef.current.description

  const hasChanges =
    caseFieldsChanged ||
    pending.length > 0 ||
    deletedIds.size > 0 ||
    changedSavedMeta.length > 0;

  /** Unified ordered list of saved + pending images for the grid */
  const items: ImageItem[] = [
    ...(selectedCase.profileCaseEvidens ?? [])
      // .filter((e) => !deletedIds.has(e.id))
      .map((e): ImageItem => ({
        kind: "saved",
        image: {
          id: e.id,
          url: buildImageUrl(baseUrl, selectedCase.id, e.id),
          name: e.name ?? "",
          description: e.description ?? "",
          capture_time: e.capture_time ?? Date.now(),
          capacity: e.capacity,
        },
      })),
    ...pending.map((p): ImageItem => ({
      kind: "pending",
      dataUrl: p.dataUrl,
      timestamp: p.timestamp,
    })),
  ];

  // ── Metadata helpers ──────────────────────────────────────────────────────

  const getMeta = useCallback((item: ImageItem): ImageMeta => {
    const k = itemKey(item);
    return metaMap[k] ?? (
      item.kind === "saved"
        ? defaultSavedMeta(item.image)
        : defaultPendingMeta(item.timestamp)
    );
  }, [metaMap]);

  const handleMetaChange = useCallback((key: string, patch: Partial<ImageMeta>) => {
    const changed = (prev: Record<string, ImageMeta>) => {
      const current = prev[key] ?? { name: "", description: "", capture_time: Date.now() };
      return { ...current, ...patch };
    };
    setMetaMap((prev) => ({
      ...prev,
      [key]: changed(prev),
    }));
  }, []);

  // ── Capture ───────────────────────────────────────────────────────────────

  const handleAddScreenshot = useCallback(async () => {
    setCapturing(true);
    setError(null);
    try {
      const result = await screenshotCapture.begin(selectedCase.id);
      if (result.success === false) {
        setError(result.error);
        setCapturing(false);
        return;
      }

      window.close();
    } catch (err) {
      console.error("Screenshot inject failed:", err);
      setError("Could not inject into this page. Try a regular website.");
      setCapturing(false);
    }
  }, [selectedCase.id]);

  /** Toggle a saved image as marked for deletion (undoable before save) */
  const handleToggleDelete = useCallback((imageId: string) => {
    setDeletedIds((prev) => {
      const next = new Set(prev);
      next.has(imageId) ? next.delete(imageId) : next.add(imageId);
      return next;
    });
  }, []);

  /** Immediately discard a locally captured pending image */
  const handleDeletePending = useCallback((timestamp: number) => {
    setPending((prev) => {
      const next = prev.filter((s) => s.timestamp !== timestamp);
      extensionStorage.set({ [storageKey]: next });
      return next;
    });
    setMetaMap((prev) => {
      const next = { ...prev };
      delete next[String(timestamp)];
      return next;
    });
  }, [storageKey]);

  const handleCaseFieldChange = useCallback(
    (patch: Partial<typeof caseFields>) => {
      setCaseFields((prev) => {
        const newCaseFields = { ...prev, ...patch }

        if (isNewCase) {
          extensionStorage.set({ newProfileCaseCache: newCaseFields });
        }

        return newCaseFields
      });
    },
    [isNewCase]);

  // ── Save ──────────────────────────────────────────────────────────────────

  const handleSave = useCallback(async () => {
    setSaving(true);
    setError(null);
    try {
      const pendingMeta = pending.map((p) => {
        const m = metaMap[String(p.timestamp)] ?? defaultPendingMeta(p.timestamp);
        return { name: m.name, description: m.description, capture_time: m.capture_time };
      });

      let updatedCase: ProfileCase = selectedCase;

      if (isNewCase) {
        // CREATE — single multipart POST with case info + images
        updatedCase = await api.profileCase.createProfileCase(
          { ...selectedCase, ...caseFields },
          pending.map((p) => p.dataUrl),
          pendingMeta,
        );
        await extensionStorage.remove("newProfileCaseCache");
      } else {
        const results = await Promise.allSettled([
          // 1. PATCH /cases/:id — case info + metadata edits + deletions (JSON)
          api.profileCase.patchCaseInfo(
            selectedCase.id!,
            {
              name: selectedCase.name !== caseFields.name ? caseFields.name : undefined,
              platform: selectedCase.platform,
              profile_url: selectedCase.profile_url !== caseFields.profile_url ? caseFields.profile_url : undefined,
              origin_url: selectedCase.origin_url !== caseFields.origin_url ? caseFields.origin_url : undefined,
              description: selectedCase.description !== caseFields.description ? caseFields.description : undefined,
            },
            changedSavedMeta.map(({ id, meta }) => ({
              id,
              name: meta.name,
              description: meta.description,
            })),
            Array.from(deletedIds),
          ),

          // 2. POST /cases/:id/images — new files only (multipart), skipped if none
          ...(pending.length > 0
            ? [api.profileCase.postCaseImages(
              selectedCase.id!,
              pending.map((p) => p.dataUrl),
              pendingMeta,
            )]
            : []
          ),
        ]);

        const failed = results.find((r) => r.status === "rejected");
        if (failed) throw (failed as PromiseRejectedResult).reason;
      }

      // Clear local state after successful save
      await extensionStorage.remove(storageKey);
      setPending([]);
      setDeletedIds(new Set());
      initialMetaMapRef.current = { ...metaMap };
      initialCaseFieldsRef.current = { ...caseFields };

      onSaved?.(updatedCase, selectedCase);
    } catch (err) {
      console.error("Save failed:", err);
      if (err instanceof AxiosError) {
        setError(`Save failed. ${err.response?.data?.error?.message ?? "Please try again."}`);
      } else {
        setError("Save failed. Please try again.");
      }
    } finally {
      setSaving(false);
    }
  }, [pending, deletedIds, metaMap, changedSavedMeta, isNewCase, selectedCase, storageKey, onSaved]);

  const dismissError = useCallback(() => setError(null), []);



  return {
    // State
    caseFields,
    items,
    pending,
    deletedIds,
    capturing,
    saving,
    error,
    isNewCase,
    hasChanges,

    // Metadata
    getMeta,
    handleMetaChange,

    // Actions
    handleCaseFieldChange,
    handleAddScreenshot,
    handleToggleDelete,
    handleDeletePending,
    handleSave,
    dismissError,
  };
}