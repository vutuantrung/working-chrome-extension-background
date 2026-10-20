import { vi } from "vitest";

/**
 * Opt-in Chrome API mock for background unit tests.
 * Install it BEFORE importing any module that reads globalThis.chrome.
 * Deliberately implements only the APIs used by a given test.
 */
export function createChromeMock() {
  const storage = new Map<string, unknown>();
  const listeners = new Set<(changes: unknown, area: string) => void>();

  const local = {
    get: vi.fn(async (keys?: string | string[] | Record<string, unknown> | null) => {
      const requested = typeof keys === "string" ? [keys] : Array.isArray(keys) ? keys : keys && typeof keys === "object" ? Object.keys(keys) : [...storage.keys()];
      const result: Record<string, unknown> = keys && !Array.isArray(keys) && typeof keys === "object" ? { ...keys } : {};
      for (const key of requested) if (storage.has(key)) result[key] = storage.get(key);
      return result;
    }),
    set: vi.fn(async (entries: Record<string, unknown>) => {
      const changes: Record<string, { oldValue: unknown; newValue: unknown }> = {};
      for (const [key, value] of Object.entries(entries)) {
        changes[key] = { oldValue: storage.get(key), newValue: value };
        storage.set(key, value);
      }
      for (const callback of listeners) callback(changes, "local");
    }),
    remove: vi.fn(async (keys: string | string[]) => {
      for (const key of [keys].flat()) storage.delete(key);
    }),
    clear: vi.fn(async () => storage.clear()),
  };
  const alarms = new Map<string, chrome.alarms.Alarm>();
  return {
    storage: {
      local,
      onChanged: {
        addListener: vi.fn((callback: (changes: unknown, area: string) => void) => listeners.add(callback)),
        removeListener: vi.fn((callback: (changes: unknown, area: string) => void) => listeners.delete(callback)),
      },
    },
    alarms: {
      create: vi.fn(async (name: string, info: chrome.alarms.AlarmCreateInfo) => {
        alarms.set(name, { name, scheduledTime: Date.now() + (info.delayInMinutes ?? 0) * 60_000, periodInMinutes: info.periodInMinutes });
      }),
      get: vi.fn(async (name: string) => alarms.get(name)),
      clear: vi.fn(async (name: string) => alarms.delete(name)),
      getAll: vi.fn(async () => [...alarms.values()]),
    },
    runtime: {
      id: "background-test-extension",
      onMessage: { addListener: vi.fn(), removeListener: vi.fn() },
    },
    __storage: storage,
    __alarms: alarms,
  };
}

export function installChromeMock() {
  const mock = createChromeMock();
  vi.stubGlobal("chrome", mock);
  return mock;
}
