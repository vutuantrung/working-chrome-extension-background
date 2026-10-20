import { FiUsers, FiUser, FiExternalLink, FiCopy, FiLock, FaFolder, FaGlobe, FiKey } from "../../assets/constants/icons";
import { getChannelIcon } from "../../helpers/helpers-ui";
import type { GroupProfile } from "../../types/types";
import { useTranslation, type AppLanguage, translate } from "../../helpers/i18n";
import { formatTimeSince } from "../../helpers/helpers";
import { FB_GROUP_TYPE } from "../../helpers/constants";

/** Membership states returned by the profiles API. Do not infer a status when absent. */
export const infiltrationLabels = {
    requested: "Đã gửi yêu cầu",
    not_joined: "Chưa tham gia",
    joined: "Đã tham gia",
}

const typeLabels: Record<string, string> = {
    private_group: "Nhóm riêng tư",
    group: "Nhóm công khai",
    profile: "Trang cá nhân",
    fanpage: "Fanpage",
}

export type InfiltrationStatus = keyof typeof infiltrationLabels;
export function getInfiltrationStatus(profile: Pick<GroupProfile, "status">): InfiltrationStatus | undefined {
    return profile.status?.find((value): value is InfiltrationStatus =>
        Object.prototype.hasOwnProperty.call(infiltrationLabels, value)
    )
}

const typeIcons = {
    private_group: FiLock,
    group: FiUsers,
    profile: FiUser,
    fanpage: FaGlobe,
}

function AssignItem(profile: any) {
    const { t, language } = useTranslation();
    const status = getInfiltrationStatus(profile);

    let activity = "active";
    if (profile.active === true || profile.active === "active" || profile.activity_status === "active")
        activity = "active"
    if (profile.active === false || profile.active === "inactive" || profile.activity_status === "inactive")
        activity = "inactive"

    const type = profile.type;
    const url = profile.url;
    const name = profile.name || t("unknownName");
    const channelName = profile.channel_name || t("unknownChannel");
    const id = profile.group_id;
    const updatedTime = typeof profile.updated_time === "number"
        ? profile.updated_time
        : Number(profile.updated_time);
    const updatedDate = Number.isFinite(updatedTime) && updatedTime > 0
        ? new Date(updatedTime)
        : null;
    const validUpdatedDate = updatedDate && !Number.isNaN(updatedDate.getTime())
        ? updatedDate
        : null;
    const TypeIcon = typeIcons[type as keyof typeof typeIcons] ?? FaFolder;
    const copyId = async () => {
        if (!id) return;
        try {
            await navigator.clipboard.writeText(id);
        }
        catch {
            /* Clipboard unavailable */
        }
    };

    const groupTypeLabel = (FB_GROUP_TYPE.find(option => option.id === type)?.label_id ?? type);

    return (
        <article className={`group-task-card${activity === "inactive" ? " group-task-card--inactive" : ""}`}>
            <div className="group-task-card__main">
                <div className="group-task-card__avatar" aria-label={t(groupTypeLabel)}>
                    <TypeIcon aria-hidden="true" />
                    <span className="group-task-card__channel" title={channelName}>
                        {getChannelIcon(channelName)}
                    </span>
                </div>
                <div className="group-task-card__content">
                    <div className="group-task-card__title">
                        <TypeIcon aria-hidden="true" />
                        <strong title={name}>{name}</strong>
                    </div>
                    <div className="group-task-card__meta">
                        {/* <span className="group-task-card__type">
                            <TypeIcon aria-hidden="true" />{typeLabels[type] ?? type}
                        </span> */}
                        {activity && <span className={`group-task-card__activity group-task-card__activity--${activity}`}><i aria-hidden="true" />{activity === "active" ? t("active") : t("inactive")}</span>}
                        {status && <span className={`group-task-card__state group-task-card__state--${status}`}>{t(status)}</span>}
                    </div>
                </div>
                <div className="group-task-card__actions">
                    <a href={url || undefined}
                        target="_blank"
                        rel="noopener noreferrer"
                        aria-label={`${t("open")} ${name}`}
                        title={t("openLink")}
                        className={!url ? "is-disabled" : ""}
                        onClick={!url ? (event) => event.preventDefault() : undefined}>
                        <FiExternalLink />
                    </a>
                </div>
            </div>
            <div className="group-task-card__footer">
                <div className="group-task-card__footer-content">
                    <span className="group-task-card__source">
                        <FiKey aria-hidden="true" /> {profile.group_id || t("unknownId")}
                    </span>

                    <button type="button"
                        title={t("copyId")}
                        aria-label={`${t("copyId")} ${name}`}
                        onClick={copyId}
                        disabled={!id}>
                        <FiCopy />
                    </button>
                </div>
                <div>
                    {validUpdatedDate && <time className="group-task-card__updated" dateTime={validUpdatedDate.toISOString()} title={validUpdatedDate.toLocaleString("vi-VN")}>{t("updated")}: {validUpdatedDate.toLocaleDateString(language === "vi" ? "vi-VN" : "en-GB", { day: "2-digit", month: "2-digit", year: "numeric" })} ({formatTimeSince(updatedTime, language)})</time>}
                </div>
            </div>
        </article>
    );
}
export default AssignItem;
