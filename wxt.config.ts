import { defineConfig, WxtViteConfig } from "wxt";
import tailwindcss from "@tailwindcss/vite";

export default defineConfig({
  modules: ["@wxt-dev/module-react"],
  vite: () =>
    <WxtViteConfig>{
      plugins: [tailwindcss()],
    },
  manifest: {
    name: "Lerna Lakes",
    version: "2.9.4",
    description: "Lerna Lakes",
    content_security_policy: {
      extension_pages:
        "script-src 'self'; object-src 'none'; connect-src 'self' https://facebook.com/ https://web.facebook.com/ https://www.facebook.com/ https://api.openai.com/ http://localhost:3002 http://localhost:5050 https://random123456.projectsys.org https://api-dev.groups-multi.org https://random123.projectsys.org https://dkpservices.intelsys.group https://services-delivery-dev.intelsys.group https://services-delivery-api.intelsys.group;",
    },

    permissions: [
      "nativeMessaging",
      "scripting",
      "webRequest",
      "webRequestAuthProvider",
      "activeTab",
      "storage",
      "tabs",
      "externally_connectable",
      "alarms",
      "proxy",
      "downloads",
      "cookies",
      "notifications",
      "webNavigation",
      "sidePanel",
    ],

    host_permissions: [
      "<all_urls>",
      "https://httpbin.org/*",
      "https://www.facebook.com/*",
      "https://web.facebook.com/*",
      "https://api.openai.com/*",
      "http://localhost:3002/*",
      "https://random123456.projectsys.org/*",
      "https://random123.projectsys.org/*",
      "https://dkpservices.intelsys.group/*",
      "https://services-delivery-api.atintel.org/*",
      "https://api.jsonsilo.com/*",
      "*://*.facebook.com/*",
      "https://*.facebook.com/*",
      "https://facebook.com/*",
      "https://api.openai.com/*",
      "http://localhost:5050/*",
    ],

    // For content script:
    // content_scripts: [
    //   {
    //     matches: ["https://www.facebook.com/*", "https://web.facebook.com/*"],
    //     js: [
    //       "entrypoints/content/index.ts",
    //       "entrypoints/content/facebook/get-fb-profile-id.ts",
    //       "entrypoints/content/facebook/join-groups-no-response.ts",
    //       "entrypoints/content/facebook/join-groups. ts",
    //       "entrypoints/content/facebook/scroll-groups.ts",
    //       "entrypoints/content/facebook/scroll-urls.ts",
    //     ],
    //   },
    // ],

    // For background script:
    background: {
      service_worker: "entrypoints/background/index.ts",
    },

    action: {},

    // For popup extension:
    // action: {
    //   default_popup:  "popup.html",
    //   default_icon: {
    //     16: "icon/16.png",
    //     32: "icon/32.png",
    //     48: "icon/48.png",
    //     128: "icon/128.png",
    //   }
    // },
  },
});
