import { ChromeExtensionStorageAdapter } from "../../infrastructure/chrome/ChromeExtensionStorageAdapter";
import { ChromeAppStorageAdapter } from "../../infrastructure/chrome/ChromeAppStorageAdapter";
import { BrowserLocalStorageAdapter } from "../../infrastructure/web/BrowserLocalStorageAdapter";
import { ChromeRuntimeAdapter } from "../../infrastructure/chrome/ChromeRuntimeAdapter";
import { ChromeTabsAdapter } from "../../infrastructure/chrome/ChromeTabsAdapter";
import { ChromeCookiesAdapter } from "../../infrastructure/chrome/ChromeCookiesAdapter";
import { ChromeProxyAdapter } from "../../infrastructure/chrome/ChromeProxyAdapter";
import { ChromeScriptingAdapter } from "../../infrastructure/chrome/ChromeScriptingAdapter";
import screenshotSelector from "../../infrastructure/chrome/screenshotSelector";

import { BrowserRuntimeAdapter } from "../../infrastructure/web/BrowserRuntimeAdapter";
import { BrowserExtensionStorageAdapter } from "../../infrastructure/web/BrowserExtensionStorageAdapter";
import { BrowserAppStorageAdapter } from "../../infrastructure/web/BrowserAppStorageAdapter";
import { BrowserTabsAdapter } from "../../infrastructure/web/BrowserTabsAdapter";
import { BrowserCookiesAdapter } from "../../infrastructure/web/BrowserCookiesAdapter";
import { BrowserProxyAdapter } from "../../infrastructure/web/BrowserProxyAdapter";
import { BrowserScriptingAdapter } from "../../infrastructure/web/BrowserScriptingAdapter";

import { ExtensionCommandService } from "./ExtensionCommandService";
import { ScreenshotCaptureService } from "./ScreenshotCaptureService";
import type {
  AppStoragePort,
  BrowserCookiesPort,
  BrowserProxyPort,
  BrowserScriptingPort,
  BrowserTabsPort,
  ExtensionRuntimePort,
  ExtensionStoragePort,
} from "../../types/BrowserPorts";

export const isChromeExtensionEnvironment =
  typeof globalThis.chrome !== "undefined" &&
  !!globalThis.chrome?.runtime?.id;

export const extensionStorage: ExtensionStoragePort = isChromeExtensionEnvironment
  ? new ChromeExtensionStorageAdapter()
  : new BrowserExtensionStorageAdapter();

export const appStorage: AppStoragePort = isChromeExtensionEnvironment
  ? new ChromeAppStorageAdapter()
  : new BrowserAppStorageAdapter();

export const localStorageService = new BrowserLocalStorageAdapter();

export const extensionRuntime: ExtensionRuntimePort = isChromeExtensionEnvironment
  ? new ChromeRuntimeAdapter()
  : new BrowserRuntimeAdapter();

export const browserTabs: BrowserTabsPort = isChromeExtensionEnvironment
  ? new ChromeTabsAdapter()
  : new BrowserTabsAdapter();

export const browserCookies: BrowserCookiesPort = isChromeExtensionEnvironment
  ? new ChromeCookiesAdapter()
  : new BrowserCookiesAdapter();

export const browserProxy: BrowserProxyPort = isChromeExtensionEnvironment
  ? new ChromeProxyAdapter()
  : new BrowserProxyAdapter();

export const browserScripting: BrowserScriptingPort = isChromeExtensionEnvironment
  ? new ChromeScriptingAdapter()
  : new BrowserScriptingAdapter();

export const extensionCommands = new ExtensionCommandService(extensionRuntime);
export const screenshotCapture = new ScreenshotCaptureService(
  browserTabs,
  browserScripting,
  extensionStorage,
  screenshotSelector,
);
