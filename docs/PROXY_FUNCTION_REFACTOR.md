# Proxy module refactor

`services/proxyServices.ts` now exports plain functions instead of a singleton class. Runtime, storage, system, proxy, webRequest and alarm handlers call named imports. Module-level state retains the existing proxy-error throttle across calls for the lifetime of the service worker. Side Panel contracts and Chrome API gateway are unchanged.

Run `pnpm background:typecheck`, `pnpm background:test`, and `pnpm background:test:e2e` after pulling. Service Worker restart clears in-memory throttle state as before.
