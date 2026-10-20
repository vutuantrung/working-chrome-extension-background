import {
  addPopupStyles,
  FB_PROFILE_STATUS_MAP,
  successIcon,
  xpathStringLiteral,
} from "../helpers/css-helper";
import { isTaskCanceled, sendRequest } from "../init-task";

type StatusValue =
  | "ASSIGNED"
  | "UNASSIGNED"
  | "NOT_EXIST"
  | "NOT_EXIST_NO_UPDATE";
type SpanEnhanceConfig = {
  status?: StatusValue;
  owner_id: string;
  owner_name: string;
  owner_type: string;
};
type Inputs = {
  enhanceConfig: SpanEnhanceConfig[];
  hoverProfileIds: string;
};
type Message = {
  activityName?: string;
  taskId?: string;
  tabId?: number;
  nextTask?: string;
  inputs: Inputs;
};

function findPopupProfile() {
  const bannerChildNodes =
    document.querySelector("div[role='banner']")?.nextElementSibling?.firstChild
      ?.firstChild?.childNodes;
  // console.log("[ENHANCE_SPAN] >>> Found banner child nodes:", bannerChildNodes);
  if (!bannerChildNodes) return null;

  for (let i = 0; i < bannerChildNodes.length; i++) {
    const child = bannerChildNodes[i] as HTMLElement;
    if (
      child.nodeType === Node.ELEMENT_NODE &&
      child.tagName === "DIV" &&
      child.attributes.length === 0
    ) {
      // console.log("[ENHANCE_SPAN] >>> Found popup profile element:", child.firstChild);
      return child.firstChild as HTMLElement | null;
    }
  }

  return null;
}

function findContainerByH3Text(text: string) {
  const h3Elements = document.querySelectorAll('h3[dir="auto"]');
  // console.log("[ENHANCE_SPAN] >>> Found h3 elements:", h3Elements);
  for (const h3 of h3Elements) {
    if (h3.textContent?.trim() === text) {
      return h3.parentElement as HTMLElement | null;
    }
  }

  return null;
}

export const handleEnhanceSpanMessage = async (message: Message) => {
  const scriptName = "ENHANCE_SPAN";
  const { activityName, taskId, tabId } = message;

  // console.log("[ENHANCE_SPAN]", "Message received:", message);

  // Filter: only handle ENHANCE_SPAN messages
  if (activityName !== scriptName) {
    return;
  }

  if (isTaskCanceled(taskId)) {
    console.warn("[ENHANCE_SPAN] Canceled; ignoring message", {
      taskId,
      tabId,
    });
    return;
  }

  try {
    const feedByRole = document.querySelector(
      '[role="feed"]',
    ) as HTMLElement | null;
    const feedPostElement_en = findContainerByH3Text(
      "Feed posts",
    ) as HTMLElement | null;
    const feedPostElement_vi = findContainerByH3Text(
      "Bài viết trên Bảng feed",
    ) as HTMLElement | null;
    const feedPostElement =
      feedByRole ||
      feedPostElement_en ||
      feedPostElement_vi ||
      (document.querySelector('div[role="main"]') as HTMLElement | null);

    if (!feedPostElement) {
      sendRequest({
        type: "SCRIPT_EXECUTE_RESULT",
        inputs: { taskId, tabId },
      });
      return;// Need to return because maybe the current page url is not correct (main page)
    }

    // Set Observer on feed post's childnodes
    const observeTarget = feedPostElement?.childNodes[2] || feedPostElement;
    if (observeTarget) {
      const observer = new MutationObserver((mutations) => {
        debouncedSetStatusLabel(feedPostElement, mutations);
      });
      observer.observe(observeTarget, { childList: true, subtree: true });
    } else {
      console.warn("[ENHANCE_SPAN] Observe target for feed post's childnodes not found");
    }

    // Set Observer on popup profile's childnodes
    const popupElement = findPopupProfile() as HTMLElement | null;
    if (popupElement) {
      const observer = new MutationObserver((mutations) => {
        debouncedSetAssignLabel(popupElement, feedPostElement, mutations);
      });
      observer.observe(popupElement, { childList: true, subtree: true });
    }

    sendRequest({
      type: "SCRIPT_EXECUTE_RESULT",
      inputs: { taskId, tabId },
    });
  } catch (error: any) {
    console.warn(
      "[ENHANCE_SPAN] Warning enhancing spans:",
      error?.message || error,
    );
    sendRequest({
      type: "SCRIPT_EXECUTE_RESULT",
      inputs: {
        taskId: taskId,
        tabId: tabId,
        error: error?.message,
      },
    });
  }
};

