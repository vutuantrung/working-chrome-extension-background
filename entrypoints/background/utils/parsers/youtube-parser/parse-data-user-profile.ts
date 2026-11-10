import { Result, YoutubeProfileLocalStorageInfo, YoutubeUserProfileData } from "../types";

export async function parseDataUserProfile(
    payload: any,
    metaData: { cachedProfileArray: YoutubeProfileLocalStorageInfo[] }
): Promise<Result<YoutubeUserProfileData[]>> {
    try {
        const aboutMetadata = payload.metadata.aboutChannelViewModel;
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

        const youtubeProfileById = metaData.cachedProfileArray.find(p => p.profile_id === aboutMetadata.channelId);
        const parsedProfile: YoutubeUserProfileData = {
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

        // const parsedProfile = await normalizeAboutProfileData(payload, metaData.cachedProfileArray);
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