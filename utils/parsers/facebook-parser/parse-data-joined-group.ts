import { FacebookGroupJoinedData, Result } from "../types";

export async function parseDataJoinedGroup(payload: any): Promise<Result<{ fbGroupJoined: FacebookGroupJoinedData[] }>> {
    try {
        const edgesDataJoinedGroup =
            payload?.["data"]?.["viewer"]?.["groups_tab"]?.["tab_groups_list"]?.["edges"] ||
            payload?.["data"]?.["viewer"]?.["all_joined_groups"]?.["tab_groups_list"]?.["edges"];

        if (!Array.isArray(edgesDataJoinedGroup)) {
            return { ok: false, error: new Error("No joined groups found") };
        }
        let accountId = "";
        
        try{
            const cookie = await chromeApi.cookies.get({ url: "https://www.facebook.com", name: "c_user" });
            accountId = cookie?.value || "";
        }
        catch {}

        const fbGroupJoined: FacebookGroupJoinedData[] = [];
        for (const e of edgesDataJoinedGroup) {
            const groupId = e?.["node"]?.["id"];
            if (!groupId) continue;

            fbGroupJoined.push({
                id: groupId,
                entry_rowkey: groupId,
                docType: "JoinedGroup",
                type: e?.["node"]?.["if_viewer_can_see_membership_questions"] !== null ? "private_group" : "group",
                name: e?.["node"]?.["name"] || "",
                channel_name: "facebook",
                url: e?.["node"]?.["url"] || "",
                account_id: accountId,
                crawled_time: Date.now(),
            });
        }

        return { ok: true, data: { fbGroupJoined } };
    } catch (error: any) {
        console.error(
            "Error (Facebook Groups data parser)",
            error.message
        );
        return { ok: false, error: new Error("Failed to parse Facebook group data") };
    }

}
