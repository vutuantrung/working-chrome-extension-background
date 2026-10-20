import { useTranslation } from "../../helpers/i18n";
import { PRIORITY_LABELS } from "../../helpers/constants";
import "../../assets/css/components/TaskPriorityBadge.css";

type TaskPriorityBadgeProps = {
  priority: number;
  label?: string;
  className?: string;
};

function getPriorityVariant(priority: number) {
  switch (priority) {
    case 3:
      return "urgent";
    case 2:
      return "high";
    case 1:
      return "medium";
    case 0:
      return "low";
    default:
      return "neutral";
  }
}

function getPriorityLabel(priority: number) {
  return PRIORITY_LABELS[priority] || "Unknown";
}

export default function TaskPriorityBadge({
  priority,
  label,
  className = "",
}: TaskPriorityBadgeProps) {
  const { t } = useTranslation();
  const variant = getPriorityVariant(priority);
  const text = label ?? ([t("priorityLow"), t("priorityMedium"), t("priorityHigh"), t("priorityUrgent")][priority] || t("unknown"));

  return (
    <span
      className={`task-priority-badge task-priority-badge--${variant} ${className}`.trim()}
    >
      {text}
    </span>
  );
}
