# Stateful StorageService class

`StorageService` now owns the `StoragePort`, cache and pending-read state per instance.
Construct instances with `new StorageService(storagePort)` for independent tests.

Existing consumers keep using the module-level `getStorageByKeys`,
`setStorageCached`, `handleSetSettings`, etc. These compatibility functions
delegate to the single shared instance. `setStorageAdapter(port?)` replaces that
shared instance for tests and resets its in-memory state.

The service does not reference `chrome.*` types. Existing production default
wiring to `chromeStorageAdapter` remains in this module for compatibility;
moving instance construction to the background composition root is a separate step.

Validate with `pnpm background:typecheck`, `pnpm background:test`, `pnpm build`.
