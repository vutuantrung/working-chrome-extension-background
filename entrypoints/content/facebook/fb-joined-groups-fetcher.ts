/**
 * Fetches all joined / pending Facebook groups using the GraphQL API.
 * This MUST be called from a content script running on a Facebook page
 * because the fetch needs to run with the correct web.facebook.com origin.
 */

import { stripFacebookAntiCsrfPrefix } from "@/utils/parsers/facebook-parser/utils";
import { FacebookGroupJoinedData } from "@/utils/parsers/types";

async function extractTokensFromFacebookPage(): Promise<{
  fb_dtsg: string;
  userId: string;
  lsd?: string;
  hasteSession?: string;
  rev?: string;
  hsi?: string;
  spin_r?: string;
  spin_b?: string;
  spin_t?: string;
  jazoest?: string;
  connectionClass?: string;
} | null> {
  // First try to get tokens from the current page HTML via inline data
  const html = document.documentElement.innerHTML;

  const fb_dtsg =
    html.match(/"DTSGInitialData"\s*,\s*\[\]\s*,\s*\{\s*"token"\s*:\s*"([^"]+)"/)?.[1] ||
    html.match(/"token"\s*:\s*"(AQ[^"]+)"/)?.[1];

  const userId =
    html.match(/"userId"\s*:\s*"(\d+)"/)?.[1] ||
    html.match(/"userId"\s*:\s*(\d+)/)?.[1] ||
    html.match(/"USER_ID"\s*:\s*"(\d+)"/)?.[1];

  if (!fb_dtsg || !userId) {
    // Fallback: fetch the groups page to extract tokens
    try {
      const res = await fetch("https://web.facebook.com/groups/joins/?nav_source=tab", {
        credentials: "include",
        headers: {
          accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
          "accept-language": "en-US,en;q=0.9",
          "cache-control": "no-cache",
          pragma: "no-cache",
        },
      });
      const pageHtml = await res.text();
      const fb_dtsg2 =
        pageHtml.match(/"DTSGInitialData"\s*,\s*\[\]\s*,\s*\{\s*"token"\s*:\s*"([^"]+)"/)?.[1] ||
        pageHtml.match(/"token"\s*:\s*"(AQ[^"]+)"/)?.[1];
      const userId2 =
        pageHtml.match(/"userId"\s*:\s*"(\d+)"/)?.[1] ||
        pageHtml.match(/"userId"\s*:\s*(\d+)/)?.[1];

      if (!fb_dtsg2 || !userId2) return null;

      return {
        fb_dtsg: fb_dtsg2,
        userId: userId2,
        lsd: pageHtml.match(/"LSD"\s*,\s*\[\]\s*,\s*\{\s*"token"\s*:\s*"([^"]+)"/)?.[1],
        hasteSession: pageHtml.match(/"haste_session"\s*:\s*"([^"]+)"/)?.[1],
        rev: pageHtml.match(/"rev"\s*:\s*(\d+)/)?.[1],
        hsi: pageHtml.match(/"hsi"\s*:\s*"(\d+)"/)?.[1],
        spin_r: pageHtml.match(/"__spin_r"\s*:\s*(\d+)/)?.[1],
        spin_b: pageHtml.match(/"__spin_b"\s*:\s*"([^"]+)"/)?.[1],
        spin_t: pageHtml.match(/"__spin_t"\s*:\s*(\d+)/)?.[1],
        jazoest: pageHtml.match(/jazoest=(\d+)/)?.[1],
        connectionClass: pageHtml.match(/"connectionClass"\s*:\s*"([^"]+)"/)?.[1],
      };
    } catch {
      return null;
    }
  }

  return {
    fb_dtsg,
    userId,
    lsd: html.match(/"LSD"\s*,\s*\[\]\s*,\s*\{\s*"token"\s*:\s*"([^"]+)"/)?.[1],
    hasteSession: html.match(/"haste_session"\s*:\s*"([^"]+)"/)?.[1],
    rev: html.match(/"rev"\s*:\s*(\d+)/)?.[1],
    hsi: html.match(/"hsi"\s*:\s*"(\d+)"/)?.[1],
    spin_r: html.match(/"__spin_r"\s*:\s*(\d+)/)?.[1],
    spin_b: html.match(/"__spin_b"\s*:\s*"([^"]+)"/)?.[1],
    spin_t: html.match(/"__spin_t"\s*:\s*(\d+)/)?.[1],
    jazoest: html.match(/jazoest=(\d+)/)?.[1],
    connectionClass: html.match(/"connectionClass"\s*:\s*"([^"]+)"/)?.[1],
  };
}

