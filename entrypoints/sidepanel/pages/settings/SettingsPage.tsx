import "../../assets/css/pages/settings.css";
import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { FaArrowLeft, FaCheckCircle, FaCog, FaPalette, FaGlobe, FaSlidersH, FaUndo } from "../../assets/constants/icons";
import SwitchPlatform from "../platformPage/PlatformPage";
import { setLanguage, useTranslation, type AppLanguage } from "../../helpers/i18n";

const STORAGE_KEY = "hydra:ui-preferences";

type Preferences = {
  density: "comfortable" | "compact";
  reducedMotion: boolean;
  theme: "light" | "dark";
  language: AppLanguage;
};

const DEFAULTS: Preferences = { density: "comfortable", reducedMotion: false, theme: "light", language: "en" };

function readPreferences(): Preferences {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return DEFAULTS;
    const parsed = JSON.parse(raw) as Partial<Preferences>;
    return {
      density: parsed.density === "compact" ? "compact" : "comfortable",
      reducedMotion: parsed.reducedMotion === true,
      theme: parsed.theme === "dark" ? "dark" : "light",
      language: parsed.language === "vi" ? "vi" : "en",
    };
  } catch {
    return DEFAULTS;
  }
}

export function applyUiPreferences(value: Preferences) {
  document.documentElement.dataset.colorMode = value.theme;
  document.documentElement.lang = value.language;
  document.documentElement.style.colorScheme = value.theme;
  document.documentElement.dataset.uiDensity = value.density;
  document.documentElement.dataset.uiReducedMotion = String(value.reducedMotion);
}

export function initializeUiPreferences() {
  applyUiPreferences(readPreferences());
}

export default function SettingsPage() {
  const navigate = useNavigate();
  const { t } = useTranslation();
  const [preferences, setPreferences] = useState<Preferences>(readPreferences);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    applyUiPreferences(preferences);
    setLanguage(preferences.language);
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(preferences));
      setSaved(true);
    } catch {
      setSaved(false);
    }
  }, [preferences]);

  return (
    <main className="settings-page">
      <div className="settings-page__toolbar">
        <button type="button" className="settings-page__back" onClick={() => navigate(-1)} aria-label={t("back")}>
          <FaArrowLeft /> <span>{t("back")}</span>
        </button>
        <span className="settings-page__eyebrow">{t("preferences")}</span>
      </div>

      <header className="settings-page__heading">
        <div className="settings-page__heading-icon"><FaCog /></div>
        <div>
          <h1>{t("settings")}</h1>
          <p>{t("settingsHint")}</p>
        </div>
      </header>

      <section
        id="settings-platform"
        className="settings-page__section settings-page__section--platform"
        aria-labelledby="settings-platform-title">
        <div className="settings-page__section-title">
          <span className="settings-page__section-icon"><FaGlobe /></span>
          <div><h2 id="settings-platform-title">{t("platform")}</h2><p>{t("platformHint")}</p></div>
        </div>
        <div className="settings-page__platform-content"><SwitchPlatform /></div>
      </section>

      <section className="settings-page__section" aria-labelledby="settings-appearance">
        <div className="settings-page__section-title">
          <span className="settings-page__section-icon"><FaPalette /></span>
          <div><h2 id="settings-appearance">{t("appearance")}</h2><p>{t("appearanceHint")}</p></div>
        </div>
        <div className="settings-page__setting">
          <div className="settings-page__description"><strong>{t("colorMode")}</strong><span>{t("colorModeHint")}</span></div>
          <div className="settings-page__segmented" role="group" aria-label={t("colorMode")}>
            <button type="button" className={preferences.theme === "light" ? "selected" : ""} aria-pressed={preferences.theme === "light"} onClick={() => setPreferences((p) => ({ ...p, theme: "light" }))}>{t("light")}</button>
            <button type="button" className={preferences.theme === "dark" ? "selected" : ""} aria-pressed={preferences.theme === "dark"} onClick={() => setPreferences((p) => ({ ...p, theme: "dark" }))}>{t("dark")}</button>
          </div>
        </div>
        <div className="settings-page__setting">
          <div className="settings-page__description"><strong>{t("density")}</strong><span>{t("densityHint")}</span></div>
          <div className="settings-page__segmented" role="group" aria-label={t("density")}>
            <button type="button" className={preferences.density === "comfortable" ? "selected" : ""} aria-pressed={preferences.density === "comfortable"} onClick={() => setPreferences((p) => ({ ...p, density: "comfortable" }))}>{t("comfortable")}</button>
            <button type="button" className={preferences.density === "compact" ? "selected" : ""} aria-pressed={preferences.density === "compact"} onClick={() => setPreferences((p) => ({ ...p, density: "compact" }))}>{t("compact")}</button>
          </div>
        </div>
      </section>

      <section className="settings-page__section" aria-labelledby="settings-language">
        <div className="settings-page__section-title">
          <span className="settings-page__section-icon"><FaGlobe /></span>
          <div><h2 id="settings-language">{t("language")}</h2><p>{t("languageHint")}</p></div>
        </div>
        <div className="settings-page__setting">
          <div className="settings-page__description"><strong>{t("language")}</strong><span>{t("languageHint")}</span></div>
          <div className="settings-page__segmented" role="group" aria-label={t("language")}>
            <button type="button" lang="en" className={preferences.language === "en" ? "selected" : ""} aria-pressed={preferences.language === "en"} onClick={() => setPreferences(p => ({ ...p, language: "en" }))}>English</button>
            <button type="button" lang="vi" className={preferences.language === "vi" ? "selected" : ""} aria-pressed={preferences.language === "vi"} onClick={() => setPreferences(p => ({ ...p, language: "vi" }))}>Tiếng Việt</button>
          </div>
        </div>
      </section>

      <section className="settings-page__section" aria-labelledby="settings-behavior">
        <div className="settings-page__section-title">
          <span className="settings-page__section-icon"><FaSlidersH /></span>
          <div><h2 id="settings-behavior">{t("behavior")}</h2><p>{t("behaviorHint")}</p></div>
        </div>
        <div className="settings-page__setting">
          <div className="settings-page__description"><strong>{t("reduceMotion")}</strong><span>{t("reduceMotionHint")}</span></div>
          <label className="settings-page__switch">
            <input type="checkbox" checked={preferences.reducedMotion} onChange={(e) => setPreferences((p) => ({ ...p, reducedMotion: e.target.checked }))} aria-label={t("reduceMotion")} />
            <span className="settings-page__switch-track" aria-hidden="true" />
          </label>
        </div>
      </section>

      <footer className="settings-page__footer">
        <span className="settings-page__save-state" role="status">{saved ? <><FaCheckCircle /> {t("saved")}</> : t("saveFailed")}</span>
        <button type="button" className="settings-page__reset" onClick={() => setPreferences({ ...DEFAULTS })}><FaUndo />{t("restore")}</button>
      </footer>
    </main>
  );
}
