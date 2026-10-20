import { FacebookProfileData, Result } from "../types";

export async function parseDataGroupHover(payload: any): Promise<Result<FacebookProfileData>> {
    try {
        const commetHoverCardRenderer = payload?.node?.comet_hovercard_renderer || payload?.data?.node?.comet_hovercard_renderer;
        if (!commetHoverCardRenderer) {
            // console.error("Comet hover card renderer not found in payload:", payload);
            return { ok: false, error: new Error("Comet hover card renderer not found") };
        }

        const typeName = commetHoverCardRenderer.__typename;
        const isGroup = typeName === "CometHovercardGroupRenderer";
        const isPage = typeName === "CometHovercardProfilePlusUserRenderer";
        const isPerson = typeName === "CometHovercardUserRenderer";

        // console.log("[Facebook Interceptor] Parsing hover card data - Type:", typeName, "isGroup:", isGroup, "isPage:", isPage, "isPerson:", isPerson);

        if (isGroup) {
            const membersNumber = commetHoverCardRenderer.group.group_member_profiles.formatted_count_text;
            const groupType = commetHoverCardRenderer.group.privacy_info.title.text;
            let profileType = "unknown_group_type";
            if (groupType === "Private group") {
                profileType = "private_group";
            }
            if (groupType === "Public group") {
                profileType = "group";
            }
            const data: FacebookProfileData = {
                profile_id: commetHoverCardRenderer.group.id || "",
                profile_name: commetHoverCardRenderer.group.name || "",
                profile_url: commetHoverCardRenderer.group.profile_url || "",
                profile_type: profileType,
                entry_rowkey: commetHoverCardRenderer.group.id || "",
                docType: profileType !== "unknown_group_type" ? "Profile" : "UnknownHoverProfile",
                created_time: Date.now(),
                updated_time: Date.now(),
                base_data: {
                    groupType,
                    membersNumber
                },
                channel_name: "facebook"
            }

            console.log("[Facebook Interceptor] Parsed hover group data:", data);
            return { ok: true, data };
        }

        if (isPage) {
            const timelineContextItems = commetHoverCardRenderer.user.timeline_context_items.nodes;

            // Followers number
            let followersNumber = "";
            const followersNumberItem = timelineContextItems[timelineContextItems.length - 1];
            if (followersNumberItem) {
                followersNumber = followersNumberItem?.title?.text || "";
            }

            // remove the first and the last element of the array
            timelineContextItems.shift();
            timelineContextItems.pop();
            let descTexts = "";
            for (const item of timelineContextItems) {
                descTexts += item?.title?.text || "";
            }
            const isVerified = commetHoverCardRenderer.is_verified
            const data: FacebookProfileData = {
                profile_id: commetHoverCardRenderer.user.id || "",
                profile_name: commetHoverCardRenderer.user.name || "",
                profile_url: commetHoverCardRenderer.user.profile_url || "",
                entry_rowkey: commetHoverCardRenderer.user.id || "",
                profile_type: "fanpage",
                docType: "Profile",
                created_time: Date.now(),
                updated_time: Date.now(),
                base_data: {
                    followersNumber,
                    descTexts,
                    isVerified
                },
                channel_name: "facebook"
            }

            console.log("[Facebook Interceptor] Parsed hover page data:", data);
            return { ok: true, data };
        }

        if (isPerson) {
            const isVerified = commetHoverCardRenderer.is_verified
            const data: FacebookProfileData = {
                profile_id: commetHoverCardRenderer.user.id || "",
                profile_name: commetHoverCardRenderer.user.name || "",
                profile_url: commetHoverCardRenderer.user.profile_url || "",
                entry_rowkey: commetHoverCardRenderer.user.id || "",
                profile_type: "person",
                docType: "Profile",
                created_time: Date.now(),
                updated_time: Date.now(),
                base_data: {
                    isVerified
                },
                channel_name: "facebook"
            }

            console.log("[Facebook Interceptor] Parsed hover page data:", data);
            return { ok: true, data };
        }

        return { ok: false, error: new Error("Not implemented yet") };

    } catch (error: any) {
        console.error("Error parsing Facebook hover group data:", error);
        return { ok: false, error };
    }
}

export function parseDataGroup(dataGroup: any): any {
    // base_data: 
    // BASIC_INFO: Details
    // + BusinessHoursDirectoryFieldSectionViewRenderer
    // + DefaultDirectoryFieldSectionViewRenderer
    // LINKS:
    // + MiddotListDirectoryFieldSectionViewRenderer
}

// https://web.facebook.com/groups/1347892135361995/about