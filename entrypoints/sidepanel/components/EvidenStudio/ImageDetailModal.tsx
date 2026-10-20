import { useTranslation } from "../../helpers/i18n";
import "../../assets/css/components/ImageDetailModal.css";
import { formatBytes } from "../../helpers/helpers";
import { ImageItem, ImageMeta } from "../../types/types";
import { itemKey } from "../../helpers/helpers";
import { Button, FormField, IconButton } from "../ui";

interface ImageDetailModalProps {
  item: ImageItem;
  meta: ImageMeta;
  onMetaChange: (key: string, patch: Partial<ImageMeta>) => void;
  onClose: () => void;
}

function ImageDetailModal({
  item,
  meta,
  onMetaChange,
  onClose,
}: ImageDetailModalProps) {
  const { t } = useTranslation();
  const src = item.kind === "saved" ? item.image.url : item.dataUrl;
  const key = itemKey(item);

  return (
    <div
      className="image-detail-modal"
      onClick={onClose}
    >
      <div
        className="image-detail-modal__dialog"
        onClick={(e) => e.stopPropagation()}
      >
        <IconButton
          onClick={onClose}
          className="image-detail-modal__close"
          ariaLabel={t("imageClose")}
          icon={<>✕</>}
        />

        <div className="image-detail-modal__preview">
          <img src={src} alt={t("screenshot")} className="image-detail-modal__image" />
        </div>

        <div className="image-detail-modal__body">
          <FormField
            label={t("imageName")}
            className="image-detail-modal__field"
            labelClassName="image-detail-modal__label"
          >
            <input
              value={meta.name}
              onChange={(e) => onMetaChange(key, { name: e.target.value })}
              placeholder={t("imageNamePlaceholder")}
              className="image-detail-modal__input"
            />
          </FormField>

          <FormField
            label={t("imageDescription")}
            className="image-detail-modal__field"
            labelClassName="image-detail-modal__label"
          >
            <textarea
              value={meta.description}
              onChange={(e) => onMetaChange(key, { description: e.target.value })}
              placeholder={t("imageDescriptionPlaceholder")}
              rows={3}
              className="image-detail-modal__textarea"
            />
          </FormField>

          <p className="image-detail-modal__captured">
            {t("captured")}: {new Date(meta.capture_time).toLocaleString()}
          </p>
        </div>

        <div className="image-detail-modal__footer">
          <a
            href={src}
            download={`screenshot-${Date.now()}.png`}
            className="image-detail-modal__download"
          >
            {t("download")} {meta.capacity ? `(${formatBytes(meta.capacity)})` : null}
          </a>
          <Button onClick={onClose} className="image-detail-modal__done">
            {t("done")}
          </Button>
        </div>
      </div>
    </div>
  );
}

export default ImageDetailModal;