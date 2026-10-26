import {
    deriveUsernameFromUrl,
    extractProfileOwnerCandidate,
    normalizeFieldKey,
    normalizeGenderLabel,
    normalizePlaceText
} from "./utils";
import { FacebookUserData, Result } from "../types";


export function parseDataUserProfile(payload: any): Result<FacebookUserData> {
    try {
        const dataUser =
            payload?.data?.user ||
            payload?.data?.node?.user;
        // payload?.data?.node?.comet_hovercard_renderer?.user ||
        // payload?.data?.node?.comet_hovercard_renderer?.profile_plus_viewer?.user;
        if (!dataUser) {
            // console.error("User data not found in payload:", payload);
            return { ok: false, error: new Error("User data not found") };
        }
        const header = dataUser?.profile_header_renderer;
        const topRow = header?.user?.header_top_row || header?.header_top_row;
        const profileUser = topRow?.profile_user;
        const u =
            header?.user ||
            profileUser ||
            dataUser;
        const profileOwner = extractProfileOwnerCandidate(payload);
        const deriveNameFromTruncation = (text: any): string | undefined => {
            if (typeof text !== "string") return undefined;
            const t = text.trim();
            if (!t) return undefined;
            // Example: "See more about Sơn" -> "Sơn"
            const m = t.match(/see more about\s+(.+)$/i);
            return (m?.[1] || t).trim() || undefined;
        };

        const resolvedId = u?.id || profileOwner?.id;
        const resolvedName =
            u?.name ??
            dataUser?.name ??
            profileOwner?.name ??
            deriveNameFromTruncation(dataUser?.directory_tile_section_truncation_string?.text);

        if (!resolvedId || typeof resolvedName !== "string" || !resolvedName)
            return { ok: false, error: new Error("Unable to resolve user ID or name") };

        const socialContext =
            header?.profile_social_context ||
            profileUser?.profile_social_context ||
            header?.user?.profile_social_context;
        const socialContent: any[] = Array.isArray(socialContext?.content)
            ? socialContext.content
            : [];

        const followerItem =
            socialContent.find((e) => String(e?.uri || "").toLowerCase().includes("/followers")) || socialContent[0];
        const followingItem =
            socialContent.find((e) => String(e?.uri || "").toLowerCase().includes("/following")) || socialContent[1];

        const followersText = followerItem?.text?.text;
        const followingText = followingItem?.text?.text;
        // const followersUrl = followerItem?.uri;
        // const followingUrl = followingItem?.uri;

        const contextEdges = topRow?.profile_intro_card?.context_items?.edges || [];
        const contextByType: Record<string, string> = {};
        const contextTextByType: Record<string, string> = {};
        if (Array.isArray(contextEdges)) {
            for (const edge of contextEdges) {
                const node = edge?.node;
                const key = normalizeFieldKey(node?.profile_field_type);
                const value = node?.short_title?.text;
                if (key && typeof value === "string" && value) {
                    contextByType[key] = value;
                }
            }
        }

        // Fallback for newer payloads: extract fields from "Personal details" tiles.
        // Example path: data.user.profile_tile_sections.edges[].node.profile_tile_views.nodes[].view_style_renderer.view.profile_tile_items.nodes[].directory_tile_item_renderer.tile_item
        try {
            const tileEdges: any[] =
                Array.isArray(dataUser?.profile_tile_sections?.edges)
                    ? dataUser.profile_tile_sections.edges
                    : [];

            for (const edge of tileEdges) {
                const sectionNode = edge?.node;
                const views = sectionNode?.profile_tile_views?.nodes;
                if (!Array.isArray(views)) continue;

                for (const viewNode of views) {
                    const view = viewNode?.view_style_renderer?.view;
                    const items = view?.profile_tile_items?.nodes;
                    if (!Array.isArray(items)) continue;

                    for (const item of items) {
                        const tileItem = item?.directory_tile_item_renderer?.tile_item;
                        if (!tileItem) continue;

                        const fieldTypeRaw: string | undefined =
                            tileItem?.pressable_profile_field_type ||
                            tileItem?.profile_field_type ||
                            tileItem?.field_type;
                        const fieldType = normalizeFieldKey(fieldTypeRaw);
                        const subtitleText: any =
                            tileItem?.item_subtitle?.text?.text ||
                            tileItem?.item_subtitle?.text ||
                            tileItem?.subtitle?.text ||
                            tileItem?.subtitle;
                        const subtitleTextString =
                            typeof subtitleText === "string" && subtitleText.trim()
                                ? subtitleText.trim()
                                : undefined;
                        const normalizedSubtitle = normalizePlaceText(subtitleText);

                        if (
                            fieldType === "current_city" ||
                            fieldType === "hometown" ||
                            fieldType === "work"
                        ) {
                            // Keep both raw tile text ("Lives in ...", "From ...") and normalized value.
                            if (subtitleTextString) contextTextByType[fieldType] = subtitleTextString;
                            if (normalizedSubtitle) contextByType[fieldType] = normalizedSubtitle;
                        }

                        // Gender tile doesn't always have a pressable field type.
                        if (
                            typeof subtitleText === "string" &&
                            subtitleText.trim() &&
                            item?.directory_tile_item_renderer?.__typename === "GenderDirectoryFieldSectionViewRenderer" &&
                            !contextByType["gender"]
                        ) {
                            contextByType["gender"] = subtitleText.trim();
                        }
                    }
                }
            }
        } catch { }

        const bio = profileUser?.profile_status?.profile_status_text?.text;

        const usernameRaw =
            u?.username_for_profile ??
            profileUser?.username_for_profile ??
            header?.username_for_profile;
        const username =
            typeof usernameRaw === "string" && usernameRaw.trim()
                ? usernameRaw.trim()
                : deriveUsernameFromUrl(u?.url);

        const alternateNameRaw = u?.alternate_name ?? profileUser?.alternate_name ?? header?.alternate_name;
        const alternate_name =
            typeof alternateNameRaw === "string" && alternateNameRaw.trim()
                ? alternateNameRaw.trim()
                : undefined;

        const hometown =
            contextByType["hometown"] ||
            contextByType["home_town"] ||
            contextByType["hometown_city"];

        const userInfo: any = {
            id: String(resolvedId),
            name: u?.name ?? dataUser?.name ?? profileOwner?.name,
            username,
            alternate_name: alternate_name,
            url: typeof u?.url === "string" ? u.url : undefined,
            gender: normalizeGenderLabel(typeof u?.gender === "string" ? u.gender : contextByType["gender"]),
            profile_picture: u?.profilePicLarge?.uri,
            cover_photo:
                header?.user?.cover_photo?.photo?.image?.uri ||
                u?.cover_photo?.photo?.image?.uri,
            followers_text: typeof followersText === "string" ? followersText : undefined,
            following_text: typeof followingText === "string" ? followingText : undefined,
            category: contextByType["category"],
            current_city: contextByType["current_city"],
            hometown,
            work: contextByType["work"],
            description: typeof bio === "string" ? bio : undefined,
            docType: "Profile",
        };

        // Archive expects fbU as a JSON string
        return { ok: true, data: userInfo };
    } catch (error: any) {
        console.error(
            "Error (Facebook User data parser)",
            error.message
        );
        return { ok: false, error: new Error("Failed to parse Facebook user data") };
    }
}

