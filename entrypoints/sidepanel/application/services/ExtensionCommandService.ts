import type { ExtensionRuntimePort } from "../../types/BrowserPorts";

export class ExtensionCommandService {
  constructor(private readonly runtime: ExtensionRuntimePort) {}

  getExtensionId(): string {
    return this.runtime.getExtensionId();
  }

  getVersion(fallback = "0.0.0"): string {
    return this.runtime.getVersion(fallback);
  }

  subscribe(listener: Parameters<ExtensionRuntimePort["subscribe"]>[0]) {
    return this.runtime.subscribe(listener);
  }

  async getSettings<T = any>(): Promise<T | null> {
    const response = await this.runtime.sendMessage<any>({ type: "GET_SETTINGS" });
    return response?.data ?? null;
  }

  async getUserInfo<T = any>(): Promise<T | null> {
    const response = await this.runtime.sendMessage<any>({ type: "GET_USERINFO" });
    return response?.data ?? null;
  }

  async saveSettings(data: unknown): Promise<boolean> {
    const response = await this.runtime.sendMessage<any>({
      type: "SET_SETTINGS",
      inputs: { data },
    });
    return response?.success === true;
  }

  async initializeAfterLogin(
    extensionSession: unknown,
    context: Record<string, unknown> = {},
  ): Promise<void> {
    await this.runtime.sendMessage({
      type: "INITIALIZE_AFTER_LOGIN",
      inputs: {
        extension_session: extensionSession,
        ...context,
      },
    });
  }

  async startPeriodicCheck(): Promise<void> {
    await this.runtime.sendMessage({ type: "START_PERIODIC_CHECK" });
  }

  async clearDataAfterLogout(): Promise<void> {
    await this.runtime.sendMessage({ type: "CLEAR_DATA_AFTER_LOGOUT" });
  }

  async setProxy(extensionProxy: unknown): Promise<void> {
    await this.runtime.sendMessage({
      type: "SET_PROXY",
      inputs: { extension_proxy: extensionProxy },
    });
  }

  async getFacebookAccountCache<T = any>(): Promise<T | null> {
    const response = await this.runtime.sendMessage<any>({
      type: "GET_FB_ACCOUNT_CACHE",
    });
    return response?.ok && response?.data ? response.data : null;
  }

  async cancelTask(taskId: string): Promise<void> {
    await this.runtime.sendMessage({
      type: "CANCEL_TASK",
      inputs: { taskId },
    });
  }
}
