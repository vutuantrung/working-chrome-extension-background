import { useTranslation } from "../../helpers/i18n";
import "../../assets/css/components/Persona.css";

const StatusBadge = ({ status }: { status: string }) => {
  const { t } = useTranslation();
    const active = status === "active";
    return (
        <span className={`persona-status-badge ${active ? "persona-status-badge--active" : "persona-status-badge--inactive"}`}>
            <span className="persona-status-badge__dot" />
            {status === "active" ? t("active") : status === "inactive" ? t("inactive") : status}
        </span>
    );
};

export default StatusBadge;
