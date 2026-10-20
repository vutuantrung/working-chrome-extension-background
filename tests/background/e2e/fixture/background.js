// Browser-only fixture: exercises actual MV3 APIs without loading the production
// background, network integrations, content scripts, or Side Panel.
chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message?.type === "TEST_PING") {
    sendResponse({ ok: true, source: "background-fixture" });
  }
});

chrome.storage.onChanged.addListener((changes, area) => {
  if (area !== "local" || !Object.hasOwn(changes, "e2e:input")) return;
  chrome.storage.local.set({ "e2e:observed": changes["e2e:input"].newValue });
});

chrome.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name !== "e2e:tick") return;
  chrome.storage.local.set({ "e2e:lastAlarm": alarm.name });
});
