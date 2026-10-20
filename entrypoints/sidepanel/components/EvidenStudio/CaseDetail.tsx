import { useTranslation } from "../../helpers/i18n";
import "../../assets/css/components/CaseDetail.css";
import "../../assets/css/features/eviden-studio.css";
import { useState, useEffect, useRef } from "react";
import { LuPanelLeftOpen } from "../../assets/constants/icons";
import { IoPersonOutline } from "../../assets/constants/icons";
import { IoIosLink } from "../../assets/constants/icons";
import { FaCheckCircle } from "../../assets/constants/icons";
import { FiPlusCircle, FiImage, FiClock } from "../../assets/constants/icons";
import ImageDetailModal from "./ImageDetailModal";
import { ImageItem, ProfileCase } from "../../types/types";
import { useEvidenStudio } from "../../pages/eviden-studio/use-eviden-studio";
import { PLATFORMS } from "../../helpers/helpers-ui";
import { itemKey } from "../../helpers/helpers";
import CaseDetailImageItem from "./CaseDetailImageItem";


interface CaseDetailProps {
  selectedCase: ProfileCase;
  setDefaultCase: React.Dispatch<React.SetStateAction<ProfileCase>>;
  sidebarOpen: boolean;
  onOpenSidebar: () => void;
  onSaved?: (updatedCase: ProfileCase, currentCase: ProfileCase) => void;
}

