import { FacebookPostData, ParseType } from "@/utils/parsers/types";
import { HandlerContext } from "../../types/handle";
import { chromeApi } from "../../infrastructure/chrome-api/chrome-api";

export const handleFbPostInfo = async (dt: ParseType, ctx: HandlerContext) => {
  const {
    senderTabId,
    cachedFacebookData,
    MAXIMUM_RECORD_ARCHIVED,
    MAXIMUM_TIME_WAIT_SECOND,
    sendFacebookUserData,
    sendFacebookCachedData,
    SEND_FACEBOOK_DATA_ALARM,
  } = ctx;

  const { data } = dt;
  const crawledPostData = data as FacebookPostData[];
  console.log("[Facebook Interceptor] Found crawled posts - Posts:", crawledPostData?.length);

  if (!Array.isArray(crawledPostData) || !crawledPostData.length) return;

  cachedFacebookData.push(...crawledPostData);
  console.log("[Facebook Interceptor] Total in queue - Records:", cachedFacebookData.length);

  const ownerData = crawledPostData.map((post) => ({
    owner_id: post.owner_id,
    owner_name: post.owner_name,
    owner_type: post.owner_type,
  }));

  // console.log("[Facebook Interceptor] Checking post owner status for owners:", ownerData);

  // injecting the labels status in DOM
  checkStatusPostOwner(ownerData)
    .then((mergedResult) => {
      // console.log("[Facebook Interceptor] Post owner status check result:", mergedResult);
      // You can further process the mergedResult if needed, such as caching it or sending it to the server

      chromeApi.tabs.sendMessage(senderTabId, {
        activityName: "INJECT_POST_OWNER_DATA",
        tabId: senderTabId,
        taskId: "inject_post_owner_data_task",
        inputs: {
          enhanceConfig: mergedResult,
        },
      });
    })
    .catch((error) => {
      console.error(
        "[Facebook Interceptor] Error checking post owner status:",
        error,
      );
    });

  // get all the post owner that is a group
  // const groupPostOwners = crawledPostData

  if (cachedFacebookData.length >= MAXIMUM_RECORD_ARCHIVED) {
    sendFacebookCachedData();
    sendFacebookUserData();
  } else {
    console.log("[Facebook Interceptor] Scheduling send in", MAXIMUM_TIME_WAIT_SECOND, "seconds");
    chromeApi.alarms.create(SEND_FACEBOOK_DATA_ALARM, {
      delayInMinutes: Math.max(0.05, MAXIMUM_TIME_WAIT_SECOND / 60),
    });
  }
};

async function checkStatusPostOwner(ownerData: any[]) {
  const profileIdsArr = ownerData.map((owner) => owner.owner_id);

  // console.log("[Facebook Interceptor] Checking post owner status for profile IDs:", profileIdsArr);

  const myUrl = new URL(`${import.meta.env.VITE_AXIOS_BASE_URL}/profiles`);
  myUrl.searchParams.set("filter", JSON.stringify({ "where": { "profile_id": { "inq": profileIdsArr } } }));
  // console.log("[Facebook Interceptor] Fetching post owner status from URL:", myUrl.toString());

  const res = await fetch(myUrl.toString(), {
    method: "GET",
    headers: {
      "Content-Type": "application/json"
    }
  });

  if (!res.ok) {
    console.log("Failed to check post owner status:", res.statusText);
    return [];
  }
  const profileFetchedResult = await res.json();
  // console.log("[Facebook Interceptor] Post owner status fetch result:", profileFetchedResult);
  // map 2 array with owner_id and id
  const mergedResult = ownerData.map((owner) => {
    const findingProfile = profileFetchedResult.find((res: any) => res.profile_id === owner.owner_id);
    const statusValues = ["ASSIGNED", "UNASSIGNED"];
    let status = "NOT_EXIST_NO_UPDATE";

    if (!findingProfile) {
      status = "NOT_EXIST";
    } else {
      let profileStatus = [];
      if (Array.isArray(findingProfile.assign_status)) {
        profileStatus = findingProfile.assign_status.filter((item: string) => statusValues.includes(item));
      }

      if (profileStatus.length > 1) {
        console.warn("[Facebook Interceptor] Multiple status found for owner_id:", owner.owner_id);
        return;
      }

      if (profileStatus.length === 1) {
        status = profileStatus[0];
      }

      if (profileStatus.length === 0) {
        status = "NOT_EXIST_NO_UPDATE";
      }
    }

    console.log(`[Facebook Interceptor] Owner ID: ${owner.owner_id}, Status: ${status}`);
    return { ...owner, status: status };
  }).filter((item) => item !== undefined);

  // console.log("[Facebook Interceptor] Merged result:", mergedResult);

  return mergedResult;
  //temporary source feature
  // console.log(
  //   "[Facebook Interceptor] checkStatusPostOwner bypassed; API request validation is disabled.",
  // );
  // return ownerData.map((owner) => ({
  //   ...owner,
  //   status: "UNKNOWN",
  // }));
}