const debouncedSetStatusLabel = debounce(
  (feedPostElement: HTMLElement, mutations: MutationRecord[]) => {
    // 1. get the data from the data storage div element
    const dataStorageDiv = feedPostElement.querySelector(
      "div.data-storage",
    ) as HTMLDivElement | null;
    const enhanceConfigStr = dataStorageDiv?.dataset.enhanceConfig || "[]";
    let enhanceConfig: SpanEnhanceConfig[] = [];
    try {
      enhanceConfig = JSON.parse(enhanceConfigStr);
    } catch (_ignore: any) {}

    // 2. enhance the span element based on the data
    for (const mutation of mutations) {
      if (mutation.type === "childList") {
        for (const config of enhanceConfig) {
          const xpath = `//span[contains(@class, 'html-span') and text()=${xpathStringLiteral(config.owner_name)}]`;
          // console.log("[ENHANCE_SPAN] Searching for span with XPath:", xpath, "for owner:", config.owner_name);
          let evaluateResults = document.evaluate(
            xpath,
            document,
            null,
            XPathResult.ORDERED_NODE_SNAPSHOT_TYPE,
            null,
          );

          // console.log("[ENHANCE_SPAN] Found", evaluateResults.snapshotLength, "span elements for owner:", config.owner_name);
          const xPathBackup = `//span[a[normalize-space(text())=${xpathStringLiteral(config.owner_name)}]]`;
          if (evaluateResults.snapshotLength === 0) {
            evaluateResults = document.evaluate(
              xPathBackup,
              document,
              null,
              XPathResult.ORDERED_NODE_SNAPSHOT_TYPE,
              null,
            );
          }

          for (let i = 0; i < evaluateResults.snapshotLength; i++) {
            const spanEle = evaluateResults.snapshotItem(
              i,
            ) as HTMLSpanElement | null;
            if (!spanEle) {
              continue;
            }

            // console.log("[ENHANCE_SPAN] Found span for owner:", config.owner_name, spanEle);

            const injectingEle = spanEle.parentElement?.parentElement
              ?.parentElement?.parentElement?.parentElement?.parentElement
              ?.parentElement?.parentElement as HTMLElement;
            if (!injectingEle) {
              continue;
            }
            // prevent enhancing the same span multiple times
            if (
              injectingEle.querySelector('[data-status="status-label"]') !==
              null
            ) {
              continue;
            }
            // console.log("[ENHANCE_SPAN] Injecting status label for owner:", config);
            addStatusLabel(injectingEle, config);
          }
        }
      }
    }
  },
  200,
);

