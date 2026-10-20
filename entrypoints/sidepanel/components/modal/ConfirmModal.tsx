import { useTranslation } from "../../helpers/i18n";
import type { ReactNode } from "react";
import { FaTimes } from "../../assets/constants/icons";
import { Button, IconButton } from "../ui";

interface ConfirmModalProps {
  open: boolean;
  title: string;
  message: ReactNode;
  confirmLabel?: string;
  cancelLabel?: string;
  busy?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

function ConfirmModal({
  open,
  title,
  message,
  confirmLabel,
  cancelLabel,
  busy = false,
  onConfirm,
  onCancel,
}: ConfirmModalProps) {
  const { t } = useTranslation();
  if (!open) return null;

  return (
    <div className="confirm-modal-overlay" role="presentation" onClick={onCancel}>
      <div
        className="confirm-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="confirm-modal-title"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="confirm-modal__header">
          <h3 id="confirm-modal-title" className="confirm-modal__title">
            {title}
          </h3>
          <IconButton
            className="confirm-modal__close"
            onClick={onCancel}
            ariaLabel={t("close")}
            disabled={busy}
            icon={<FaTimes />}
          />
        </div>
        <div className="confirm-modal__body">{message}</div>
        <div className="confirm-modal__actions">
          <Button
            className="confirm-modal__btn confirm-modal__btn--cancel"
            onClick={onCancel}
            disabled={busy}
          >
            {cancelLabel}
          </Button>
          <Button
            className="confirm-modal__btn confirm-modal__btn--confirm"
            onClick={onConfirm}
            loading={busy}
            loadingLabel={t("applying")}
          >
            {confirmLabel}
          </Button>
        </div>
      </div>
    </div>
  );
}

export default ConfirmModal;
