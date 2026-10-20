import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../../contexts/AuthContext";
import { appStorage } from "../../../../entrypoints/sidepanel/application/services/SidepanelServices";
import { hasExtensionConfigId } from "../../../../entrypoints/sidepanel/utils/resolveEffectiveProxy";
import { FaArrowRight, FaEye, FaEyeSlash, FaLock, FaShieldAlt, FaUser } from "../../assets/constants/icons";
import { User } from "../../types/types";
import "../../assets/css/pages/Login.css";
import { useTranslation } from "../../helpers/i18n";

type RememberedCredentials = {
  username: string;
  // NOTE: password is intentionally NOT stored for security.
  // Storing plain-text (or easily reversible) passwords in extension
  // storage is a security risk; only the username is persisted.
  rememberMe: boolean;
};

const REMEMBER_ME_KEY = "local:rememberedCredentials";
const SESSION_KEY = "local:draftCredentials"; // auto-save, not persistent

function Login() {
  const { t } = useTranslation();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(false);

  const { login, error, clearError } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    const restoreRememberedCredentials = async () => {
      try {
        const remembered =
          await appStorage.getItem<RememberedCredentials>(REMEMBER_ME_KEY);
        if (remembered?.rememberMe) {
          setRememberMe(true);
          // Only restore username — password is never persisted (security).
          setUsername(remembered.username || "");
        }
      } catch (e) {
        console.warn("[Login] Failed to restore remembered credentials", e);
      }
    };

    restoreRememberedCredentials();
  }, []);

  const persistRememberedCredentials = async (
    next?:
      | Partial<RememberedCredentials>
      | ((current: RememberedCredentials) => RememberedCredentials),
  ) => {
    const current: RememberedCredentials = {
      username: username,
      // password is intentionally excluded — never stored
      rememberMe,
    };

    const resolved =
      typeof next === "function"
        ? next(current)
        : { ...current, ...(next || {}) };

    try {
      // SESSION_KEY stores only username (no password) for draft state.
      await appStorage.setItem(SESSION_KEY, {
        username: resolved.username,
      });
      if (resolved.rememberMe) {
        await appStorage.setItem(REMEMBER_ME_KEY, {
          username: resolved.username,
          rememberMe: true,
        } satisfies RememberedCredentials);
      } else {
        await appStorage.removeItem(REMEMBER_ME_KEY);
      }
    } catch (e) {
      console.warn("[Login] Failed to persist remembered credentials", e);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      // Persist immediately so popup close/reopen or login failure doesn't lose state.
      await persistRememberedCredentials();

      const success = await login(username, password);
      if (success) {
        const storedUser = await appStorage.getItem<User>("local:user");
        const useExtensionConfig = hasExtensionConfigId(
          storedUser?.extension_session?.extension_config_id,
        );
        navigate(
          useExtensionConfig ? "/facebook-login-mode" : "/select-persona",
        );
      }
    } finally {
      setLoading(false);
    }
  };

  const handleUsernameChange = (e: any) => {
    const nextUsername = e.target.value;
    setUsername(nextUsername);
    if (rememberMe) {
      void persistRememberedCredentials({ username: nextUsername });
    }
    if (error) clearError();
  };

  const handlePasswordChange = (e: any) => {
    const nextPassword = e.target.value;
    setPassword(nextPassword);
    // Password is not persisted (security) — only local state is updated.
    if (error) clearError();
  };

  const handleRememberMeChange = async (e: any) => {
    const checked = !!e.target.checked;
    setRememberMe(checked);
    await persistRememberedCredentials({ rememberMe: checked });
  };

  return (
    <div className="modern-login-page">
      <div className="login-brand-panel" aria-hidden="true">
        <div className="login-brand-mark"><span className="login-brand-symbol">H</span><span>LERNA LAKES<small>Powered by Hydra</small></span></div>
        <div className="login-brand-story">
          <div className="login-brand-eyebrow"><span className="login-status-dot" /> YOUR WORKSPACE, CONNECTED</div>
          <h2>{t("loginTagline")}<br /><em>{t("loginWorkflow")}</em></h2>
          <p>{t("loginBrandCopy")}</p>
          <div className="login-brand-lines"><span /><span /><span /></div>
        </div>
        <div className="login-brand-bottom"><FaShieldAlt /> {t("loginSecure")}</div>
      </div>
      <div className="login-form-panel"><div className="modern-login-container">
        <div className="login-mobile-brand"><span className="login-brand-symbol">H</span> LERNA LAKES</div>
        <h1 className="modern-login-title">{t("loginWelcome")}</h1>
        <p className="login-subtitle">
          {t("loginSubtitle")}
        </p>

        <form onSubmit={handleSubmit} className="modern-login-form">
          <div className="modern-form-group">
            <label htmlFor="login-username">{t("loginUser")}</label>
            <div className="modern-input-wrapper">
              <FaUser className="input-icon" />
              <input
                id="login-username"
                autoComplete="username"
                value={username}
                onChange={handleUsernameChange}
                placeholder={t("loginEnterUser")}
                required
                disabled={loading}
              />
            </div>
          </div>
          <div className="modern-form-group">
            <label htmlFor="password">{t("loginPassword")}</label>
            <div className="modern-input-wrapper modern-input-wrapper--password">
              <FaLock className="input-icon" />
              <input
                type={showPassword ? "text" : "password"}
                id="password"
                autoComplete="current-password"
                value={password}
                onChange={handlePasswordChange}
                placeholder={t("loginEnterPassword")}
                required
                disabled={loading}
              />
              <button
                type="button"
                className="eye-icon"
                aria-label={showPassword ? t("hidePassword") : t("showPassword")}
                aria-pressed={showPassword}
                onClick={() => setShowPassword((prev) => !prev)}
              >
                {showPassword ? <FaEyeSlash /> : <FaEye />}
              </button>
            </div>
          </div>

          <div className="remember-row">
            <label className={`remember-label ${loading ? "remember-label--disabled" : ""}`}>
              <input
                type="checkbox"
                checked={rememberMe}
                onChange={handleRememberMeChange}
                disabled={loading}
                className="remember-checkbox"
              />
              {t("loginRemember")}
            </label>
          </div>

          {error && (
            <div className="modern-error-message">
              <span>{error}</span>
              <button
                type="button"
                onClick={clearError}
                aria-label={t("closeError")}
              >
                ×
              </button>
            </div>
          )}
          <button type="submit" disabled={loading} className="modern-login-btn">
            {loading ? t("loginSigning") : <>{t("loginSubmit")} <FaArrowRight aria-hidden="true" /></>}
          </button>
        </form>
        <div className="login-secure-note"><FaLock aria-hidden="true" />
          {t("loginProtected")}
        </div>
      </div></div>
    </div>
  );
}

export default Login;