// DEPRECATED
// export function parseDataUserProfile(payload: any): Result<{ fbU: string }> {
//     try {
//         const dataUser =
//             payload?.data?.user ||
//             payload?.data?.node?.user;
//         // payload?.data?.node?.comet_hovercard_renderer?.user ||
//         // payload?.data?.node?.comet_hovercard_renderer?.profile_plus_viewer?.user;
//         if (!dataUser) {
//             // console.error("User data not found in payload:", payload);
//             return { ok: false, error: new Error("User data not found") };
//         }
//         const header = dataUser?.profile_header_renderer;
//         const topRow = header?.user?.header_top_row || header?.header_top_row;
//         const profileUser = topRow?.profile_user;
//         const u =
//             header?.user ||
//             profileUser ||
//             dataUser;
//         const profileOwner = extractProfileOwnerCandidate(payload);
//         const deriveNameFromTruncation = (text: any): string | undefined => {
//             if (typeof text !== "string") return undefined;
//             const t = text.trim();
//             if (!t) return undefined;
//             // Example: "See more about Sơn" -> "Sơn"
//             const m = t.match(/see more about\s+(.+)$/i);
//             return (m?.[1] || t).trim() || undefined;
//         };

//         const resolvedId = u?.id || profileOwner?.id;
//         const resolvedName =
//             u?.name ??
//             dataUser?.name ??
//             profileOwner?.name ??
//             deriveNameFromTruncation(dataUser?.directory_tile_section_truncation_string?.text);

//         if (!resolvedId || typeof resolvedName !== "string" || !resolvedName)
//             return { ok: false, error: new Error("Unable to resolve user ID or name") };

//         const socialContext =
//             header?.profile_social_context ||
//             profileUser?.profile_social_context ||
//             header?.user?.profile_social_context;
//         const socialContent: any[] = Array.isArray(socialContext?.content)
//             ? socialContext.content
//             : [];

//         const followerItem =
//             socialContent.find((e) => String(e?.uri || "").toLowerCase().includes("/followers")) || socialContent[0];
//         const followingItem =
//             socialContent.find((e) => String(e?.uri || "").toLowerCase().includes("/following")) || socialContent[1];

//         const followersText = followerItem?.text?.text;
//         const followingText = followingItem?.text?.text;
//         // const followersUrl = followerItem?.uri;
//         // const followingUrl = followingItem?.uri;

