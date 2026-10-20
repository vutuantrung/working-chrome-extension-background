import type { BrowserScriptingPort } from "../../types/BrowserPorts";

export class ChromeScriptingAdapter implements BrowserScriptingPort {
  async executeInTab<TArgs extends unknown[]>(
    tabId: number,
    func: (...args: TArgs) => unknown,
    args: TArgs,
  ): Promise<void> {
    await chrome.scripting.executeScript({
      target: { tabId },
      func: func as any,
      args: args as any,
    });
  }
}