async function fetchGroupsPage(
  cursor: string | null,
  basePayload: Record<string, string>,
  accountId: string,
  accumulator: FacebookGroupJoinedData[]
): Promise<void> {
  const variables = JSON.stringify({
    count: 20,
    cursor: cursor,
    ordering: ["integrity_signals"],
    scale: 1,
  });

  const body = new URLSearchParams();
  for (const [key, val] of Object.entries(basePayload)) {
    body.append(key, val);
  }
  body.append("fb_api_caller_class", "RelayModern");
  body.append("fb_api_req_friendly_name", "GroupsCometAllJoinedGroupsSectionPaginationQuery");
  body.append("variables", variables);
  body.append("doc_id", "6009728632468556");

  const res = await fetch("https://web.facebook.com/api/graphql/", {
    method: "POST",
    credentials: "include",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      accept: "*/*",
      "accept-language": "en-US,en;q=0.9",
      "x-fb-friendly-name": "GroupsCometAllJoinedGroupsSectionPaginationQuery",
      "x-fb-lsd": basePayload["lsd"] || "",
      "sec-fetch-dest": "empty",
      "sec-fetch-mode": "cors",
      "sec-fetch-site": "same-origin",
    },
    body: body.toString(),
  });

  if (!res.ok) {
    throw new Error(`GraphQL request failed: ${res.status} ${res.statusText}`);
  }

  const text = await res.text();
  const cleanText = stripFacebookAntiCsrfPrefix(text);
  const json = JSON.parse(cleanText);

  if (json?.error) {
    throw new Error(`Facebook API error ${json.error}: ${json.errorSummary || json.errorDescription || "Unknown"}`);
  }

  const listData =
    json?.data?.viewer?.all_joined_groups?.tab_groups_list ||
    json?.data?.viewer?.groups_tab?.tab_groups_list;

  if (!listData || !Array.isArray(listData.edges)) {
    return;
  }

  for (const edge of listData.edges) {
    const node = edge?.node;
    const groupId = node?.id;
    if (!groupId) continue;

    accumulator.push({
      id: groupId,
      entry_rowkey: groupId,
      docType: "JoinedGroup",
      status: "joined",
      type: node?.if_viewer_can_see_membership_questions !== null ? "private_group" : "group",
      name: node?.name || "",
      channel_name: "facebook",
      url: node?.url || "",
      account_id: accountId,
      crawled_time: Date.now(),
    });
  }

  const endCursor = listData.page_info?.end_cursor;
  const hasNextPage = listData.page_info?.has_next_page;

  if (endCursor && hasNextPage) {
    await fetchGroupsPage(endCursor, basePayload, accountId, accumulator);
  }
}

