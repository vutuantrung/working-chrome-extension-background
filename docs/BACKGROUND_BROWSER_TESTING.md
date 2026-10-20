# Phase 2 — Background-only Chromium integration tests

These tests use **real Chromium + a real MV3 Service Worker** via Playwright.
They **do not** launch the Side Panel and **do not** load the production extension.
A deliberately minimal test extension prevents production startup side effects
(network requests, proxy configuration, social-network listeners) from affecting
the test environment. The fixture validates the browser/test harness, **not yet
the production background's message router or handlers**.

## Install

```bash
corepack enable
pnpm install --no-frozen-lockfile
pnpm exec playwright install chromium
```

If Linux system libraries are missing, follow Playwright's dependency-install instructions
(e.g. `pnpm exec playwright install --with-deps chromium` where appropriate).

## Run

```bash
pnpm background:test:e2e
pnpm background:test:all
```

Chromium launches with only the test extension loaded. Playwright uses an
ephemeral persistent browser profile because Chrome extensions require one.
For CI, the Playwright bundled Chromium is used via `channel: chromium`.

## What's covered

- MV3 Service Worker startup and extension ID
- Chrome runtime message round trip
- Chrome storage read/write and onChanged events
- Chrome alarms creation/inspection/removal (not an actual timed firing)
- Chrome tabs create/get/remove, without opening a Side Panel

## Limitations / next work

- The fixture is an independent browser integration test, not a regression test
  of the application's production background.
- Service Worker suspension and restoration are **not** verified.
- No production handlers, real proxy, external API, content script, Side Panel,
  or real user account are exercised.
- Next, extract application handlers behind injectable adapters, then test
  them against this harness and add separate tests for worker restart/state recovery.
- Both pnpm-lock.yaml and package-lock.json exist but are not regenerated here.
  Run `pnpm install --no-frozen-lockfile`, commit the new pnpm lockfile,
  and standardize on pnpm before CI with frozen installation.
