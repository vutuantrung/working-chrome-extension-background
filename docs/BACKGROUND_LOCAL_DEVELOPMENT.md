# Phase 1 — Background-only local tests

This phase adds a Node.js unit-test harness to the existing WXT extension. Production background code and the Side Panel are unchanged.

## Setup

Use the repository's pnpm package manager.

```bash
corepack enable
pnpm install --no-frozen-lockfile
pnpm background:test
pnpm background:test:watch
pnpm background:typecheck
```

**Lockfile note:** This phase introduces Vitest in package.json. The committed pnpm/npm lockfiles have not been regenerated in this change; run the installation command above and commit the resulting lockfile changes before using frozen-lockfile CI. Avoid maintaining both npm and pnpm lockfiles going forward; pnpm is the declared package manager.

## How to add a test

- Keep tests under `tests/background/**/*.test.ts`.
- Use `installChromeMock()` to install opt-in mocks for tests needing Chrome APIs.
- Do not load `entrypoints/background/index.ts` directly into the Node.js test environment: it registers real browser event listeners and WXT entry points.
- Prefer testing existing pure utilities and extracted services by injecting browser adapters.
- Use the real extension through `pnpm dev` and Chrome DevTools when validating Chrome permissions, networking, tabs, proxy, and Service Worker suspension/restart.

## Scope

Included: existing helper regression tests, deterministic Chrome storage/alarms mocks, and basic mock behavior tests.

Not included: real Service Worker integration testing, Side Panel tests, or architectural refactoring. Phase 2 can introduce browser integration tests and adapters while keeping the message contract unchanged.
