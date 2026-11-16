import axios, { AxiosInstance } from "axios";
import { RuntimeService } from "./runtime.services";

type UnauthorizedObserver = {
    captureGeneration(): number | undefined;
    recover(generation: number): Promise<void>;
};

export class HttpService {
    private readonly http: AxiosInstance;
    private observer?: UnauthorizedObserver;

    constructor(private readonly runtimeService: RuntimeService) {
        this.http = axios.create({
            baseURL: import.meta.env.VITE_AXIOS_BASE_URL || "http://localhost:3002",
            timeout: 60000,
            withCredentials: true,
        });

        // Keep generation metadata local; do not add it to HTTP headers.
        const generations = new WeakMap<object, number>();
        this.http.interceptors.request.use(config => {
            const url = (config.url || "").split("?")[0];
            if (!/\\/extension-sessions\\/(signin|signout)\\/?$/.test(url)) {
                const generation = this.observer?.captureGeneration();
                if (generation !== undefined) generations.set(config, generation);
            }
            return config;
        });

        this.http.interceptors.response.use(
            (response) => response,
            async (error) => {
                if (error.response?.status === 401) {
                    if (this.observer) {
                        const generation = error.config && generations.get(error.config);
                        if (generation !== undefined) {
                            // Do not await recovery in an interceptor: recovery
                            // itself performs HTTP operations on this instance.
                            void this.observer.recover(generation).catch(() => {});
                        }
                    } else if (typeof globalThis.window !== "undefined") {
                        window.dispatchEvent(new CustomEvent("AUTH_EXPIRED"));
                    } else {
                        this.runtimeService.getBrowserApi().sendMessage({ type: "AUTH_EXPIRED" }, () => {});
                    }
                }
                return Promise.reject(error);
            },
        );
    }

    observeUnauthorized(observer: UnauthorizedObserver): void {
        this.observer = observer;
    }

    getHttpInstance() {
        return this.http;
    }
}
