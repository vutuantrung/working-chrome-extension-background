enum ExecutionWorld {
    ISOLATED = "ISOLATED",
    MAIN = "MAIN",
}

type InjectionTarget = {
    tabId: number;
}

export type ScriptInjection<Args extends any[], Result> = {
    target: InjectionTarget;
    world?: `${ExecutionWorld}`;
} & ({
    func: never | undefined;
    files: string[]
} | {
    args: Args;
    func: (...args: Args) => Result;
    files?: never | undefined;
} | {
    func: () => Result;
    files?: never | undefined;
})

export interface InjectionResult<T extends any = any> {
    documentId: string;
    result?: T;
}

export interface IBrowserScriptingApi {
    executeScript<Args extends any[], Result>(injection: ScriptInjection<Args, Result>): Promise<Array<InjectionResult<Awaited<Result>>>>;
    executeScript<Args extends any[], Result>(injection: ScriptInjection<Args, Result>, callback: (results: Array<InjectionResult<Awaited<Result>>>) => void,
    ): void;
    executeScript<Args extends any[], Result>(injection: ScriptInjection<Args, Result>, callback?: (results: Array<InjectionResult<Awaited<Result>>>) => void,
    ): void | Promise<Array<InjectionResult<Awaited<Result>>>>;
}

export class BrowserApplicationScriptingApi {
    constructor(private browserApi: IBrowserScriptingApi) { }

    executeScript<Args extends any[], Result>(injection: ScriptInjection<Args, Result>, callback?: (results: Array<InjectionResult<Awaited<Result>>>) => void,
    ): void | Promise<Array<InjectionResult<Awaited<Result>>>> {
        return this.browserApi.executeScript(injection, callback);
    }
}