import { useTranslation } from "../../helpers/i18n";
import { FaCheckCircle } from "../../assets/constants/icons";
import { FaClock, FaSpinner } from "../../assets/constants/icons";
import { TASK_STATES } from "../../helpers/constants";
import "../../assets/css/components/TaskStatusBadge.css";

type TaskStatusBadgeProps = {
  status: string;
  label?: string;
  className?: string;
};

function getStatusConfig(status: string) {
  switch (status) {
    case TASK_STATES.RUNNING:
      return {
        variant: "running",
        label: "Running",
        icon: <FaSpinner className="task-status-badge__icon task-status-badge__icon--spin" data-preserve-color="true" />,
      };
    case TASK_STATES.PENDING:
      return {
        variant: "pending",
        label: "Pending",
        icon: <FaClock className="task-status-badge__icon" data-preserve-color="true" />,
      };
    case TASK_STATES.FINISHED:
      return {
        variant: "finished",
        label: "Finished",
        icon: <FaCheckCircle className="task-status-badge__icon" data-preserve-color="true" />,
      };
    case TASK_STATES.CANCELED:
      return {
        variant: "canceled",
        label: "Canceled",
        icon: null,
      };
    default:
      return {
        variant: "neutral",
        label: status || "Unknown",
        icon: null,
      };
  }
}

export default function TaskStatusBadge({
  status,
  label,
  className = "",
}: TaskStatusBadgeProps) {
  const { t } = useTranslation();
  const config = getStatusConfig(status);
  const translatTaskStatus = (variant: string) => {
    if (variant === "running") return t("running");
    if (variant === "pending") return t("pending");
    if (variant === "finished") return t("taskFinished");
    if (variant === "canceled") return t("canceled");
    return config.label;
  }
  return (
    <span
      className={`task-status-badge task-status-badge--${config.variant} ${className}`.trim()}
    >
      {config.icon}
      <span>{label ?? (translatTaskStatus(config.variant))}</span>
    </span>
  );
}
