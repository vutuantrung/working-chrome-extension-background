import "../../assets/css/pages/PersonaPage.css";
import React, { useEffect, useState } from "react";
import api from "../../infrastructure/api";
import { localStorageService } from "../../../../entrypoints/sidepanel/application/services/SidepanelServices";
import { useAuth } from "../../contexts/AuthContext";
import { parseList } from "../../helpers/helpers";
import { Persona, ViewState } from "../../types/types";
import ConfirmModal from "../../components/modal/ConfirmModal";
import StatusScreen from "../../components/Persona/StatusScreen";
import PersonaCard from "../../components/Persona/PersonaCard";
import { useTranslation } from "../../helpers/i18n";

interface SwitchPersonaProps {
  onSwitched: () => void;
}

const SwitchPersona: React.FC<SwitchPersonaProps> = ({ onSwitched }) => {
  const { t } = useTranslation();
  const { user, canSwitchPersona, switchPersona } = useAuth();

  const [viewState, setViewState] = useState<ViewState>("initializing");
  const [personas, setPersonas] = useState<Persona[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [confirming, setConfirming] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [statusDetail, setStatusDetail] = useState<string | null>(null);

  const selectedPersona = personas.find((p) => p.id === selectedId);
  const personaDisplayName = selectedPersona
    ? [selectedPersona.first_name, selectedPersona.last_name]
      .filter(Boolean)
      .join(" ")
      .trim() ||
    selectedPersona.nickname ||
    t("thisPersona")
    : t("thisPersona");

  useEffect(() => {
    if (!canSwitchPersona) {
      setViewState("unavailable");
      return;
    }

    const init = async () => {
      setViewState("initializing");
      setErrorMsg(null);

      const currentPersonaId = localStorageService.getItem("selectedPersonaId");

      try {
        const data = await api.persona.getPersonas(user?.id ?? "");
        const list: Persona[] = parseList(data?.data ?? data);
        const switchable = list.filter((p) => p.id !== currentPersonaId);

        if (switchable.length === 0) {
          setViewState("no-options");
          return;
        }

        setPersonas(switchable);
        setViewState("ready");
      } catch (err) {
        console.error("[SwitchPersona] getPersonas error:", err);
        setErrorMsg(t("personaLoadError"));
        setViewState("ready");
      }
    };

    init();
  }, [user?.id, canSwitchPersona]);

  const handleSwitch = async () => {
    if (!selectedId || confirming) return;

    setShowConfirm(false);
    setConfirming(true);
    setViewState("activating");
    setErrorMsg(null);
    setStatusDetail(t("activatingPersona"));

    try {
      setStatusDetail(t("personaInfoLoading"));
      const result = await switchPersona(selectedId);
      if (!result.success) {
        setErrorMsg(result.error ?? t("personaSwitchError"));
        setViewState("ready");
        return;
      }
      onSwitched();
    } catch (err) {
      console.error("[SwitchPersona] handleSwitch error:", err);
      setErrorMsg(t("personaSwitchError"));
      setViewState("ready");
    } finally {
      setConfirming(false);
      setStatusDetail(null);
    }
  };

  if (viewState === "unavailable") {
    return (
      <div className="persona-page">
        <div className="persona-panel persona-unavailable">
          <p className="persona-unavailable__title">
            {t("switchPersonaUnavailable")}
          </p>
          <p className="persona-unavailable__text">
            {t("switchPersonaUnavailableHint")}
          </p>
          <button type="button" onClick={onSwitched} className="persona-back-btn">
            ← {t("back")}
          </button>
        </div>
      </div>
    );
  }

  if (viewState === "initializing") {
    return (
      <div className="persona-page">
        <StatusScreen icon="⏳" title={t("loadingPersonas")} />
      </div>
    );
  }

  if (viewState === "activating") {
    return (
      <div className="persona-page">
        <StatusScreen
          icon="🔄"
          title={t("switchingPersona")}
          subtitle={statusDetail ?? undefined}
        />
      </div>
    );
  }

  if (viewState === "no-options") {
    return (
      <div className="persona-page">
        <div className="persona-panel">
          <div className="persona-panel__header">
            <h2 className="persona-panel__title">{t("switchPersonaTitle")}</h2>
            <p className="persona-panel__subtitle">{t("noOtherPersonas")}</p>
          </div>
          <div className="persona-no-options">
            <span className="persona-no-options__icon">👤</span>
            <p className="persona-no-options__text">
              {t("noOtherPersonas")}
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="persona-page">
      <div className="persona-panel">
        <div className="persona-panel__header">
          <h2 className="persona-panel__title">{t("switchPersonaTitle")}</h2>
          <p className="persona-panel__subtitle">{t("switchPersonaHint")}</p>
        </div>

        {errorMsg && (
          <div className="notification-text notification-failed">
            {errorMsg}
          </div>
        )}

        <div className="persona-panel__list">
          {personas.map((p) => (
            <PersonaCard
              key={p.id}
              persona={p}
              selected={selectedId === p.id}
              onSelect={() =>
                setSelectedId((prev) => (prev === p.id ? null : p.id))
              }
            />
          ))}
        </div>

        <div className="persona-panel__footer">
          <button
            onClick={() => setShowConfirm(true)}
            disabled={!selectedId || confirming}
            className="persona-primary-btn"
          >
            {confirming ? t("switching") : `${t("switch")} →`}
          </button>
        </div>
      </div>

      <ConfirmModal
        open={showConfirm}
        title={t("switchConfirm")}
        busy={confirming}
        message={
          <>
            <p className="confirm-copy__lead">
              {t("personaSwitchLead")} <strong>{personaDisplayName}</strong>.
            </p>
            <p className="confirm-copy__body">{t("personaSwitchBody")}</p>
          </>
        }
        confirmLabel={t("yesSwitch")}
        cancelLabel={t("cancel")}
        onCancel={() => !confirming && setShowConfirm(false)}
        onConfirm={() => {
          if (!confirming) void handleSwitch();
        }}
      />
    </div>
  );
};

export default SwitchPersona;
