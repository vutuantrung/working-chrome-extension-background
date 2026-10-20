
import { TASK_STATES } from "./constants";
import { PlatformObject } from "../types/types";
import {
    SVG_ICON,
    FaFacebook,
    FaTelegram,
    FaTiktok,
    FaTwitter,
    FaYoutube,
    FaDiscord,
    FaCheckCircle,
    FaTimesCircle,
    FaClock,
    FaSpinner,
    FaThreads,
    FaInstagram
} from "../assets/constants/icons";

export const getStatusColor = (state: string) => {
    switch (state) {
        case TASK_STATES.RUNNING:
            return "#0ea5e9";
        case TASK_STATES.FINISHED:
            return "#10b981";
        case TASK_STATES.PENDING:
            return "#f59e0b";
        case TASK_STATES.CANCELED:
            return "#ef4444";
        default:
            return "#6b7280";
    }
};

export const getPriorityColor = (priority: number) => {
    switch (priority) {
        case 3:
            return "#ef4444";
        case 2:
            return "#f59e0b";
        case 1:
            return "#0ea5e9";
        default:
            return "#6b7280";
    }
};

export const getChannelIcon = (channelName: string) => {
    const name = channelName?.toLowerCase();
    if (name === "facebook")
        return <FaFacebook data-preserve-color="true" style={{ color: "#1877F2" }} size={12} />;
    if (name === "instagram") return <FaInstagram data-preserve-color="true" style={{ color: "#E4405F" }} size={12} />; if (name === "telegram")
        return <FaTelegram data-preserve-color="true" style={{ color: "#24A1DE" }} size={12} />;
    if (name === "tiktok")
        return <FaTiktok data-preserve-color="true" style={{ color: "#000000" }} size={12} />;
    if (name === "twitter" || name === "x")
        return <FaTwitter data-preserve-color="true" style={{ color: "#000000" }} size={12} />;
    if (name === "youtube")
        return <FaYoutube data-preserve-color="true" style={{ color: "#FF0000" }} size={12} />;
    if (name === "threads")
        return <FaThreads data-preserve-color="true" style={{ color: "#000000" }} size={12} />;
    if (name === "discord")
        return <FaDiscord data-preserve-color="true" style={{ color: "#5865F2" }} size={12} />;
    return null;
};

export const renderSVGIcon = (id: string | null) => {
    switch (id) {
        case "facebook":
            return <SVG_ICON.Facebook />;
        case "tiktok":
            return <SVG_ICON.TikTok />;
        case "x":
            return <SVG_ICON.X />;
        case "threads":
            return <SVG_ICON.Threads />;
        case "youtube":
            return <SVG_ICON.Youtube />;
        default:
            return null;
    }
};

export const getStatusIcon = (state: string) => {
    switch (state) {
        case TASK_STATES.RUNNING:
            return <FaSpinner className="status-icon-spin" />;
        case TASK_STATES.FINISHED:
            return <FaCheckCircle />;
        case TASK_STATES.PENDING:
            return <FaClock />;
        case TASK_STATES.CANCELED:
            return <FaTimesCircle />;
        default:
            return null;
    }
};

export const PLATFORMS: PlatformObject[] = [
    {
        id: "facebook",
        label: "Facebook",
        url: "https://www.facebook.com/",
        gradient: "linear-gradient(135deg, #1877f2 0%, #0a4fa8 100%)",
        hoverGlow: "rgba(24, 119, 242, 0.45)",
        icon: <SVG_ICON.Facebook />,
    },
    {
        id: "tiktok",
        label: "TikTok",
        url: "https://www.tiktok.com/",
        gradient: "linear-gradient(135deg, #010101 0%, #2d2d2d 100%)",
        hoverGlow: "rgba(105, 201, 208, 0.45)",
        icon: <SVG_ICON.TikTok />,
    },
    {
        id: "x",
        label: "X (Twitter)",
        url: "https://x.com/",
        gradient: "linear-gradient(135deg, #000000 0%, #1a1a1a 100%)",
        hoverGlow: "rgba(255,255,255, 0.25)",
        icon: <SVG_ICON.X />,
    },
    {
        id: "threads",
        label: "Threads",
        url: "https://www.threads.com/",
        gradient: "linear-gradient(135deg, #000000 0%, #1a1a1a 100%)",
        hoverGlow: "rgba(255, 255, 255, 0.25)",
        icon: <SVG_ICON.Threads />,
    },
    {
        id: "youtube",
        label: "Youtube",
        url: "https://www.youtube.com/",
        gradient: "linear-gradient(135deg, #e50505 0%, #690202 100%)",
        hoverGlow: "rgba(255, 0, 0, 0.45)",
        icon: <SVG_ICON.Youtube />,
    },
];