const debouncedSetAssignLabel = debounce(
  (
    popupElement: HTMLElement,
    feedPostElement: HTMLElement,
    mutations: MutationRecord[],
  ) => {
    // 1. get the data from the data storage div element
    const hoverDataStorageDiv = feedPostElement.querySelector(
      "div.hover-data-storage",
    ) as HTMLDivElement | null;
    const profileIds =
      hoverDataStorageDiv?.dataset.hoverProfileIds?.split(",") || [];

    const dataStorageDiv = feedPostElement.querySelector(
      "div.data-storage",
    ) as HTMLDivElement | null;
    const enhanceConfigStr = dataStorageDiv?.dataset.enhanceConfig || "[]";
    let enhanceConfig: SpanEnhanceConfig[] = [];
    try {
      enhanceConfig = JSON.parse(enhanceConfigStr);
    } catch (_ignore: any) {}

    // 2. enhance the span element based on the data
    for (const mutation of mutations) {
      // console.log(">>> something changed")
      if (mutation.type === "childList") {
        const listItemParentElement = popupElement.querySelector(
          "div[role='listitem']",
        )?.parentElement as HTMLElement | null;
        // console.log("[ENHANCE_SPAN] Found list item parent element for popup profile:", listItemParentElement);
        if (!listItemParentElement) continue;
        if (
          listItemParentElement.querySelector(
            '[data-status="status-label-hover"]',
          ) !== null
        )
          continue;

        // search the owner name
        const h4HtmlH4Ele = popupElement.querySelector(
          'h4[dir="auto"].html-h4',
        ) as HTMLElement | null;
        const aRoleLinkEle = h4HtmlH4Ele?.querySelector(
          'a[role="link"]',
        ) as HTMLElement | null;

        let ownerName = "";
        const ownerNameElement = aRoleLinkEle?.querySelector(
          'span[dir="auto"].html-span',
        ) as HTMLElement | null;
        if (ownerNameElement) {
          ownerName = [...ownerNameElement.childNodes]
            .filter((node) => node.nodeType === Node.TEXT_NODE)
            .map((node) => node.textContent)
            .join("")
            .trim();
        }
        // search in the a element if not found in the span
        if (!ownerName) {
          ownerName = aRoleLinkEle?.textContent?.trim() || "";
        }
        // give up if not found
        if (!ownerName) continue;

        // console.log("[ENHANCE_SPAN] Found owner name for popup profile:", ownerName);

        // find the corresponding config for creating assign button
        const cachedOwnerData = enhanceConfig.find(
          (config) => config.owner_name === ownerName,
        );
        const isUnassignedRecord = cachedOwnerData?.status === "UNASSIGNED";
        const isAssignedClicked = profileIds.includes(
          "_" + cachedOwnerData?.owner_id || "",
        );
        const isAssignedUnclicked = profileIds.includes(
          cachedOwnerData?.owner_id || "",
        );

        let createButton: "assigned" | "unassigned" | "abort" = "unassigned";
        if (!isUnassignedRecord) createButton = "abort";
        if (isUnassignedRecord && isAssignedClicked) createButton = "assigned";
        if (isUnassignedRecord && isAssignedUnclicked)
          createButton = "unassigned";

        // console.log("[ENHANCE_SPAN] Found owner data for popup profile:", isUnassignedRecord, isAssignedClicked, isAssignedUnclicked, cachedOwnerData, createButton);
        const updateProfileIds = () => {
          const updatedProfileIds = profileIds.filter(
            (id) => id !== cachedOwnerData?.owner_id,
          );
          updatedProfileIds.push("_" + cachedOwnerData?.owner_id);
          hoverDataStorageDiv!.dataset.hoverProfileIds =
            updatedProfileIds.join(",");
        };

        // add button
        addAssignButton(listItemParentElement, createButton, updateProfileIds);
      }
    }
  },
  200,
);

function debounce<T extends (...args: any[]) => void>(
  fn: T,
  delay: number,
): (...args: Parameters<T>) => void {
  let timer: number | undefined;
  return (...args: Parameters<T>) => {
    clearTimeout(timer);
    timer = window.setTimeout(() => {
      fn(...args);
    }, delay);
  };
}

