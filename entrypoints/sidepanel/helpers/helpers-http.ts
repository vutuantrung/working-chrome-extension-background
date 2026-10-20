import axios from "axios";

export const http = axios.create({
    baseURL: import.meta.env.VITE_AXIOS_BASE_URL || "http://localhost:3002",
    timeout: 60000,
    withCredentials: true,
});

const isWindowContext = typeof globalThis.window !== "undefined";

http.interceptors.response.use(
    (response) => response,
    async (error) => {
        if (error.response?.status === 401 && isWindowContext) {
            // Sidepanel is a window context. Keep HTTP infrastructure independent
            // from chrome.runtime; AuthContext/application services can react to this.
            window.dispatchEvent(new CustomEvent("AUTH_EXPIRED"));
        }
        return Promise.reject(error);
    },
);
