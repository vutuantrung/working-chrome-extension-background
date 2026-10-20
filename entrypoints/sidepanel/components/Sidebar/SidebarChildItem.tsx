
interface SidebarChildItemProps {
    icon: React.ReactNode;
    label: string;
    active: boolean;
    onClick: () => void;
}

function SidebarChildItem({
    icon,
    label,
    active,
    onClick
}: SidebarChildItemProps) {
    const activeClass = active ? "sidebar-item--active" : "";
    return (
        <button
            className={`sidebar-child-item ${activeClass}`}
            onClick={onClick}
        >
            <span className="sidebar-child-item__icon">{icon}</span>
            <span className="sidebar-child-item__label">{label}</span>
        </button>
    );
}

export default SidebarChildItem;