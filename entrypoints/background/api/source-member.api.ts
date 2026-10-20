import { http } from "./http";

export interface GetMemberSourcesResponse {
  success?: boolean;
  memberSources?: any[];
  data?: any[];
  total?: number;
}

export const getMemberSourcesApi = async (
  data?: string,
  status?: string,
  search?: string,
  offset?: number,
  limit?: number,
  platform?: string[],
  type?: string[],
  assigneeId?: string,
): Promise<GetMemberSourcesResponse> => {
  const where: Record<string, any> = {};

  const effectiveAssigneeId = assigneeId || data;
  if (effectiveAssigneeId) {
    where.assignee_id = effectiveAssigneeId;
  }

  if (status) {
    where.assign_status = { inq: Array.isArray(status) ? status : [status] };
  }

  if (platform && platform.length > 0) {
    if (platform.length === 1) {
      where.channel_name = platform[0];
    } else {
      where.channel_name = { inq: platform };
    }
  }

  if (type && type.length > 0) {
    if (type.length === 1) {
      where.type = type[0];
    } else {
      where.type = { inq: type };
    }
  }

  if (search) {
    where.or = [
      { name: { like: `${search}` } },
      { profile_id: { like: `${search}` } },
    ];
  }

  const payload: Record<string, any> = {
    targets: "profiles",
    where,
    limit: limit ?? 10,
    offset: offset ?? 0,
  };

  const [response, countResponse] = await Promise.all([
    http.post("/search/v2", payload),
    http
      .post("/search/v2/count", { targets: "profiles", where })
      .catch(() => null),
  ]);

  const rawData = response.data;
  const countData = countResponse?.data;
  const rawList: any[] = Array.isArray(rawData?.profiles)
    ? rawData.profiles
    : Array.isArray(rawData?.data)
      ? rawData.data
      : Array.isArray(rawData)
        ? rawData
        : [];

  const total =
    typeof countData?.count === "number"
      ? countData.count
      : typeof rawData?.meta?.total_count === "number"
        ? rawData.meta.total_count
        : typeof rawData?.total === "number"
          ? rawData.total
          : rawList.length > 0 && typeof rawList[0]?._total_count === "number"
            ? rawList[0]._total_count
            : rawList.length;

  const normalizedData = rawList.map((item: any) => {
    const isAssigned =
      item.assignedGroupId != null ||
      item.assignee_group_id != null ||
      item.assignee_id != null ||
      (Array.isArray(item.assign_status)
        ? item.assign_status.includes("ASSIGNED") ||
          item.assign_status.includes("joined") ||
          item.assign_status.includes("SYNCED")
        : item.assign_status === "ASSIGNED") ||
      item.type === "ASSIGNED";

    return {
      ...item,
      id: item.id || item.profile_id,
      socialId:
        item.socialId ||
        item.profile_id ||
        (Array.isArray(item.profile_ids) ? item.profile_ids[0] : ""),
      profileName: item.profileName || item.name || "",
      channelName: item.channelName || item.channel_name || "",
      accountUrl: item.accountUrl || item.url || "",
      assignedGroupId:
        item.assignedGroupId ||
        item.assignee_group_id ||
        (isAssigned ? "assigned" : null),
      assignedUserId: item.assignedUserId || item.assignee_id || null,
      type: item.type,
      originalProfileType: item.originalProfileType || item.type,
      profileType: item.profileType || item.type,
      categories: item.categories || item.category_info || [],
    };
  });

  return {
    success: true,
    data: normalizedData,
    memberSources: normalizedData,
    total,
  };
};

export const getExtensionConfigInfo = async (extension_config_id: string, filter?: any) => {
  const response = await http.get(
    `/extension-configs/${extension_config_id}`,
    {
      params: {
        relation_proxy: true,
        relation_user: true,
        relation_social_accounts: true,
        ...(filter && { filter: JSON.stringify(filter) }),
        include_topics: true,
      },
    });
  return response.data;
};