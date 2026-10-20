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
    if (error.response?.status === 401) {
      if (isWindowContext) {
        // Popup/page context custom event (same-window communication)
        window.dispatchEvent(new CustomEvent("AUTH_EXPIRED"));
      } else {
        // Background service worker context runtime message
        chrome.runtime.sendMessage({ type: "AUTH_EXPIRED" }).catch(() => {});
      }
    }
    return Promise.reject(error);
  },
);
