import { useTranslation } from "../../helpers/i18n";
import { itemKey } from "../../helpers/helpers";
import { ImageItem, ImageMeta } from "../../types/types";
import { useState, useEffect, useRef } from "react";


function InlineName({
    value,
    onChange,
}: {
    value: string;
    onChange: (v: string) => void;
}) {
    const { t } = useTranslation();
    const [editing, setEditing] = useState(false);
    const inputRef = useRef<HTMLInputElement>(null);

    useEffect(() => {
        if (editing) inputRef.current?.focus();
    }, [editing]);

    if (editing) {
        return (
            <input
                ref={inputRef}
                value={value}
                onChange={(e) => onChange(e.target.value)}
                onBlur={() => setEditing(false)}
                onKeyDown={(e) => e.key === "Enter" && setEditing(false)}
                className="case-detail__inline-name-input"
                placeholder={t("imageAddName")}
            />
        );
    }

    return (
        <p className="case-detail__inline-name-text"
            title={t("imageEditName")}
            onClick={(e) => { e.stopPropagation(); setEditing(true); }}>
            {value || <span className="case-detail__inline-name-placeholder">{t("imageAddName")}</span>}
        </p>
    );
}

interface CaseDetailImageItemProps {
    item: any;
    deletedIds: Set<string>;
    getMeta: (item: ImageItem) => ImageMeta;
    setDetailItem: (item: ImageItem | null) => void;
    handleDeletePending: (timestamp: number) => void;
    handleToggleDelete: (imageId: string) => void;
    handleMetaChange: (key: string, patch: Partial<ImageMeta>) => void
}

const CaseDetailImageItem = ({
    item,
    deletedIds,
    getMeta,
    setDetailItem,
    handleDeletePending,
    handleToggleDelete,
    handleMetaChange,
}: CaseDetailImageItemProps) => {
    const { t } = useTranslation();
    const k = itemKey(item);
    const src = item.kind === "saved" ? item.image.url : item.dataUrl;
    const isDeleting = item.kind === "saved" && deletedIds.has(item.image.id);
    const meta = getMeta(item);

    return (
        <div key={k} className="case-detail__item">
            {/* Thumbnail */}
            <div
                className={`case-detail__thumbnail ${isDeleting ? "case-detail__thumbnail--deleting" : ""}`}
                onClick={() => !isDeleting && setDetailItem(item)}
            >
                <img src={src} alt={meta.name || t("screenshot")}
                    className="case-detail__thumbnail-image" />

                {item.kind === "pending" && (
                    <span className="case-detail__status-badge case-detail__status-badge--unsaved">
                        {t("pendingSave")}
                    </span>
                )}

                {isDeleting && (
                    <span className="case-detail__status-badge case-detail__status-badge--removing">
                        {t("removing")}
                    </span>
                )}

                <div className="case-detail__thumbnail-actions">
                    {item.kind === "pending" ? (
                        <button
                            onClick={(e) => {
                                e.stopPropagation();
                                handleDeletePending(item.timestamp);
                            }}
                            className="case-detail__thumbnail-action case-detail__thumbnail-action--danger"
                            title={t("imageDiscard")}
                        >✕</button>
                    ) : isDeleting ? (
                        <button
                            onClick={(e) => {
                                e.stopPropagation();
                                handleToggleDelete(item.image.id);
                            }}
                            className="case-detail__thumbnail-action case-detail__thumbnail-action--undo" title={t("imageUndoRemoval")}
                        >{t("undo")}</button>
                    ) : (
                        <button
                            onClick={(e) => {
                                e.stopPropagation();
                                handleToggleDelete(item.image.id);
                            }}
                            className="case-detail__thumbnail-action case-detail__thumbnail-action--danger"
                            title={t("remove")}
                        >✕</button>
                    )}
                </div>
            </div>

            {/* Inline name edit */}
            <InlineName
                value={meta.name}
                onChange={(v) => handleMetaChange(k, { name: v })}
            />
        </div>
    );
};

export default CaseDetailImageItem;