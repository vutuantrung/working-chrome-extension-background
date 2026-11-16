import axios, { AxiosInstance } from "axios";
import { RuntimeService } from "./runtime.services";
import apiCall from "../infrastructure/api";

export class HttpService {
    private readonly http: AxiosInstance;

    constructor(private readonly runtimeService: RuntimeService) {
        this.http = axios.create({
            baseURL: import.meta.env.VITE_AXIOS_BASE_URL || "http://localhost:3002",
            timeout: 60000,
            withCredentials: true,
        });

        this.http.interceptors.response.use(
            (response) => response,
            async (error) => {
                const isWindowContext = typeof globalThis.window !== "undefined";
                if (error.response?.status === 401) {
                    if (isWindowContext) {
                        // Popup/page context custom event (same-window communication)
                        window.dispatchEvent(new CustomEvent("AUTH_EXPIRED"));
                    } else {
                        // Background service worker context runtime message
                        this.runtimeService.getBrowserApi().sendMessage({ type: "AUTH_EXPIRED" }, () => { });
                    }
                }
                return Promise.reject(error);
            },
        );
    }

    getHttpInstance() {
        return this.http;
    }
}