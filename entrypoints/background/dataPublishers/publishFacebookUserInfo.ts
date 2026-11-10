// export async function publishFacebookUserInfo(options: PublishFacebookUserInfoOptions = {})
//     : Promise<{
//         ok: boolean;
//         error?: string;
//         userInfoPublishStatus?: UserInfoPublishStatus;
//         pendingUserInfoList?: PendingUserInfo[];
//         pendingUserInfo?: PendingUserInfo | null;
//     }> {
//     const {
//         overrideRaw = "",
//         overrideParsed,
//         overrideId,
//         overrideTs,
//         waitForDescription = true,
//     } = options;

//     let { pendingUserInfo, pendingUserInfoList } = await services.storageService.getStorageCachedByKeys(["pendingUserInfo", "pendingUserInfoList"]);

//     let candidateParsed = overrideParsed || (overrideRaw ? undefined : pendingUserInfo?.parsed);
//     if (!candidateParsed && overrideRaw) {
//         try {
//             candidateParsed = JSON.parse(overrideRaw);
//         } catch {
//             candidateParsed = undefined;
//         }
//     }
//     if (!candidateParsed && pendingUserInfo?.raw) {
//         try {
//             candidateParsed = JSON.parse(pendingUserInfo.raw);
//         } catch {
//             candidateParsed = pendingUserInfo?.parsed;
//         }
//     }

//     const filtered = helpers.userInfo.filterUserProfilePayload(candidateParsed);
//     if (!filtered) {
//         const failStatus: UserInfoPublishStatus = {
//             status: "failed",
//             ts: Date.now(),
//             message: "User profile data is missing required fields (id, name).",
//         };
//         await services.storageService.setStorageCached({ userInfoPublishStatus: failStatus });
//         return { ok: false, error: failStatus.message, userInfoPublishStatus: failStatus };
//     }

//     let profileToPublish = filtered;

//     const shouldWaitForDescription = waitForDescription && !helpers.userInfo.hasUserDescription(profileToPublish);
//     if (shouldWaitForDescription) {
//         await services.storageService.setStorageCached({
//             userInfoPublishStatus: {
//                 status: "pending",
//                 ts: Date.now(),
//                 message: "Waiting for profile description...",
//             },
//         });

//         await helpers.userInfo.waitForUserInfoDescription(Constants.USERINFO_DESCRIPTION_WAIT_MS);
//         const refreshed = (await services.storageService.getStorageCachedByKeys(["pendingUserInfo"])) || {};
//         pendingUserInfo = refreshed.pendingUserInfo || pendingUserInfo;
//         const refreshedParsed =
//             pendingUserInfo?.parsed ||
//             (() => {
//                 try { return pendingUserInfo?.raw ? JSON.parse(pendingUserInfo.raw) : undefined; }
//                 catch { return undefined; }
//             })();
//         profileToPublish = helpers.userInfo.filterUserProfilePayload(refreshedParsed) || profileToPublish;
//     }

//     if (!helpers.userInfo.isUserProfileCollectReady(profileToPublish)) {
//         const missingBeforeWait = helpers.userInfo.getMissingUserProfileCollectFields(profileToPublish);
//         await services.storageService.setStorageCached({
//             userInfoPublishStatus: {
//                 status: "pending",
//                 ts: Date.now(),
//                 message: `Waiting for profile fields: ${missingBeforeWait.join(", ")}`,
//             },
//         });

//         const afterWait = await helpers.userInfo.waitForUserInfoCollectReady(Constants.USERINFO_COLLECT_WAIT_MS);
//         if (afterWait && helpers.userInfo.isUserProfileCollectReady(afterWait)) {
//             profileToPublish = afterWait;
//             const refreshed = (await services.storageService.getStorageCachedByKeys(["pendingUserInfo"])) || {};
//             pendingUserInfo = refreshed.pendingUserInfo || pendingUserInfo;
//         }
//     }

//     if (!helpers.userInfo.isUserProfileCollectReady(profileToPublish)) {
//         const missing = helpers.userInfo.getMissingUserProfileCollectFields(profileToPublish);
//         const pendingStatus: UserInfoPublishStatus = {
//             status: "pending",
//             ts: Date.now(),
//             message: `Waiting for profile fields: ${missing.join(", ")}`,
//         };
//         await services.storageService.setStorageCached({ userInfoPublishStatus: pendingStatus });
//         return {
//             ok: false,
//             error: pendingStatus.message,
//             userInfoPublishStatus: pendingStatus,
//             pendingUserInfoList,
//             pendingUserInfo,
//         };
//     }

//     bgState.cachedFacebookUserInfoToPublish = JSON.stringify(profileToPublish);

//     await services.storageService.setStorageCached({
//         userInfoPublishStatus: {
//             status: "pending",
//             ts: Date.now(),
//             message: "Publishing user data...",
//         },
//     });

//     await publishFacebookUserData();

//     const sent = bgState.cachedFacebookUserInfoToPublish === null;
//     if (sent) {
//         const status: UserInfoPublishStatus = {
//             status: "sent",
//             ts: Date.now(),
//             message: "[User] Sent successfully!",
//         };

//         const list = Array.isArray(pendingUserInfoList) ? pendingUserInfoList : [];
//         const removeId = overrideId || pendingUserInfo?.id || undefined;
//         const removeTs =
//             typeof overrideTs === "number"
//                 ? overrideTs
//                 : pendingUserInfo?.ts;
//         const nextList = helpers.userInfo.removePendingUserInfo(list, {
//             id: removeId,
//             ts: typeof removeTs === "number" ? removeTs : undefined,
//         });
//         const nextPending = nextList.length ? nextList[nextList.length - 1] : null;

//         await services.storageService.setStorageCached({
//             pendingUserInfo: nextPending,
//             pendingUserInfoList: nextList,
//             userInfoPublishStatus: status,
//         });

//         return {
//             ok: true,
//             userInfoPublishStatus: status,
//             pendingUserInfoList: nextList,
//             pendingUserInfo: nextPending,
//         };
//     }

//     if (bgState.cachedFacebookUserInfoToPublish) {
//         try {
//             const parsed = JSON.parse(bgState.cachedFacebookUserInfoToPublish);
//             const filtered = helpers.userInfo.filterUserProfilePayload(parsed);
//             if (filtered && !helpers.userInfo.isUserProfileCollectReady(filtered)) {
//                 const missing = helpers.userInfo.getMissingUserProfileCollectFields(filtered);
//                 bgState.cachedFacebookUserInfoToPublish = null;
//                 const pendingStatus: UserInfoPublishStatus = {
//                     status: "pending",
//                     ts: Date.now(),
//                     message: `Waiting for profile fields: ${missing.join(", ")}`,
//                 };
//                 await services.storageService.setStorageCached({ userInfoPublishStatus: pendingStatus });
//                 return {
//                     ok: false,
//                     error: pendingStatus.message,
//                     userInfoPublishStatus: pendingStatus,
//                     pendingUserInfoList,
//                     pendingUserInfo,
//                 };
//             }
//         } catch {
//             // fall through to generic failure
//         }
//     }

//     const failStatus: UserInfoPublishStatus = {
//         status: "failed",
//         ts: Date.now(services),
//         message: "User data not published. Check topics/config.",
//     };

//     bgState.cachedFacebookUserInfoToPublish = null;

//     await services.storageService.setStorageCached({ userInfoPublishStatus: failStatus });
//     return {
//         ok: false, services
//     error: failStatus.message,
//         userInfoPublishStatus: failStatus,
//     };
// }