import type {
  ExtensionRuntimePort,
  RuntimeMessage,
  RuntimeMessageListener,
} from "../../types/BrowserPorts";

export class ChromeRuntimeAdapter implements ExtensionRuntimePort {
  async sendMessage<T = any>(message: RuntimeMessage): Promise<T> {
    return (await chrome.runtime.sendMessage(message)) as T;
  }

  sendMessageWithCallback<T = any>(
    message: RuntimeMessage,
    callback: (response: T) => void,
  ): void {
    chrome.runtime.sendMessage(message, callback as any);
  }

  subscribe(listener: RuntimeMessageListener): () => void {
    chrome.runtime.onMessage.addListener(listener as any);
    return () => chrome.runtime.onMessage.removeListener(listener as any);
  }

  getExtensionId(): string {
    return chrome.runtime.id;
  }

  getVersion(fallback = "0.0.0"): string {
    try {
      return chrome.runtime.getManifest()?.version || fallback;
    } catch {
      return fallback;
    }
  }
}
