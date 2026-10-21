import { Result, XAttachment, YoutubeProfileLocalStorageInfo, YoutubeUserProfileData } from "../types";
import { findByKey, parseYoutubeProfilesInfo, storeYoutubeProfileData, YOUTUBE_PROFILE_INFO_KEY } from "./utils";
import * as services from "../../../services";

export async function parseDataUserProfile(data: any, type: "channelPage" | "channelAbout"): Promise<Result<YoutubeUserProfileData[]>> {
    try {
        if (type === "channelPage") {
            const parsedProfile = normalizeOverviewProfileData(data);
            await storeYoutubeProfileData([parsedProfile])
            return {
                ok: true,
                data: []
            }
        }

        const parsedProfile = await normalizeAboutProfileData(data);
        return {
            ok: true,
            data: [parsedProfile]
        }
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

async function normalizeAboutProfileData(aboutChannelRenderer: any): Promise<YoutubeUserProfileData> {
    const aboutMetadata = aboutChannelRenderer.metadata.aboutChannelViewModel;

    const links: { link: string, title: string }[] = [];
    if (Array.isArray(aboutMetadata.links)) {
        aboutMetadata.links.forEach((link: any) => {
            try {
                const youtubeRedirectUrl = link?.channelExternalLinkViewModel?.link?.commandRuns?.[0].onTap?.innertubeCommand?.urlEndpoint.url;
                if (youtubeRedirectUrl) {
                    const parsedUrl = new URL(youtubeRedirectUrl);
                    const externalUrl = parsedUrl.searchParams.get("q");
                    links.push({
                        title: link?.channelExternalLinkViewModel?.title?.content ?? "",
                        link: externalUrl ?? youtubeRedirectUrl
                    })
                }
            } catch (_) { }
        })
    }

    const localStorageProfile = await services.storageServices.getStorageByKeys([YOUTUBE_PROFILE_INFO_KEY]);
    const youtubeProfilesCached = localStorageProfile[YOUTUBE_PROFILE_INFO_KEY] || "";
    const youtubeProfilesCachedArr = parseYoutubeProfilesInfo(youtubeProfilesCached);
    const youtubeProfileById = youtubeProfilesCachedArr.find(p => p.profile_id === aboutMetadata.channelId);

    return {
        entry_rowkey: aboutMetadata.channelId,
        profile_id: aboutMetadata.channelId,
        name: youtubeProfileById?.name ?? "",
        username: youtubeProfileById?.username ?? "",
        url: `https://www.youtube.com/channel/${aboutMetadata.channelId}`,
        country: aboutMetadata.country,
        description: aboutMetadata.description,
        links: links,
        attachments: youtubeProfileById?.attachments ?? [],
        joined_date: aboutMetadata.joinedDateText?.content ?? aboutMetadata.joinedDateText,
        view_count: aboutMetadata.viewCountText,
        video_count: aboutMetadata.videoCountText,
        subscriber_count: aboutMetadata.subscriberCountText,
        channel_name: "youtube",
        type: "channel",
        docType: "Profile",
        tenant_ids: [],
        created_at: Date.now(),
        datef: new Date().getFullYear(),
        "@timestamp": new Date().toISOString(),
        ttl: 86400,
        active: true,
    }
}