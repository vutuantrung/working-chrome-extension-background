# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: service-worker.spec.ts >> can interact with tabs without opening the Side Panel
- Location: tests/background/e2e/service-worker.spec.ts:72:1

# Error details

```
Error: expect(received).toBe(expected) // Object.is equality

Expected: "about:blank"
Received: ""
```

# Test source

```ts
  1  | import { test, expect, chromium, type BrowserContext, type Worker } from "@playwright/test";
  2  | import { fileURLToPath } from "node:url";
  3  | import path from "node:path";
  4  | 
  5  | const extensionPath = path.resolve(
  6  |   path.dirname(fileURLToPath(import.meta.url)),
  7  |   "fixture",
  8  | );
  9  | let context: BrowserContext;
  10 | let worker: Worker;
  11 | 
  12 | test.beforeAll(async () => {
  13 |   context = await chromium.launchPersistentContext("", {
  14 |     channel: "chromium",
  15 |     headless: true,
  16 |     args: [
  17 |       `--disable-extensions-except=${extensionPath}`,
  18 |       `--load-extension=${extensionPath}`,
  19 |     ],
  20 |   });
  21 |   worker = context.serviceWorkers()[0] ?? await context.waitForEvent("serviceworker");
  22 | });
  23 | 
  24 | test.afterAll(async () => {
  25 |   await context?.close();
  26 | });
  27 | 
  28 | test("starts a genuine Manifest V3 background Service Worker", async () => {
  29 |   expect(worker.url()).toMatch(/^chrome-extension:\/\/[^/]+\/background\.js$/);
  30 |   const extensionId = new URL(worker.url()).hostname;
  31 |   expect(extensionId).toMatch(/^[a-p]{32}$/);
  32 | });
  33 | 
  34 | test("receives Chrome runtime messages from an extension page", async () => {
  35 |   // A message originating inside the Service Worker is not delivered back
  36 |   // to its own onMessage listener. Use a separate extension page as sender.
  37 |   const extensionId = new URL(worker.url()).hostname;
  38 |   const page = await context.newPage();
  39 |   try {
  40 |     await page.goto(`chrome-extension://${extensionId}/sender.html`);
  41 |     const response = await page.evaluate(async () =>
  42 |       chrome.runtime.sendMessage({ type: "TEST_PING" }),
  43 |     );
  44 |     expect(response).toEqual({ ok: true, source: "background-fixture" });
  45 |   } finally {
  46 |     await page.close();
  47 |   }
  48 | });
  49 | 
  50 | test("observes genuine chrome.storage change events", async () => {
  51 |   await worker.evaluate(async () => {
  52 |     await chrome.storage.local.clear();
  53 |     await chrome.storage.local.set({ "e2e:input": "hello" });
  54 |   });
  55 |   await expect.poll(async () =>
  56 |     worker.evaluate(async () =>
  57 |       (await chrome.storage.local.get("e2e:observed"))["e2e:observed"],
  58 |     ),
  59 |   ).toBe("hello");
  60 | });
  61 | 
  62 | test("creates and removes genuine Chrome alarms", async () => {
  63 |   const alarm = await worker.evaluate(async () => {
  64 |     await chrome.alarms.create("e2e:tick", { delayInMinutes: 1 });
  65 |     const created = await chrome.alarms.get("e2e:tick");
  66 |     await chrome.alarms.clear("e2e:tick");
  67 |     return { name: created?.name, removed: !(await chrome.alarms.get("e2e:tick")) };
  68 |   });
  69 |   expect(alarm).toEqual({ name: "e2e:tick", removed: true });
  70 | });
  71 | 
  72 | test("can interact with tabs without opening the Side Panel", async () => {
  73 |   const opened = await worker.evaluate(async () => {
  74 |     const tab = await chrome.tabs.create({ url: "about:blank", active: false });
  75 |     const found = await chrome.tabs.get(tab.id);
  76 |     await chrome.tabs.remove(tab.id);
  77 |     return { id: found.id, url: found.url };
  78 |   });
  79 |   expect(opened.id).toEqual(expect.any(Number));
> 80 |   expect(opened.url).toBe("about:blank");
     |                      ^ Error: expect(received).toBe(expected) // Object.is equality
  81 | });
  82 | 
```