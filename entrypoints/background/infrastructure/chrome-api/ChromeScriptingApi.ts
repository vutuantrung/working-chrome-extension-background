import { IBrowserScriptingApi, ScriptInjection } from "../../services/scripting.api";

export class ChromeScriptingApi implements IBrowserScriptingApi {
    executeScript<Args extends any[], Result>(
        injection: ScriptInjection<Args, Result>
    ): Promise<any>;
    executeScript<Args extends any[], Result>(
        injection: ScriptInjection<Args, Result>,
        callback: (results: any) => void
    ): void;
    executeScript<Args extends any[], Result>(
        injection: ScriptInjection<Args, Result>,
        callback?: (results: any) => void
    ): Promise<any> | void {
        if (callback) {
            return chrome.scripting.executeScript(injection, callback);
        }
        return chrome.scripting.executeScript(injection);
    }
}