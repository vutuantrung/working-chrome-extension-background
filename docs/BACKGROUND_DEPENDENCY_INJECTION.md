# Phase 4 — Dependency injection for background services

The existing singleton remains the production default; external consumers do not need changes.

- `StorageService` accepts an optional storage adapter in its constructor. Existing `StorageService.getInstance()` works as before.
- `handleUpdateScheduleActivities(activities, dependencies?)` accepts injected alarm and storage interfaces. With no argument it resolves the real Chrome API and singleton at invocation time.
- Interfaces are intentionally narrow and support test doubles without loading Chrome.
- No changes were made to Side Panel, runtime message contracts, proxy logic, or event registration.

## Examples

```ts
const service = new StorageService(fakeLocalStorage);
await service.setStorageCached({ foo: "bar" });
```

```ts
await handleUpdateScheduleActivities(activities, {
  alarms: fakeAlarms,
  storage: fakeStorage,
});
```

## Validation

```bash
pnpm background:test
pnpm background:typecheck
pnpm background:test:e2e
```

Browser E2E currently targets the isolated extension fixture. Test status should be verified locally. Future work: improve storage cache consistency and extract browser-independent scheduling logic.