//         const contextEdges = topRow?.profile_intro_card?.context_items?.edges || [];
//         const contextByType: Record<string, string> = {};
//         const contextTextByType: Record<string, string> = {};
//         if (Array.isArray(contextEdges)) {
//             for (const edge of contextEdges) {
//                 const node = edge?.node;
//                 const key = normalizeFieldKey(node?.profile_field_type);
//                 const value = node?.short_title?.text;
//                 if (key && typeof value === "string" && value) {
//                     contextByType[key] = value;
//                 }
//             }
//         }

//         // Fallback for newer payloads: extract fields from "Personal details" tiles.
//         // Example path: data.user.profile_tile_sections.edges[].node.profile_tile_views.nodes[].view_style_renderer.view.profile_tile_items.nodes[].directory_tile_item_renderer.tile_item
//         try {
//             const tileEdges: any[] =
//                 Array.isArray(dataUser?.profile_tile_sections?.edges)
//                     ? dataUser.profile_tile_sections.edges
//                     : [];

//             for (const edge of tileEdges) {
//                 const sectionNode = edge?.node;
//                 const views = sectionNode?.profile_tile_views?.nodes;
//                 if (!Array.isArray(views)) continue;

//                 for (const viewNode of views) {
//                     const view = viewNode?.view_style_renderer?.view;
//                     const items = view?.profile_tile_items?.nodes;
//                     if (!Array.isArray(items)) continue;

//                     for (const item of items) {
//                         const tileItem = item?.directory_tile_item_renderer?.tile_item;
//                         if (!tileItem) continue;

//                         const fieldTypeRaw: string | undefined =
//                             tileItem?.pressable_profile_field_type ||
//                             tileItem?.profile_field_type ||
//                             tileItem?.field_type;
//                         const fieldType = normalizeFieldKey(fieldTypeRaw);
//                         const subtitleText: any =
//                             tileItem?.item_subtitle?.text?.text ||
//                             tileItem?.item_subtitle?.text ||
//                             tileItem?.subtitle?.text ||
//                             tileItem?.subtitle;
//                         const subtitleTextString =
//                             typeof subtitleText === "string" && subtitleText.trim()
//                                 ? subtitleText.trim()
//                                 : undefined;
//                         const normalizedSubtitle = normalizePlaceText(subtitleText);

//                         if (
//                             fieldType === "current_city" ||
//                             fieldType === "hometown" ||
//                             fieldType === "work"
//                         ) {
//                             // Keep both raw tile text ("Lives in ...", "From ...") and normalized value.
//                             if (subtitleTextString) contextTextByType[fieldType] = subtitleTextString;
//                             if (normalizedSubtitle) contextByType[fieldType] = normalizedSubtitle;
//                         }

//                         // Gender tile doesn't always have a pressable field type.
//                         if (
//                             typeof subtitleText === "string" &&
//                             subtitleText.trim() &&
//                             item?.directory_tile_item_renderer?.__typename === "GenderDirectoryFieldSectionViewRenderer" &&
//                             !contextByType["gender"]
//                         ) {
//                             contextByType["gender"] = subtitleText.trim();
//                         }
//                     }
//                 }
//             }
//         } catch { }

//         const bio = profileUser?.profile_status?.profile_status_text?.text;

//         const usernameRaw =
//             u?.username_for_profile ??
//             profileUser?.username_for_profile ??
//             header?.username_for_profile;
//         const username =
//             typeof usernameRaw === "string" && usernameRaw.trim()
//                 ? usernameRaw.trim()
//                 : deriveUsernameFromUrl(u?.url);

//         const alternateNameRaw = u?.alternate_name ?? profileUser?.alternate_name ?? header?.alternate_name;
//         const alternate_name =
//             typeof alternateNameRaw === "string" && alternateNameRaw.trim()
//                 ? alternateNameRaw.trim()
//                 : undefined;

//         const hometown =
//             contextByType["hometown"] ||
//             contextByType["home_town"] ||
//             contextByType["hometown_city"];

//         const userInfo: any = {
//             id: String(resolvedId),
//             name: u?.name ?? dataUser?.name ?? profileOwner?.name,
//             username,
//             alternate_name: alternate_name,
//             url: typeof u?.url === "string" ? u.url : undefined,
//             gender: normalizeGenderLabel(typeof u?.gender === "string" ? u.gender : contextByType["gender"]),
//             profile_picture: u?.profilePicLarge?.uri,
//             cover_photo:
//                 header?.user?.cover_photo?.photo?.image?.uri ||
//                 u?.cover_photo?.photo?.image?.uri,
//             followers_text: typeof followersText === "string" ? followersText : undefined,
//             following_text: typeof followingText === "string" ? followingText : undefined,
//             category: contextByType["category"],
//             current_city: contextByType["current_city"],
//             hometown,
//             work: contextByType["work"],
//             description: typeof bio === "string" ? bio : undefined,
//             docType: "Profile",
//         };

//         // Archive expects fbU as a JSON string
//         return { ok: true, data: { fbU: JSON.stringify(userInfo) } };
//     } catch (error: any) {
//         console.error(
//             "Error (Facebook User data parser)",
//             error.message
//         );
//         return { ok: false, error: new Error("Failed to parse Facebook user data") };
//     }
// }