function addStatusLabel(
  injectElement: HTMLElement,
  config: SpanEnhanceConfig,
): void {
  if (!config.status) {
    return;
  }
  const labelInfo = FB_PROFILE_STATUS_MAP[config.status];
  const wrapper = document.createElement("div");
  Object.assign(wrapper.style, {
    position: "relative",
    marginTop: "5px",
  });
  const label = document.createElement("div");
  Object.assign(label.style, {
    display: "inline-flex",
    alignItems: "center",
    gap: "6px",
    padding: "2px 10px",
    borderRadius: "12px",
    backgroundColor: labelInfo.backgroundColor,
    color: labelInfo.color,
    fontFamily: "Arial",
    fontSize: "12px",
    fontWeight: "600",
    cursor: labelInfo.dropdown.length > 0 ? "pointer" : "default",
    userSelect: "none",
  });
  label.innerHTML = `<span style="padding: 2px 3px;">${labelInfo.icon}</span>${labelInfo.text}`;
  label.setAttribute("data-status", "status-label");
  wrapper.appendChild(label);
  // Dropdown for Danger
  if (labelInfo.dropdown.length > 0) {
    const menu = document.createElement("div");
    Object.assign(menu.style, {
      position: "absolute",
      top: "110%",
      left: "0",
      width: "127px",
      background: "rgba(145, 4, 4, 0.8)",
      boxShadow: "0 4px 12px rgba(0,0,0,.25)",
      display: "none",
      overflow: "hidden",
      zIndex: "1000",
    });
    labelInfo.dropdown.forEach((text: string) => {
      const option = document.createElement("div");
      Object.assign(option.style, {
        padding: "5px",
        cursor: "pointer",
        fontWeight: "700",
        fontSize: "12px",
        color: "#fff",
      });
      option.textContent = text;
      option.addEventListener("mouseenter", () => {
        option.style.background = "#8d0202";
      });
      option.addEventListener("mouseleave", () => {
        option.style.background = "";
      });
      option.addEventListener("click", () => {
        // only the NOT_EXIST can send the add source request
        if (labelInfo.code === "NOT_EXIST") {
          sendAddingSource(config);
        }

        if (
          labelInfo.code === "NOT_EXIST" ||
          labelInfo.code === "NOT_EXIST_NO_UPDATE"
        ) {
          createPopup({
            title: "Success",
            message: "Đã bổ sung đối tượng",
            duration: 3000,
            actions: ["OK"],
            icon: successIcon,
          });
        }
        menu.style.display = "none";
      });
      menu.appendChild(option);
    });
    label.addEventListener("click", (e) => {
      e.stopPropagation();
      const display = menu.style.display === "block" ? "none" : "block";
      menu.style.display = display;
      label.style.borderRadius = "12px 12px 0 0";
    });
    document.addEventListener("click", () => {
      menu.style.display = "none";
      label.style.borderRadius = "12px";
    });
    wrapper.appendChild(menu);
  }
  injectElement.appendChild(wrapper);
}

function addAssignButton(
  injectElement: HTMLElement,
  createButton: "assigned" | "unassigned" | "abort",
  updateProfileIds?: () => void,
): void {
  if (createButton === "abort") return;
  const label = document.createElement("div");
  Object.assign(label.style, {
    display: "inline-flex",
    alignItems: "center",
    gap: "6px",
    padding: "2px 10px",
    borderRadius: "12px",
    color: "#ffffff",
    fontFamily: "Arial",
    fontSize: "12px",
    fontWeight: "600",
    userSelect: "none",
    marginLeft: "50px",
    marginTop: "5px",
  });
  label.setAttribute("data-status", "status-label-hover");
  if (createButton === "assigned") {
    label.innerHTML = '<span style="padding: 2px 3px;">✓</span> Đã cập nhật';
    label.style.backgroundColor = "#094102";
  }
  if (createButton === "unassigned") {
    label.innerHTML = '<span style="padding: 2px 3px;">+</span>Cập nhật';
    label.style.backgroundColor = "#6554c0";
    label.style.cursor = "pointer";
    label.addEventListener("click", (e) => {
      e.stopPropagation();
      label.innerHTML = '<span style="padding: 2px 3px;">✓</span> Đã cập nhật';
      label.style.backgroundColor = "#094102";
      if (updateProfileIds) {
        updateProfileIds();
      }
      createPopup({
        title: "Success",
        message: "Đã cập nhật đối tượng",
        duration: 3000,
        actions: ["OK"],
        icon: successIcon,
      });
    });
  }
  injectElement.appendChild(label);
}

function createPopup(popupInfo: any) {
  addPopupStyles();

  let wrapper = document.querySelector(".popup-wrap");
  if (!wrapper) {
    wrapper = document.createElement("div");
    wrapper.className = "popup-wrap";
    document.body.appendChild(wrapper);
  }

  const popup = document.createElement("div");
  popup.className = "popup-card";
  popup.innerHTML = `
        <div class="popup-content">
            <div class="popup-icon">${popupInfo.icon}</div>
            <div>
                <h3 class="popup-title">${popupInfo.title}</h3>
                <p class="popup-message">${popupInfo.message}</p>
            </div>
        </div>

        <div class="popup-actions">
            ${popupInfo.actions.map((action: string) => `<button class="popup-action">${action}</button>`).join("")}
        </div>
    `;

  popup.querySelectorAll(".popup-action").forEach((button) => {
    button.addEventListener("click", () => {
      popup.remove();
    });
  });

  wrapper.appendChild(popup);

  setTimeout(() => {
    popup.remove();
  }, popupInfo.duration);
}

