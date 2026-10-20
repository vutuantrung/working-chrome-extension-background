# Storage functions refactor

`StorageService` singleton was replaced with module-level named functions. Storage cache and in-flight request state remain shared for the Service Worker lifetime. `setStorageAdapter(adapter)` allows unit tests to inject a Chrome storage substitute; call it without arguments to restore production defaults and clear cache. Consumers now use direct named imports. Side Panel communication contracts are unchanged.

Run `pnpm background:typecheck`, `pnpm background:test`, and `pnpm background:test:e2e` after pulling.
