import { Result, XAttachment, YoutubeProfileLocalStorageInfo, YoutubeUserProfileData } from "../types";
import { findByKey } from "./utils";

export async function parseDataUserChannel(payload: any): Promise<Result<YoutubeProfileLocalStorageInfo[]>> {
    try {
        const channelMetadata = payload.metadata.channelMetadataRenderer;

        const attachments: XAttachment[] = []
        const banner = findByKey(payload, "banner")?.imageBannerViewModel?.image?.sources?.[0];
        if (banner) {
            attachments.push({
                url: banner.url,
                width: banner.width,
                height: banner.height,
                type: "image"
            })
        }
        const avatar = channelMetadata.avatar?.thumbnails?.[0];
        if (avatar) {
            attachments.push({
                url: avatar.url,
                width: avatar.width,
                height: avatar.height,
                type: "image"
            })
        }

        let username = "";
        const usernamePart = findByKey(payload.header, "metadataParts");
        if (Array.isArray(usernamePart)) {
            const rawUsername = usernamePart.map((part: any) => part.text?.content as string).find((username) => username?.startsWith("@"));
            if (rawUsername) {
                username = rawUsername.substring(1)
            }
        }

        const parsedProfile = {
            profile_id: channelMetadata.externalId,
            name: channelMetadata.title,
            username: username,
            attachments: attachments,
        }

        // const parsedProfile = normalizeOverviewProfileData(payload);
        // await storeYoutubeProfileData([parsedProfile]);
        return { ok: true, data: [parsedProfile] }
    } catch (error: any) {
        console.error(
            "Error (Youtube Profile data parser)",
            error?.message
        );
        return { ok: false, error: new Error("Failed to parse Youtube profile data") };
    }
}

function normalizeOverviewProfileData(data: any): YoutubeProfileLocalStorageInfo {
    const channelMetadata = data.metadata.channelMetadataRenderer;

    const attachments: XAttachment[] = []
    const banner = findByKey(data, "banner")?.imageBannerViewModel?.image?.sources?.[0];
    if (banner) {
        attachments.push({
            url: banner.url,
            width: banner.width,
            height: banner.height,
            type: "image"
        })
    }
    const avatar = channelMetadata.avatar?.thumbnails?.[0];
    if (avatar) {
        attachments.push({
            url: avatar.url,
            width: avatar.width,
            height: avatar.height,
            type: "image"
        })
    }

    let username = "";
    const usernamePart = findByKey(data.header, "metadataParts");
    if (Array.isArray(usernamePart)) {
        const rawUsername = usernamePart.map((part: any) => part.text?.content as string).find((username) => username?.startsWith("@"));
        if (rawUsername) {
            username = rawUsername.substring(1)
        }
    }

    return {
        profile_id: channelMetadata.externalId,
        name: channelMetadata.title,
        username: username,
        attachments: attachments,
    }
}
