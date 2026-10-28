import { FacebookGroupJoinedData, Result } from "../types";
import { getAccountIdFromCookie } from "./utils";

export async function parseDataJoinedGroup(payload: any): Promise<Result<{ fbGroupJoined: FacebookGroupJoinedData[] }>> {
    try {
        const edges =
            payload?.["data"]?.["viewer"]?.["groups_tab"]?.["tab_groups_list"]?.["edges"] ||
            payload?.["data"]?.["viewer"]?.["all_joined_groups"]?.["tab_groups_list"]?.["edges"];

        if (!Array.isArray(edges)) {
            return { ok: false, error: new Error("No joined groups found") };
        }
        const accountId = await getAccountIdFromCookie();
        const joinedGroups: FacebookGroupJoinedData[] = [];
        for (const e of edges) {
            const groupId = e?.["node"]?.["id"];
            if (!groupId) continue;

            joinedGroups.push({
                id: groupId,
                entry_rowkey: groupId,
                docType: "JoinedGroup",
                type: e?.["node"]?.["if_viewer_can_see_membership_questions"] !== null ? "private_group" : "group",
                name: e?.["node"]?.["name"] || "",
                channel_name: "facebook",
                url: e?.["node"]?.["url"] || "",
                account_id: accountId || "",
                crawled_time: Date.now(),
            });
        }

        return { ok: true, data: { fbGroupJoined: joinedGroups } };
    } catch (error: any) {
        console.error(
            "Error (Facebook Groups data parser)",
            error.message
        );
        return { ok: false, error: new Error("Failed to parse Facebook group data") };
    }

}
