# StoragePort extraction — Chrome-independent storage

The storage service now imports its platform-independent StoragePort contract
from `contracts/storage.port.ts`. All Chrome Storage calls are delegated
to `infrastructure/chrome-api/chrome-storage.adapter.ts`.

The service API, shared cache, and optional `setStorageAdapter(port)`
injection hook are unchanged. `LocalStorageAdapter` remains as a
deprecated alias to minimize migration risk.

## Dependency direction

- `services/storage.services.ts` -> `contracts/storage.port.ts`
- `infrastructure/chrome-api/chrome-storage.adapter.ts` -> `contracts/storage.port.ts` and `chrome-api.ts`
- Tests may pass a plain in-memory implementation of `StoragePort` without Chrome.

This is the first service boundary only. Other services still contain Chrome
API dependencies. No production listener or Side Panel behavior was changed.

## Validation

```bash
pnpm background:typecheck
pnpm background:test
pnpm background:test:e2e
pnpm build
```