export const handleInjectPostOwner = async (message: Message) => {
  const scriptName = "INJECT_POST_OWNER_DATA";
  const { activityName, taskId, tabId } = message;

  // console.log("[INJECT_POST_OWNER_DATA]", "Message received:", message);

  // Filter: only handle INJECT_POST_OWNER_DATA messages
  if (activityName !== scriptName) {
    return;
  }

  if (isTaskCanceled(taskId)) {
    console.warn("[INJECT_POST_OWNER_DATA] Canceled; ignoring message", {
      taskId,
      tabId,
    });
    return;
  }

  const enhanceConfig = message?.inputs?.enhanceConfig || [];
  try {
    // create an observer of h3 text Feed posts
    const xpathH3_en = `//h3[text()='Feed posts']`;
    const xpathH3_vi = `//h3[text()='Bài viết trên Bảng feed']`;

    const resultXPathH3_en = document.evaluate(
      xpathH3_en,
      document,
      null,
      XPathResult.FIRST_ORDERED_NODE_TYPE,
      null,
    );
    const resultXPathH3_vi = document.evaluate(
      xpathH3_vi,
      document,
      null,
      XPathResult.FIRST_ORDERED_NODE_TYPE,
      null,
    );
    const resultXPathH3 =
      resultXPathH3_en?.singleNodeValue || resultXPathH3_vi?.singleNodeValue;
    const observingTarget = resultXPathH3 as HTMLDivElement | null;

    if (!observingTarget) {
      // console.warn("[INJECT_POST_OWNER_DATA] Observe target for Feed posts not found");
      return;
    }

    const resultXPathDataStorage = observingTarget.querySelector(
      "div[class='data-storage']",
    ) as HTMLDivElement | null;
    if (resultXPathDataStorage) {
      // 1. get all the existing enhanceConfig from the data storage div element
      const existingConfigStr =
        resultXPathDataStorage.dataset.enhanceConfig || "[]";
      let existingConfig: SpanEnhanceConfig[] = [];
      try {
        existingConfig = JSON.parse(existingConfigStr);
      } catch (error) {
        console.error(
          "[INJECT_POST_OWNER_DATA] Error parsing existing enhanceConfig from data storage:",
          error,
        );
      }
      // 2. merge the existing enhanceConfig with the new enhanceConfig
      const mergedConfig = [...existingConfig, ...enhanceConfig];

      // 3. from the beggining of the mergedConfig, remove the duplicates based on owner_id, keep the last one (the new one)
      const seenOwnerIds = new Set<string>();
      const filteredConfig: SpanEnhanceConfig[] = [];
      for (let i = mergedConfig.length - 1; i >= 0; i--) {
        const config = mergedConfig[i];
        if (!seenOwnerIds.has(config.owner_id)) {
          seenOwnerIds.add(config.owner_id);
          filteredConfig.unshift(config); // add to the beginning to maintain order
        }
      }

      // 4. if the length is passed 50, remove the oldest one (based on the order in existingConfig)
      const uniqueConfig =
        filteredConfig.length > 50
          ? filteredConfig.slice(filteredConfig.length - 50)
          : filteredConfig;

      // 5. save the merged enhanceConfig back to the data storage div element as dataset
      resultXPathDataStorage.dataset.enhanceConfig = JSON.stringify(uniqueConfig);

      // console.log("[INJECT_POST_OWNER_DATA] Merged enhanceConfig saved to data storage div:", resultXPathDataStorage);
    } else {
      // 1. create new div element with class data-storage and append to observingTarget
      const dataStorageDiv = document.createElement("div");
      dataStorageDiv.className = "data-storage";
      dataStorageDiv.style.display = "none";
      // 2. save data to the div element as dataset
      dataStorageDiv.dataset.enhanceConfig = JSON.stringify(enhanceConfig);
      observingTarget.appendChild(dataStorageDiv);

      // console.log("[INJECT_POST_OWNER_DATA] Created data storage div and saved enhanceConfig:", dataStorageDiv);
    }

    sendRequest({
      type: "SCRIPT_EXECUTE_RESULT",
      inputs: { taskId, tabId },
    });
  } catch (error: any) {
    console.error("[INJECT_POST_OWNER_DATA] Error enhancing spans:", error);
    sendRequest({
      type: "SCRIPT_EXECUTE_RESULT",
      inputs: {
        taskId: taskId,
        tabId: tabId,
        error: error.message,
      },
    });
  }
};