function CaseDetail({
  selectedCase,
  sidebarOpen,
  setDefaultCase,
  onOpenSidebar,
  onSaved
}: CaseDetailProps) {
  const { t } = useTranslation();
  const [detailItem, setDetailItem] = useState<ImageItem | null>(null);

  const platform = PLATFORMS.find((p) => p.id === selectedCase.platform);

  const {
    items,
    deletedIds,
    capturing,
    saving,
    error,
    isNewCase,
    hasChanges,
    caseFields,
    handleCaseFieldChange,
    getMeta,
    handleMetaChange,
    handleAddScreenshot,
    handleToggleDelete,
    handleDeletePending,
    handleSave,
    dismissError,
  } = useEvidenStudio({ selectedCase, onSaved });

  const saveCreateButtonDisable = saving || !caseFields.name || !caseFields.profile_url || !caseFields.origin_url;
  const saveCreateButtonCaption = saving
    ? (isNewCase ? t("creatingCase") : t("savingCase"))
    : (isNewCase ? t("createCaseAction") : t("saveChanges"));

  return (
    <div className="case-detail custom-scroll">

      {!sidebarOpen && (
        <div className="case-detail__toolbar" aria-label={t("caseNavigation")}>
          <button onClick={onOpenSidebar} aria-label={t("openCaseSidebar")} title={t("openCaseSidebar")} className="case-detail__open-sidebar-button">
            <LuPanelLeftOpen size={18} />
          </button>
        </div>
      )}

      <section className="case-detail__information" aria-label={t("caseInformation")}>
        <div className="case-detail__form">
          <div className="case-detail__form-field case-detail__form-field--name">
            <label className="case-detail__field-label" htmlFor="case-name">{t("caseName")} <span className="case-detail__required">*</span></label>
            <div className="case-detail__input-shell case-detail__input-shell--identity">
              {platform?.icon && <span className="case-detail__platform-icon" aria-hidden="true">{platform.icon}</span>}
              <input
                id="case-name"
                value={caseFields.name}
                placeholder={t("caseNameHint")}
                className={`case-detail__name-input ${caseFields.name === "" ? "case-detail__name-input--invalid" : ""}`}
                onChange={(e) => {
                  handleCaseFieldChange({ name: e.target.value });
                  setDefaultCase((prev) => ({ ...prev, name: e.target.value }));
                }}
              />
            </div>
          </div>

          <div className="case-detail__form-field">
            <label className="case-detail__field-label" htmlFor="case-profile-url">{t("caseUrl")} <span className="case-detail__required">*</span></label>
            <div className="case-detail__url-row">
              <IoPersonOutline className={`case-detail__url-icon ${caseFields.profile_url === "" ? "case-detail__url-icon--invalid" : ""}`} />
              <input
                id="case-profile-url"
                value={caseFields.profile_url}
                placeholder="https://social.example/profile"
                className={`case-detail__url-input ${caseFields.profile_url === "" ? "case-detail__url-input--invalid" : ""}`}
                onChange={(e) => {
                  handleCaseFieldChange({ profile_url: e.target.value });
                  setDefaultCase((prev) => ({ ...prev, profile_url: e.target.value }));
                }}
              />
            </div>
          </div>

          <div className="case-detail__form-field">
            <label className="case-detail__field-label" htmlFor="case-origin-url">{t("caseOrgURL")} <span className="case-detail__required">*</span></label>
            <div className="case-detail__url-row">
              <IoIosLink className={`case-detail__url-icon ${caseFields.origin_url === "" ? "case-detail__url-icon--invalid" : ""}`} />
              <input
                id="case-origin-url"
                value={caseFields.origin_url}
                placeholder="https://social.example/original-post"
                className={`case-detail__url-input ${caseFields.origin_url === "" ? "case-detail__url-input--invalid" : ""}`}
                onChange={(e) => {
                  handleCaseFieldChange({ origin_url: e.target.value });
                  setDefaultCase((prev) => ({ ...prev, origin_url: e.target.value }));
                }}
              />
            </div>
          </div>

          <div className="case-detail__form-field case-detail__form-field--description">
            <label className="case-detail__field-label" htmlFor="case-description">{t("description")} <span className="case-detail__optional">{t("optional")}</span></label>
            <textarea
              id="case-description"
              value={caseFields.description}
              placeholder={t("caseDescriptionHint")} rows={3}
              className="case-detail__description-input"
              onChange={(e) => {
                handleCaseFieldChange({ description: e.target.value });
                setDefaultCase((prev) => ({ ...prev, description: e.target.value }));
              }}
            />
          </div>
        </div>

        {(selectedCase.created_time || selectedCase.updated_time) ? (
          <div className="case-detail__meta-footer">
            <FiClock size={13} />
            {selectedCase.created_time ? <span>{t("created")} {new Date(selectedCase.created_time).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric", hour: "2-digit", minute: "2-digit" })}</span> : null}
            {selectedCase.updated_time ? <span>{t("updated")} {new Date(selectedCase.updated_time).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric", hour: "2-digit", minute: "2-digit" })}</span> : null}
          </div>
        ) : null}
      </section>

      {/* ── Error banner ── */}
      {error && (
        <div className="case-detail__error-banner">
          <span className="case-detail__error-icon">⚠️</span>
          <span>{error}</span>
          <button onClick={dismissError}
            className="case-detail__error-dismiss" aria-label={t("dismissError")}>✕</button>
        </div>
      )}

      {/* ── Screenshot grid ── */}
      <section className="case-detail__gallery" aria-label={t("caseScreenshots")}>
        <div className="case-detail__gallery-heading">
          <div className="case-detail__gallery-heading-copy"><h2 className="case-detail__gallery-title">{t("caseScreenshots")} <span className="case-detail__gallery-count">{items.length}</span></h2><p className="case-detail__gallery-subtitle">{t("screenshotsHint")}</p></div>
          <button onClick={handleAddScreenshot} disabled={capturing || saving} className="case-detail__gallery-add">
            <FiPlusCircle size={16} /> {capturing ? t("opening") : t("addScreenshotAction")}
          </button>
        </div>
        <div className="case-detail__grid">

          {items.map((item: any) =>
            <CaseDetailImageItem
              key={itemKey(item)}
              item={item}
              deletedIds={deletedIds}
              getMeta={getMeta}
              setDetailItem={setDetailItem}
              handleDeletePending={handleDeletePending}
              handleToggleDelete={handleToggleDelete}
              handleMetaChange={handleMetaChange}
            />)}

          {items.length === 0 && (
            <div className="case-detail__empty-gallery">
              <FiImage size={24} />
              <span>{t("noScreenshots")}</span>
              <small>{t("addScreenshot")}</small>
            </div>
          )}
        </div>
      </section>

      <div className="case-detail__footer" aria-label={t("caseSaveStatus")}>
        <div className="case-detail__save-bar">
          {(hasChanges || isNewCase) ? (
            <button
              onClick={handleSave}
              disabled={saveCreateButtonDisable}
              className="case-detail__save-button case-detail__save-button--unsaved">
              {saveCreateButtonCaption}
            </button>
          ) : (
            <span className="case-detail__saved-badge" role="status"><FaCheckCircle /> {t("caseSaved")}</span>
          )}
        </div>
      </div>

      {/* ── Image detail modal ── */}
      {detailItem && (
        <ImageDetailModal
          item={detailItem}
          meta={getMeta(detailItem)}
          onMetaChange={handleMetaChange}
          onClose={() => setDetailItem(null)}
        />
      )}
    </div>
  );
}

export default CaseDetail;