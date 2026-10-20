# Phase 3 — Background Chrome API boundary

`entrypoints/background/chrome-api.ts` is the central browser API gateway for background code.

## Scope of the first migration

- `entrypoints/background/index.ts`: listener registration and proxy alarm initialization
- `entrypoints/background/services/scheduleService.ts`: alarms
- `entrypoints/background/handlers/extension/clickHandler.ts`: Side Panel browser API calls (the Side Panel itself is unchanged)

All calls retain their original arguments and behavior. No new service lifecycle, storage semantics, or message contracts are introduced.

## Why use lazy getters?

Importing the facade does not access `chrome` until a property is read, so Node.js tests can import it, then install mocked globals with `installChromeMock()`. The facade delegates to the actual browser object at runtime and preserves the built-in API methods' receiver.

## Usage

```ts
import { chromeApi } from "../chrome-api";
const alarm = await chromeApi.alarms.get("task");
```

## Next migration batches

Migrate remaining handlers and services to the facade in small reviewable batches, then extract narrower injectable interfaces for storage, scheduling, tabs, and messaging. This avoids broad changes to high-risk proxy and interception logic.

## Tests

```bash
pnpm background:test
pnpm background:test:e2e
pnpm background:typecheck
```

Browser integration tests currently run against an isolated fixture, not the production background. CI lockfiles still need to be regenerated and verified locally.
