import type { BrowserScriptingPort } from "../../types/BrowserPorts";
export class BrowserScriptingAdapter implements BrowserScriptingPort {
  async executeInTab<TArgs extends unknown[]>(
    _tabId: number,
    func: (...args: TArgs) => unknown,
    args: TArgs,
  ): Promise<void> { await func(...args); }
}
