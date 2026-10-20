export type StorageChange<T = unknown> = {
  oldValue?: T;
  newValue?: T;
};

export type StorageChangeMap = Record<string, StorageChange>;
export type StorageChangeListener = (
  changes: StorageChangeMap,
  areaName: string,
) => void;

export type StorageGetKeys =
  | string
  | string[]
  | Record<string, unknown>
  | null
  | undefined;

export interface ExtensionStoragePort {
  get<T extends Record<string, any> = Record<string, any>>(keys?: StorageGetKeys): Promise<T>;
  getValue<T = unknown>(key: string, fallback?: T): Promise<T | undefined>;
  set(items: Record<string, any>): Promise<void>;
  setValue<T>(key: string, value: T): Promise<void>;
  remove(keys: string | string[]): Promise<void>;
  clear(): Promise<void>;
  subscribe(listener: StorageChangeListener): () => void;
  subscribeKey<T = unknown>(
    key: string,
    listener: (newValue: T | undefined, oldValue: T | undefined) => void,
  ): () => void;
}

export interface AppStoragePort {
  getItem<T = unknown>(key: string): Promise<T | null>;
  setItem<T = unknown>(key: string, value: T): Promise<void>;
  removeItem(key: string): Promise<void>;
}

export interface LocalUiStoragePort {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
  clear(): void;
  getBoolean(key: string, fallback?: boolean): boolean;
  setBoolean(key: string, value: boolean): void;
  getJson<T>(key: string, fallback?: T): T | null;
  setJson(key: string, value: unknown): void;
}

export interface RuntimeMessage {
  type: string;
  inputs?: unknown;
  [key: string]: unknown;
}

export type RuntimeMessageListener = (
  message: unknown,
  sender: unknown,
  sendResponse: (response?: unknown) => void,
) => unknown;

export interface ExtensionRuntimePort {
  sendMessage<T = any>(message: RuntimeMessage): Promise<T>;
  sendMessageWithCallback<T = any>(
    message: RuntimeMessage,
    callback: (response: T) => void,
  ): void;
  subscribe(listener: RuntimeMessageListener): () => void;
  getExtensionId(): string;
  getVersion(fallback?: string): string;
}

export interface AppTab {
  id?: number;
  windowId?: number;
  url?: string;
  pendingUrl?: string;
  title?: string;
  status?: string;
}

export interface BrowserTabsPort {
  getActiveTab(): Promise<AppTab | null>;
  getTab(tabId: number): Promise<AppTab | null>;
  createTab(url: string, active?: boolean): Promise<AppTab | null>;
}

export type SameSiteValue =
  | "no_restriction"
  | "lax"
  | "strict"
  | "unspecified";

export interface BrowserCookie {
  name: string;
  value: string;
  domain: string;
  path?: string;
  secure?: boolean;
  httpOnly?: boolean;
  sameSite?: SameSiteValue | string;
  session?: boolean;
  expirationDate?: number;
}

export interface CookieSetDetails {
  url: string;
  name: string;
  value: string;
  domain?: string;
  path?: string;
  secure?: boolean;
  httpOnly?: boolean;
  sameSite?: SameSiteValue;
  expirationDate?: number;
}

export interface BrowserCookiesPort {
  getAllByDomain(domain: string): Promise<BrowserCookie[]>;
  set(details: CookieSetDetails): Promise<BrowserCookie | null>;
  remove(url: string, name: string): Promise<void>;
}

export interface BrowserProxyPort {
  getCurrent(): Promise<any | null>;
}

export interface BrowserScriptingPort {
  executeInTab<TArgs extends unknown[]>(
    tabId: number,
    func: (...args: TArgs) => unknown,
    args: TArgs,
  ): Promise<void>;
}
