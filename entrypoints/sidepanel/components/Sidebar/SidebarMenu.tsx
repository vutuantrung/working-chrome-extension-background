import { useEffect, useState } from "react";
import { MdOutlineCollections } from "../../assets/constants/icons";
import { FaChartLine, FaExchangeAlt, FaGlobe, FaCog, FaChevronDown, FaChevronUp, FaChevronLeft, FaChevronRight, FaRobot, FaFolder } from "../../assets/constants/icons";
import SidebarItem from "./SidebarItem";
import SidebarChildItem from "./SidebarChildItem";
import { PlatformId } from "../../types/types";
import { useTranslation } from "../../helpers/i18n";

interface SidebarGroupProps {
    icon: React.ReactNode;
    label: string;
    children: React.ReactNode;
    collapsed: boolean;
    active: boolean;
    defaultOpen?: boolean;
    onExpand: () => void;
}

function SidebarGroup({
    icon,
    label,
    children,
    collapsed: sidebarCollapsed,
    active,
    defaultOpen = true,
    onExpand,
}: SidebarGroupProps) {
    const [open, setOpen] = useState(defaultOpen);
    return (
        <div className="sidebar-group">
            <button
                className={`sidebar-group__header ${active && sidebarCollapsed ? "sidebar-group__header--active" : ""}`}
                onClick={() => {
                    if (!sidebarCollapsed) {
                        setOpen((v) => !v)
                    } else {
                        onExpand()
                        setOpen(true)
                    }
                }}
                aria-expanded={open}
            >
                <span className="sidebar-group__header-icon">{icon}</span>
                {!sidebarCollapsed && (
                    <>
                        <span className="sidebar-group__header-label">{label}</span>
                        <span className="sidebar-group__chevron">
                            {open ? <FaChevronUp /> : <FaChevronDown />}
                        </span>
                    </>
                )}
            </button>
            {open && !sidebarCollapsed && (
                <div className="sidebar-group__children">{children}</div>
            )}
        </div>
    );
}


interface SidebarMenuProps {
    isOpen: boolean;
    onClose: () => void;
    onNavigate: (view: string) => void;
    showMonitor: boolean;
    showSwitchPersona?: boolean;
    showSwitchPlatform?: boolean;
    onSwitchPlatform?: () => void;
    activePage: string;
    platform: PlatformId;
}

export function SidebarMenu({
    isOpen,
    onClose,
    onNavigate,
    showMonitor,
    showSwitchPersona,
    showSwitchPlatform,
    onSwitchPlatform,
    activePage,
    platform
}: SidebarMenuProps) {
    const [collapsed, setCollapsed] = useState(false);
    const { t } = useTranslation();
    const toggleCollapse = () => setCollapsed((prev) => !prev);

    const sidebarOpen = isOpen ? "sidebar-overlay--open" : ""
    const sidebarCollapsed = collapsed ? "sidebar-menu--collapsed" : ""

    useEffect(() => {
        const handleKey = (e: KeyboardEvent) => {
            if (e.key === "Escape") onClose();
        };
        if (isOpen) document.addEventListener("keydown", handleKey);
        return () => document.removeEventListener("keydown", handleKey);
    }, [isOpen, onClose]);

    return (
        <>
            <div
                className={`sidebar-overlay ${sidebarOpen}`}
                onClick={onClose}
                aria-hidden="true"
            />
            <div
                className={`sidebar-menu ${sidebarOpen} ${sidebarCollapsed}`}
                role="dialog"
                aria-label="Menu"
                aria-modal="true"
            >
                <div className="sidebar-menu__body">
                    {/* Top-level flat item: Monitoring */}
                    {showMonitor && (
                        <SidebarItem
                            icon={<FaChartLine />}
                            label={t("monitoring")}
                            active={activePage === "monitor"}
                            onClick={() => { onNavigate("monitor"); onClose(); }}
                            sidebarCollapsed={collapsed}
                        />
                    )}

                    {/* Group: Automation */}
                    {platform === 'facebook' ? (
                        <SidebarGroup
                            icon={<FaRobot />}
                            label={t("navAutomation")}
                            active={activePage === "config"}
                            collapsed={collapsed}
                            onExpand={() => { setCollapsed(false) }}
                        >
                            <SidebarChildItem
                                icon={<FaCog />}
                                label={t("settings")}
                                active={activePage === "config"}
                                onClick={() => { onNavigate("config"); onClose(); }}
                            />
                        </SidebarGroup>
                    ) : (
                        <SidebarItem
                            icon={<FaRobot />}
                            label={t("navAutomation")}
                            active={activePage === "config"}
                            onClick={() => { onNavigate("config"); onClose(); }}
                            sidebarCollapsed={collapsed}
                        />
                    )}

                    {/* Group: Eviden collection */}
                    {platform ? (
                        <SidebarGroup
                            icon={<MdOutlineCollections />}
                            label={t("evidenceCollection")}
                            active={activePage === "eviden-studio"}
                            collapsed={collapsed}
                            onExpand={() => { setCollapsed(false) }}
                        >
                            <SidebarChildItem
                                icon={<FaFolder />}
                                label={t("evidenceStudio")}
                                active={activePage === "eviden-studio"}
                                onClick={() => { onNavigate("eviden-studio"); onClose(); }}
                            />
                        </SidebarGroup>
                    ) : (
                        <SidebarItem
                            icon={<MdOutlineCollections />}
                            label={t("evidenceCollection")}
                            active={activePage === "eviden-studio"}
                            onClick={() => { onNavigate("eviden-studio"); onClose(); }}
                            sidebarCollapsed={collapsed}
                        />
                    )}

                    {showSwitchPlatform && onSwitchPlatform && (
                        <SidebarItem
                            icon={<FaGlobe />}
                            label={t("switchPlatform")}
                            active={activePage === "switch-platform"}
                            onClick={() => { onSwitchPlatform(); onClose(); }}
                            sidebarCollapsed={collapsed}
                        />
                    )}

                    {showSwitchPersona && (
                        <SidebarItem
                            icon={<FaExchangeAlt />}
                            label={t("switchPersona")}
                            active={activePage === "switch-persona"}
                            onClick={() => { onNavigate("switch-persona"); onClose(); }}
                            sidebarCollapsed={collapsed}
                        />
                    )}
                </div>

                {/* Footer collapse button */}
                <div className="sidebar-menu__footer">
                    <button
                        className="sidebar-menu__collapse-btn"
                        onClick={toggleCollapse}
                        aria-label={collapsed ? t("expandSidebar") : t("collapseSidebar")}
                    >
                        <span className="sidebar-menu__collapse-btn-icon">
                            {collapsed ? <FaChevronRight /> : <FaChevronLeft />}
                        </span>
                        {!collapsed && (
                            <span className="sidebar-menu__collapse-btn-label">{t("collapse")}</span>
                        )}
                    </button>
                </div>
            </div>
        </>
    );
}