export const handleInjectHoverPostOwner = async (message: Message) => {
  const scriptName = "INJECT_HOVER_POST_OWNER_DATA";
  const { activityName, taskId, tabId } = message;

  // console.log("[INJECT_HOVER_POST_OWNER_DATA]", "Message received:", message);

  // Filter: only handle INJECT_HOVER_POST_OWNER_DATA messages
  if (activityName !== scriptName) {
    return;
  }

  if (isTaskCanceled(taskId)) {
    console.warn("[INJECT_HOVER_POST_OWNER_DATA] Canceled; ignoring message", {
      taskId,
      tabId,
    });
    return;
  }

  const hoverProfileIdsData = message?.inputs?.hoverProfileIds.split(",") || [];
  try {
    // create an observer of h3 text Feed posts
    const xpathH3_en = `//h3[text()='Feed posts']`;
    const xpathH3_vi = `//h3[text()='Bài viết trên Bảng feed']`;

    const resultXPathH3_en = document.evaluate(
      xpathH3_en,
      document,
      null,
      XPathResult.FIRST_ORDERED_NODE_TYPE,
      null,
    );
    const resultXPathH3_vi = document.evaluate(
      xpathH3_vi,
      document,
      null,
      XPathResult.FIRST_ORDERED_NODE_TYPE,
      null,
    );
    const resultXPathH3 =
      resultXPathH3_en?.singleNodeValue || resultXPathH3_vi?.singleNodeValue;
    const observingTarget = resultXPathH3 as HTMLDivElement | null;

    if (!observingTarget) {
      // console.warn("[INJECT_HOVER_POST_OWNER_DATA] Observe target for Feed posts not found");
      return;
    }

    const resultXPathDataStorage = observingTarget.querySelector(
      "div[class='hover-data-storage']",
    ) as HTMLDivElement | null;
    if (resultXPathDataStorage) {
      // 1. get all the existing hoverProfileIds from the data storage div element
      const existingOwnerIds =
        resultXPathDataStorage.dataset.hoverProfileIds?.split(",") || [];

      // 2. remove duplicates based on owner_id
      const uniqueIds = Array.from(
        new Set([...existingOwnerIds, ...hoverProfileIdsData]),
      );

      // 3. if the length is passed 50, remove the oldest one (based on the order in existingConfig)
      if (uniqueIds.length > 50) {
        const exceedNumber = uniqueIds.length - 50;
        uniqueIds.splice(0, exceedNumber);
      }

      // 4. save the merged hoverProfileIdsData back to the data storage div element as dataset
      resultXPathDataStorage.dataset.hoverProfileIds = uniqueIds.join(",");

      // console.log("[INJECT_HOVER_POST_OWNER_DATA] Merged hoverProfileIds saved to data storage div:", resultXPathDataStorage);
    } else {
      // 1. create new div element with class hover-data-storage and append to observingTarget
      const dataStorageDiv = document.createElement("div");
      dataStorageDiv.className = "hover-data-storage";
      dataStorageDiv.style.display = "none";
      // 2. save data to the div element as dataset
      dataStorageDiv.dataset.hoverProfileIds = hoverProfileIdsData.join(",");
      observingTarget.appendChild(dataStorageDiv);

      // console.log("[INJECT_HOVER_POST_OWNER_DATA] Created data storage div and saved enhanceConfig:", dataStorageDiv);
    }

    sendRequest({
      type: "SCRIPT_EXECUTE_RESULT",
      inputs: { taskId, tabId },
    });
  } catch (error: any) {
    console.error(
      "[INJECT_HOVER_POST_OWNER_DATA] Error enhancing spans:",
      error,
    );
    sendRequest({
      type: "SCRIPT_EXECUTE_RESULT",
      inputs: {
        taskId: taskId,
        tabId: tabId,
        error: error.message,
      },
    });
  }
};

