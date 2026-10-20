import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../../contexts/AuthContext";
import api from "../../infrastructure/api";
import { parseList } from "../../helpers/helpers";
import StatusScreen from "../../components/Persona/StatusScreen";
import PersonaCard from "../../components/Persona/PersonaCard";
import { useTranslation } from "../../helpers/i18n";
import type { Persona } from "../../types/types";
import "../../assets/css/pages/PersonaPage.css";

/**
 * Decision flow on mount:
 *   0 personas → create → activePersonaSession → navigate
 *   1 persona  → auto-select → activePersonaSession → navigate  (no UI)
 *  ≥2 personas → show selection UI → activePersonaSession → navigate
 */
const SelectPersona: React.FC = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { user, applyPersonaOnSelect } = useAuth();

  type ViewState = "initializing" | "creating" | "activating" | "select";
  const [viewState, setViewState] = useState<ViewState>("initializing");
  const [personas, setPersonas] = useState<Persona[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [confirming, setConfirming] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // const activateAndProceed = async (persona: Persona) => {
  //   setViewState("activating");
  //   try {
  //     await activePersona(persona.id);
  //   } catch {
  //     console.warn(
  //       "[SelectPersona] activePersona call failed, proceeding anyway",
  //     );
  //   }
  //   localStorageService.setItem("selectedPersonaId", persona.id);
  //   try {
  //     if (canSwitchPersona) {
  //       const raw = await getPersonaById(persona.id);
  //       const full = parsePersonaRecord(raw) ?? persona;
  //       localStorageService.setItem("selectedPersona", JSON.stringify(full));
  //       await persistAndApplyPersonaProxy(full);
  //     } else {
  //       localStorageService.setItem("selectedPersona", JSON.stringify(persona));
  //       await persistAndApplyPersonaProxy(persona);
  //     }
  //   } catch {
  //     localStorageService.setItem("selectedPersona", JSON.stringify(persona));
  //     await persistAndApplyPersonaProxy(persona);
  //   }
  //   navigate("/facebook-login-mode");
  // };
  // const activateAndProceed = async (persona: Persona) => {
  //   // setViewState("activating");

  //   // TODO: Uncomment when active persona API is ready
  //   // try {
  //   //   await activePersona(persona.id);
  //   // } catch {
  //   //   console.warn("[SelectPersona] activePersona call failed, proceeding anyway");
  //   // }

  //   localStorageService.setItem("selectedPersonaId", persona.id);
  //   try {
  //     if (canSwitchPersona) {
  //       const raw = await getPersonaById(persona.id);
  //       const full = parsePersonaRecord(raw) ?? persona;
  //       localStorageService.setItem("selectedPersona", JSON.stringify(full));
  //       await persistAndApplyPersonaProxy(full);
  //     } else {
  //       localStorageService.setItem("selectedPersona", JSON.stringify(persona));
  //       await persistAndApplyPersonaProxy(persona);
  //     }
  //   } catch {
  //     localStorageService.setItem("selectedPersona", JSON.stringify(persona));
  //     await persistAndApplyPersonaProxy(persona);
  //   }
  //   navigate("/facebook-login-mode");
  // };

  const activateAndProceed = async (persona: Persona) => {
    setViewState("activating");
    setErrorMsg(null);

    try {
      try {
        await api.extensionUser.activatePersonaSession(persona.id);
      } catch {
        console.warn(
          "[SelectPersona] activePersonaSession failed, proceeding anyway",
        );
      }

      await applyPersonaOnSelect(persona);
      navigate("/facebook-login-mode");
    } catch (err) {
      console.error("[SelectPersona] activateAndProceed error:", err);
      setErrorMsg(t("personaActivateError"));
      setViewState("select");
    }
  };

  useEffect(() => {
    const init = async () => {
      setViewState("initializing");
      setErrorMsg(null);

      let list: Persona[] = [];

      try {
        const data = await api.persona.getPersonas(user?.id ?? "");
        // console.log("[SelectPersona] raw data:", data);
        list = parseList(data);
        // console.log("[SelectPersona] parsed list:", list.length, list);
      } catch (err) {
        console.error("[SelectPersona] getPersonas error:", err);
        setErrorMsg(t("personaLoadError"));
        setViewState("select");
        return;
      }

      console.log("[SelectPersona] list.length:", list.length);

      if (list.length === 0) {
        setViewState("creating");
        try {
          const response = await api.persona.createPersona();
          const created: Persona = response?.data ?? response;
          await activateAndProceed(created);
        } catch (err) {
          console.error("[SelectPersona] createPersonas error:", err);
          setErrorMsg(t("personaCreateError"));
          setViewState("select");
        }
        return;
      }

      if (list.length === 1) {
        console.log("[SelectPersona] auto-selecting:", list[0]);
        await activateAndProceed(list[0]);
        return;
      }

      setPersonas(list);
      setViewState("select");
    };

    init();
  }, [user?.id]);

  const handleContinue = async () => {
    if (!selectedId || confirming) return;
    const persona = personas.find((p) => p.id === selectedId);
    if (!persona) return;
    setConfirming(true);
    try {
      await activateAndProceed(persona);
    } finally {
      setConfirming(false);
    }
  };

  if (viewState === "initializing") {
    return (
      <div className="persona-page">
        <StatusScreen icon="⏳" title={t("loadingPersonas")} />
      </div>
    );
  }

  if (viewState === "creating") {
    return (
      <div className="persona-page">
        <StatusScreen
          icon="✨"
          title={t("creatingPersona")}
          subtitle={t("justMoment")}
        />
      </div>
    );
  }

  if (viewState === "activating") {
    return (
      <div className="persona-page">
        <StatusScreen icon="🔄" title={t("activatingPersona")} />
      </div>
    );
  }

  return (
    <div className="persona-page">
      <div className="persona-panel">
        <div className="persona-panel__header">
          <h2 className="persona-panel__title">
            {t("selectPersona")}
          </h2>
          <p className="persona-panel__subtitle">
            {t("selectPersonaHint")}
          </p>
        </div>

        {errorMsg && (
          <div className="persona-panel__error">
            <span>⚠️</span>
            {errorMsg}
          </div>
        )}

        <div className="persona-panel__list">
          {personas.length === 0 ? (
            <div className="persona-panel__empty">
              {t("noPersonas")}
            </div>
          ) : (
            personas.map((p) => (
              <PersonaCard
                key={p.id}
                persona={p}
                selected={selectedId === p.id}
                onSelect={() =>
                  setSelectedId((prev) => (prev === p.id ? null : p.id))
                }
              />
            ))
          )}
        </div>

        <div className="persona-panel__footer">
          <button
            onClick={handleContinue}
            disabled={!selectedId || confirming}
            className="persona-primary-btn"
          >
            {confirming ? t("activating") : `${t("continue")} →`}
          </button>
        </div>
      </div>
    </div>
  );
};

export default SelectPersona;
