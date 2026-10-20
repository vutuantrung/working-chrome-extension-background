import "../../assets/css/components/Sidebar.css";

interface SidebarItemProps {
    icon: React.ReactNode;
    label: string;
    active: boolean;
    onClick: () => void;
    sidebarCollapsed: boolean;
}

function SidebarItem({
    icon,
    label,
    active,
    onClick,
    sidebarCollapsed
}: SidebarItemProps) {
    const activeClass = active ? "sidebar-item--active" : "";
    const iconOnlyClass = sidebarCollapsed ? "sidebar-item--icon-only" : "";
    return (
        <div className="sidebar-item-wrapper">
            <button
                className={`sidebar-item ${activeClass} ${iconOnlyClass}`}
                onClick={onClick}
                aria-label={sidebarCollapsed ? label : undefined}
            >
                <span className="sidebar-item__icon">{icon}</span>
                {!sidebarCollapsed && <span className="sidebar-item__label">{label}</span>}
            </button>
        </div>
    );
}
export default SidebarItem;