async function fetchPendingGroupsPage(
  cursor: string | null,
  basePayload: Record<string, string>,
  accountId: string,
  accumulator: FacebookGroupJoinedData[]
): Promise<void> {
  const variables = JSON.stringify({
    count: 20,
    cursor: cursor,
    ordering: ["integrity_signals"],
    scale: 1,
  });

  const body = new URLSearchParams();
  for (const [key, val] of Object.entries(basePayload)) {
    body.append(key, val);
  }
  body.append("fb_api_caller_class", "RelayModern");
  body.append("fb_api_req_friendly_name", "GroupsCometPendingGroupJoinsSectionPaginationQuery");
  body.append("variables", variables);
  body.append("doc_id", "9924911067556167");

  const res = await fetch("https://web.facebook.com/api/graphql/", {
    method: "POST",
    credentials: "include",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      accept: "*/*",
      "accept-language": "en-US,en;q=0.9",
      "x-fb-friendly-name": "GroupsCometPendingGroupJoinsSectionPaginationQuery",
      "x-fb-lsd": basePayload["lsd"] || "",
      "sec-fetch-dest": "empty",
      "sec-fetch-mode": "cors",
      "sec-fetch-site": "same-origin",
    },
    body: body.toString(),
  });

  if (!res.ok) {
    throw new Error(`GraphQL request failed: ${res.status} ${res.statusText}`);
  }

  const text = await res.text();
  const cleanText = stripFacebookAntiCsrfPrefix(text);
  const json = JSON.parse(cleanText);

  if (json?.error) {
    throw new Error(`Facebook API error ${json.error}: ${json.errorSummary || json.errorDescription || "Unknown"}`);
  }

  const listData = json?.data?.viewer?.pending_groups;

  if (!listData || !Array.isArray(listData.edges)) {
    return;
  }

  for (const edge of listData.edges) {
    const node = edge?.node;
    const groupId = node?.id;
    if (!groupId) continue;

    accumulator.push({
      id: groupId,
      entry_rowkey: groupId,
      docType: "JoinedGroup",
      status: "requested",
      type: node?.if_viewer_can_see_membership_questions !== null ? "private_group" : "group",
      name: node?.name || "",
      channel_name: "facebook",
      url: node?.url || "",
      account_id: accountId,
      crawled_time: Date.now(),
    });
  }

  const endCursor = listData.page_info?.end_cursor;
  const hasNextPage = listData.page_info?.has_next_page;

  if (endCursor && hasNextPage) {
    await fetchPendingGroupsPage(endCursor, basePayload, accountId, accumulator);
  }
}

export async function fetchAllFbPendingGroups(accountId: string): Promise<FacebookGroupJoinedData[]> {
  const tokens = await extractTokensFromFacebookPage();
  if (!tokens) {
    throw new Error("Could not extract Facebook authentication tokens from the page.");
  }

  const { fb_dtsg, userId, lsd, hasteSession, rev, hsi, spin_r, spin_b, spin_t, jazoest, connectionClass } = tokens;

  const basePayload: Record<string, string> = {
    av: userId,
    __user: userId,
    fb_dtsg,
    __a: "1",
    __req: "1t",
    dpr: "1",
  };

  if (lsd) basePayload["lsd"] = lsd;
  if (hasteSession) basePayload["__hs"] = hasteSession;
  if (connectionClass) basePayload["__ccg"] = connectionClass;
  if (rev) basePayload["__rev"] = rev;
  if (hsi) basePayload["__hsi"] = hsi;
  if (spin_r) basePayload["__spin_r"] = spin_r;
  if (spin_b) basePayload["__spin_b"] = spin_b;
  if (spin_t) basePayload["__spin_t"] = spin_t;
  if (jazoest) basePayload["jazoest"] = jazoest;

  const allGroups: FacebookGroupJoinedData[] = [];
  await fetchPendingGroupsPage(null, basePayload, accountId, allGroups);
  return allGroups;
}

export async function fetchAllFbJoinedGroups(accountId: string): Promise<FacebookGroupJoinedData[]> {
  const tokens = await extractTokensFromFacebookPage();
  if (!tokens) {
    throw new Error("Could not extract Facebook authentication tokens from the page.");
  }

  const { fb_dtsg, userId, lsd, hasteSession, rev, hsi, spin_r, spin_b, spin_t, jazoest, connectionClass } = tokens;

  const basePayload: Record<string, string> = {
    av: userId,
    __user: userId,
    fb_dtsg,
    __a: "1",
    __req: "1t",
    dpr: "1",
  };

  if (lsd) basePayload["lsd"] = lsd;
  if (hasteSession) basePayload["__hs"] = hasteSession;
  if (connectionClass) basePayload["__ccg"] = connectionClass;
  if (rev) basePayload["__rev"] = rev;
  if (hsi) basePayload["__hsi"] = hsi;
  if (spin_r) basePayload["__spin_r"] = spin_r;
  if (spin_b) basePayload["__spin_b"] = spin_b;
  if (spin_t) basePayload["__spin_t"] = spin_t;
  if (jazoest) basePayload["jazoest"] = jazoest;

  const allGroups: FacebookGroupJoinedData[] = [];
  await fetchGroupsPage(null, basePayload, accountId, allGroups);
  return allGroups;
}