async function sendAddingSource(profileData: any): Promise<void> {
  try {
    const resultSend = await chrome.runtime.sendMessage({
      type: "SEND_ADD_SOURCE_REQUEST",
      inputs: {
        profileId: profileData.owner_id,
        profileName: profileData.owner_name,
        profileType: profileData.owner_type,
      },
    });
    console.log("[sendAddingSource] Runtime response:", resultSend);
  } catch (error: any) {
    console.log("[error][sendAddingSource]", error.message);
  }
}

// DEPRECATED

// function addStatusLabel2(span: HTMLElement, status: StatusValue): void {
//     const label = document.createElement("label");

//     console.log("[ENHANCE_SPAN] Adding status with style:", COLOR_MAP[status]);

//     // TEXT, COLORS
//     label.textContent = COLOR_MAP[status].text;
//     label.style.backgroundColor = COLOR_MAP[status].backgroundColor;
//     label.style.color = COLOR_MAP[status].color;

//     // DEFAULT STYLES
//     // label.style.marginLeft = "8px";
//     // label.style.marginBottom = "3px";
//     label.style.padding = "1px 5px";
//     label.style.margin = "3px 0px";
//     label.style.borderRadius = "5px";
//     label.style.fontSize = "12px";
//     label.style.fontWeight = "600";
//     label.style.display = "inline-flex";
//     label.style.alignItems = "center";
//     label.style.fontFamily = "sans-serif";

//     label.setAttribute("data-status", "status-label");

//     span.appendChild(label);
// }

// function addStatusDropdownList(span: HTMLElement, status: StatusValue): void {
//     function onMenuItemClick(value: any) {
//         // console.log("Selected:", value);

//         // Your custom logic here
//         if (value === "val_bosung") openBoSung();
//         if (value === "val_capnhat") openCapNhat();
//     }

//     let dropdownVal: { label: string; value: string }[] = [];
//     if (status === "NOT_EXIST") {
//         dropdownVal = [{ label: "Bổ sung", value: "val_bosung" }];
//     }
//     if (status === "UNASSIGNED") {
//         dropdownVal = [{ label: "Cập nhật", value: "val_capnhat" }];
//     }

//     const container = document.createElement("div");
//     container.style.margin = "3px 0px";

//     const label = document.createElement("label");
//     label.textContent = COLOR_MAP[status].text;
//     label.style.backgroundColor = COLOR_MAP[status].backgroundColor;
//     label.style.color = COLOR_MAP[status].color;

//     // label.style.marginLeft = "8px";
//     // label.style.marginBottom = "3px";
//     label.style.padding = "1px 5px";
//     label.style.borderRadius = "5px";
//     label.style.fontSize = "12px";
//     label.style.fontWeight = "600";
//     label.style.display = "inline-flex";
//     label.style.alignItems = "center";
//     label.style.fontFamily = "sans-serif";
//     label.style.cursor = "pointer";

//     label.setAttribute("data-status", "status-label");

//     label.addEventListener("mouseenter", () => {
//         label.textContent = "BỔ SUNG";
//     });

//     label.addEventListener("mouseleave", () => {
//         label.textContent = COLOR_MAP[status].text;
//     });

//     const menu = document.createElement("ul");
//     menu.className = "menu";
//     menu.style.display = "none";

//     menu.addEventListener("click", (e) => {
//         e.stopPropagation();
//     });

//     if (dropdownVal.length > 0) {
//         dropdownVal.forEach((item: { label: string; value: string }) => {
//             const li = document.createElement("li");
//             li.textContent = item.label;
//             li.style.cursor = "pointer";
//             li.style.display = "inline-block";
//             li.style.fontSize = "12px";
//             li.style.backgroundColor = "#000000";
//             li.style.color = "#fff";

//             li.addEventListener("click", (e) => {
//                 e.stopPropagation();

//                 menu.style.display = "none";
//                 onMenuItemClick(item.value);
//             });

//             menu.appendChild(li);
//         });
//     }

//     // Example methods
//     function openBoSung() {
//         alert("Opening Bo sung");
//     }
//     function openCapNhat() {
//         alert("Opening Cap Nhat");
//     }

//     container.append(label, menu);
//     span.appendChild(container);
// }
