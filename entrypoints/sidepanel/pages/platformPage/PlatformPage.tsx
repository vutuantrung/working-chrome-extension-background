import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  appStorage,
  extensionStorage,
  localStorageService,
} from "../../../../entrypoints/sidepanel/application/services/SidepanelServices";
import { useAuth } from "../../contexts/AuthContext";
import {
  getPlatformLabel,
  getSelectedPlatformId,
  setSelectedPlatformId,
} from "../../helpers/helpers";
import { PlatformId, PlatformObject } from "../../types/types";
import PlatformSelect from "../../components/PlatformSelect";
import { useTranslation } from "../../helpers/i18n";
import { localizeOptions, LOGIN_ERROR_MESSAGES } from "../../helpers/constants";

const chromeStorageKey = (id: PlatformId) => id === "facebook" ? "fbLoginMode" : `${id}LoginMode`;
const localStorageKey = (id: PlatformId) => id === "facebook" ? "local:fbLoginMode" : `local:${id}LoginMode`;

const SwitchPlatform: React.FC = () => {
  const { t } = useTranslation();
  const { loginWithMode } = useAuth();
  const navigate = useNavigate();

  const [step, setStep] = useState<"platform" | "loginMode">("platform");
  const [selectedPlatform, setSelectedPlatform] = useState<PlatformObject | null>(null);
  const [busyMode, setBusyMode] = useState<"auto" | "manual" | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const currentPlatformId = getSelectedPlatformId();

  const handleSelectPlatform = async (platform: PlatformObject) => {
    setErrorMessage(null);
    setSelectedPlatform(platform);
    setSelectedPlatformId(platform.id);

    setStep("loginMode");
  };

  const handleLoginMode = async (mode: "auto" | "manual") => {
    if (!selectedPlatform || busyMode) return;
    setErrorMessage(null);

    try {
      await extensionStorage.set({ [chromeStorageKey(selectedPlatform.id)]: mode });
    } catch { }

    try {
      await appStorage.setItem("local:fbLoginMode", {
        mode,
        platform: selectedPlatform.id,
      });
    } catch { }

    setBusyMode(mode);
    const result = await loginWithMode(mode, selectedPlatform.id);
    setBusyMode(null);

    if (result.success === true) {
      localStorageService.setItem("login:login-success-redirect", "1");
      localStorageService.setItem("fbLoginModeSelected", "1");
      setSelectedPlatformId(selectedPlatform.id);
      // Notify AppRoutes to sync React state before navigation so there
      // is no stale intermediate render with hasSelectedFbMode=false.
      window.dispatchEvent(new Event("localStorageSync"));
      navigate("/");
      return;
    }

    try {
      await extensionStorage.remove(chromeStorageKey(selectedPlatform.id));
      await appStorage.removeItem(localStorageKey(selectedPlatform.id) as any);
    } catch { }

    setErrorMessage(
      localizeOptions(LOGIN_ERROR_MESSAGES, t).find(opt => opt.id === (result.reason ?? "unknown"))?.label ??
      localizeOptions(LOGIN_ERROR_MESSAGES, t).find(opt => opt.id === "unknown")?.label,
    );
  };

  const isModeBusy = busyMode !== null;
  const isAutoLoading = isModeBusy && busyMode === "auto";
  const isManualLoading = isModeBusy && busyMode === "manual";

  const footerLabel =
    step === "loginMode" && selectedPlatform
      ? selectedPlatform.label
      : getPlatformLabel(currentPlatformId);

  return (
    <div className="fb-login-mode-container switch-platform-page switch-platform-redesign">
      <div className="switch-platform-redesign__shell">
        <div className="switch-platform-redesign__eyebrow">
          <span className="switch-platform-redesign__step">{t("step")} {step === "platform" ? "01" : "02"} / 02</span>
        </div>
        <div className="switch-platform-redesign__heading">
          <div className="switch-platform-redesign__heading-icon">{step === "platform" ? "↗" : "✓"}</div>
          <div><h1>{step === "platform" ? t("switchPlatform") : t("chooseConnect")}</h1><p>{step === "platform" ? t("chooseNetwork") : t("chooseMethod").replace("{platform}", selectedPlatform?.label ?? t("platform"))}</p></div>
        </div>
        <div className="switch-platform-redesign__progress" aria-label={`Step ${step === "platform" ? 1 : 2} of 2`}><span className="is-complete" /><span className={step === "loginMode" ? "is-complete" : ""} /></div>
        {step === "platform" ? (
          <section className="switch-platform-redesign__section">
            <div className="switch-platform-redesign__section-heading">
              <span>{t("availableNetworks")}</span>
              <span>{t("selectPlatform")} <span aria-hidden="true">↓</span></span>
            </div>
            <PlatformSelect
              onSelectPlatform={(p) => void handleSelectPlatform(p)}
              busyId={null}
              variant="switch"
              currentPlatformId={currentPlatformId}
            />
            <p className="switch-platform-redesign__hint">{t("platformHintSafe")}</p>
          </section>
        ) : (
          <section className="switch-platform-redesign__section">
            <button type="button" onClick={() => { setStep("platform"); setErrorMessage(null); if (currentPlatformId) { setSelectedPlatformId(currentPlatformId); } }} className="switch-platform-redesign__back">← {t("allPlatforms")}</button>
            {selectedPlatform && <div className="switch-platform-redesign__selected"><span className="switch-platform-redesign__selected-icon">{selectedPlatform.icon}</span><span><strong>{selectedPlatform.label}</strong><small>{t("selectedNetwork")}</small></span><span className="switch-platform-redesign__selected-check">✓</span></div>}
            <div className="switch-platform-redesign__section-heading"><span>{t("signInMethod")}</span><span>{t("chooseOne")}</span></div>
            <div className="switch-platform-redesign__mode-list">
              <button type="button" className="switch-platform-redesign__mode" disabled={isModeBusy} onClick={() => void handleLoginMode("auto")}><span className="switch-platform-redesign__mode-icon">⚡</span><span className="switch-platform-redesign__mode-copy"><strong>{isAutoLoading ? t("connecting") : t("systemAccount")}</strong><small>{t("systemAccountHint")}</small></span>{isAutoLoading ? <span className="platform-flow-spinner inline" /> : <span className="switch-platform-redesign__mode-arrow">→</span>}</button>
              <button type="button" className="switch-platform-redesign__mode" disabled={isModeBusy} onClick={() => void handleLoginMode("manual")}><span className="switch-platform-redesign__mode-icon">↗</span><span className="switch-platform-redesign__mode-copy"><strong>{isManualLoading ? t("opening") : t("personalAccount")}</strong><small>{t("personalAccountHint")}</small></span>{isManualLoading ? <span className="platform-flow-spinner inline manual" /> : <span className="switch-platform-redesign__mode-arrow">→</span>}</button>
            </div>
          </section>
        )}
      </div>

      {errorMessage && (
        <div className="notification-text notification-failed switch-platform-redesign__error">
          {errorMessage}
        </div>
      )}
    </div>
  );
};

export default SwitchPlatform;
