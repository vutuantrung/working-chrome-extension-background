import type {
  ExtensionRuntimePort,
  RuntimeMessage,
  RuntimeMessageListener,
} from "../../types/BrowserPorts";

/**
 * Standalone-web runtime used when the sidepanel is mounted outside Chrome.
 * Messages are surfaced as DOM CustomEvents so a host application can bridge
 * them to its own backend/runtime without changing the UI.
 */
export class BrowserRuntimeAdapter implements ExtensionRuntimePort {
  async sendMessage<T = any>(message: RuntimeMessage): Promise<T> {
    if (typeof window !== "undefined") {
      window.dispatchEvent(
        new CustomEvent("sidepanel:runtime-message", { detail: message }),
      );
    }
    return undefined as T;
  }

  sendMessageWithCallback<T = any>(
    message: RuntimeMessage,
    callback: (response: T) => void,
  ): void {
    void this.sendMessage<T>(message).then(callback);
  }

  subscribe(listener: RuntimeMessageListener): () => void {
    if (typeof window === "undefined") return () => {};
    const handler = (event: Event) => {
      const custom = event as CustomEvent;
      listener(custom.detail, {}, () => undefined);
    };
    window.addEventListener("sidepanel:runtime-response", handler);
    return () => window.removeEventListener("sidepanel:runtime-response", handler);
  }

  getExtensionId(): string {
    return "standalone-sidepanel";
  }

  getVersion(fallback = "0.0.0"): string {
    return fallback;
  }
}
