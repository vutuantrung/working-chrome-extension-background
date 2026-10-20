import { test, expect, chromium, type BrowserContext, type Worker } from "@playwright/test";
import { fileURLToPath } from "node:url";
import path from "node:path";

const extensionPath = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "fixture",
);
let context: BrowserContext;
let worker: Worker;

test.beforeAll(async () => {
  context = await chromium.launchPersistentContext("", {
    channel: "chromium",
    headless: true,
    args: [
      `--disable-extensions-except=${extensionPath}`,
      `--load-extension=${extensionPath}`,
    ],
  });
  worker = context.serviceWorkers()[0] ?? await context.waitForEvent("serviceworker");
});

test.afterAll(async () => {
  await context?.close();
});

test("starts a genuine Manifest V3 background Service Worker", async () => {
  expect(worker.url()).toMatch(/^chrome-extension:\/\/[^/]+\/background\.js$/);
  const extensionId = new URL(worker.url()).hostname;
  expect(extensionId).toMatch(/^[a-p]{32}$/);
});

test("receives Chrome runtime messages from an extension page", async () => {
  // A message originating inside the Service Worker is not delivered back
  // to its own onMessage listener. Use a separate extension page as sender.
  const extensionId = new URL(worker.url()).hostname;
  const page = await context.newPage();
  try {
    await page.goto(`chrome-extension://${extensionId}/sender.html`);
    const response = await page.evaluate(async () =>
      chrome.runtime.sendMessage({ type: "TEST_PING" }),
    );
    expect(response).toEqual({ ok: true, source: "background-fixture" });
  } finally {
    await page.close();
  }
});

test("observes genuine chrome.storage change events", async () => {
  await worker.evaluate(async () => {
    await chrome.storage.local.clear();
    await chrome.storage.local.set({ "e2e:input": "hello" });
  });
  await expect.poll(async () =>
    worker.evaluate(async () =>
      (await chrome.storage.local.get("e2e:observed"))["e2e:observed"],
    ),
  ).toBe("hello");
});

test("creates and removes genuine Chrome alarms", async () => {
  const alarm = await worker.evaluate(async () => {
    await chrome.alarms.create("e2e:tick", { delayInMinutes: 1 });
    const created = await chrome.alarms.get("e2e:tick");
    await chrome.alarms.clear("e2e:tick");
    return { name: created?.name, removed: !(await chrome.alarms.get("e2e:tick")) };
  });
  expect(alarm).toEqual({ name: "e2e:tick", removed: true });
});

test("can interact with tabs without opening the Side Panel", async () => {
  const opened = await worker.evaluate(async () => {
    const tab = await chrome.tabs.create({ url: "about:blank", active: false });
    const found = await chrome.tabs.get(tab.id);
    await chrome.tabs.remove(tab.id);
    return { id: found.id, url: found.url };
  });
  expect(opened.id).toEqual(expect.any(Number));
  expect(opened.url).toBe("about:blank");
});
