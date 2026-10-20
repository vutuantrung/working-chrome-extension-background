import {
  browserProxy,
  browserTabs,
  extensionCommands,
  extensionStorage,
  localStorageService,
} from "../application/services/SidepanelServices";
import {
  HashRouter as Router,
  Routes,
  Route,
  Navigate,
  useNavigate,
  useLocation,
} from "react-router-dom";
import { useEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "../helpers/i18n";

import { useAuth } from "../contexts/AuthContext";

import Login from "../pages/login/LoginPage";
import FacebookLoginMode from "../pages/login/ChoosePlatform";
import SelectPersona from "../pages/persona/SelectPersona";
import EvidenStudio from "../pages/eviden-studio/EvidenceStudioPage";
import GroupPage from "../pages/groups/GroupPage";
import SettingsPage from "../pages/settings/SettingsPage";
import DashboardPage from "../pages/dashboard/DashboardPage";

import { detectPlatformByPattern, MainTab } from "../helpers/constants";
import type { AutomationSubTab, PlatformId } from "../types/types";
import { getSelectedPlatformId } from "../helpers/helpers";

import PlatformMetaBar from "../components/PlatformMetaBar";
import BottomNav from "../components/Nav/BottomNav";
import { ProtectedRoute, PublicRoute } from "../components/RouteGuards";
import UnsupportedPlatform from "../components/modal/UnsupportedPlatform";
import AutomationPage from "../pages/automation/AutomationPage";
import { StorageChangeMap } from "../types/BrowserPorts";
import { FaCog, FaUser, FaSignOutAlt, FaSyncAlt } from "../assets/constants/icons";

function Navigation() {
  const {
    isAuthenticated,
    user,
    logout,
    restart,
    extensionProxy,
  } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [restarting, setRestarting] = useState(false);
  const [proxyMatchesExtension, setProxyMatchesExtension] = useState(false);
  const [proxyHealth, setProxyHealth] = useState<any>(null);

  const { t } = useTranslation();

  const extensionProxyIdentity = useMemo(() => {
    const host = typeof extensionProxy?.host === "string"
      ? String(extensionProxy.host).trim()
      : "";
    const portRaw = extensionProxy?.port;
    const port = typeof portRaw === "number"
      ? portRaw
      : typeof portRaw === "string"
        ? parseInt(portRaw, 10)
        : NaN;
    return { host, port, ok: !!host && Number.isFinite(port) };
  }, [extensionProxy]);

  const proxyHealthUpdatedAt = proxyHealth && typeof proxyHealth.updatedAt === "number"
    ? proxyHealth.updatedAt
    : 0;
  const proxyHealthIsFresh = proxyHealthUpdatedAt > 0 && Date.now() - proxyHealthUpdatedAt < 2 * 60 * 1000;
  const hasConnectivityIssue = proxyHealthIsFresh && !!proxyHealth && proxyHealth.state === "error";
  const showRestartButton =
    isAuthenticated
    && hasConnectivityIssue
    && extensionProxyIdentity.ok
    && proxyMatchesExtension;

  useEffect(() => {
    let mounted = true;
    const onStorageChanged = (changes: StorageChangeMap, area: string) => {
      if (!mounted || area !== "local") return;
      if (changes.proxyHealth)
        setProxyHealth(changes.proxyHealth.newValue ?? null);
    };
    const unsubscribeStorage = extensionStorage.subscribe(onStorageChanged);
    const load = async () => {
      if (!mounted) return;
      const result = await extensionStorage.get(["proxyHealth"]);
      setProxyHealth(result?.proxyHealth ?? null);
    };
    load();

    return () => {
      mounted = false;
      unsubscribeStorage();
    };
  }, [isAuthenticated]);

  useEffect(() => {
    let mounted = true;
    let intervalId: number | undefined;

    const doesProxyMatchExtension = (proxyValue: any): boolean => {
      if (!extensionProxyIdentity.ok) return false;
      if (!proxyValue || proxyValue.mode !== "fixed_servers") return false;
      const rules = proxyValue.rules || {};
      const matchOne = (rule: any) => {
        if (!rule?.host || rule?.port === undefined || rule?.port === null)
          return false;
        const rh = String(rule.host).trim().toLowerCase();
        const rp = typeof rule.port === "number" ? rule.port : parseInt(rule.port, 10);
        return (
          rh === extensionProxyIdentity.host.toLowerCase() &&
          rp === extensionProxyIdentity.port
        );
      };
      return matchOne(rules.proxyForHttp) || matchOne(rules.proxyForHttps);
    };

    async function tick() {
      if (!mounted) return;
      if (!isAuthenticated || !extensionProxyIdentity.ok) {
        setProxyMatchesExtension(false);
        return;
      }
      const proxyValue = await browserProxy.getCurrent();
      if (!mounted) return;
      setProxyMatchesExtension(doesProxyMatchExtension(proxyValue));
    }

    tick().then(() => {
      if (!mounted) return;
      if (isAuthenticated && extensionProxyIdentity.ok) {
        intervalId = window.setInterval(tick, 5000);
      }
    });

    return () => {
      mounted = false;
      if (intervalId) window.clearInterval(intervalId);
    };
  }, [
    isAuthenticated,
    extensionProxyIdentity.ok,
    extensionProxyIdentity.host,
    extensionProxyIdentity.port,
  ]);

  if (!isAuthenticated) return null;

  async function restartOnClickHandler() {
    setRestarting(true);
    try { await restart(); }
    finally { setRestarting(false); }
  }

  return (
    <div className="modern-navigation">
      <div className="nav-content">
        <div className="user-profile">
          <div className="user-avatar">
            <FaUser />
          </div>
          <div className="user-info">
            <span className="user-greeting">{t("greeting")},</span>
            <span className="user-name-display">{user?.name}</span>
          </div>
        </div>
        <div className="nav-actions">
          <button
            type="button"
            className={`modern-settings-btn${location.pathname === "/settings" ? " is-active" : ""}`}
            title="Settings"
            aria-label="Open settings"
            aria-current={location.pathname === "/settings" ? "page" : undefined}
            onClick={() => navigate(location.pathname === "/settings" ? "/" : "/settings")}
          >
            <FaCog />
          </button>
          <button onClick={logout} className="modern-logout-btn" title="Logout">
            <FaSignOutAlt />
          </button>
          {showRestartButton && (
            <button
              onClick={restartOnClickHandler}
              className="modern-monitoring-btn"
              title="Network issue detected. Restart will clear proxy and logout."
              disabled={restarting}
            >
              <FaSyncAlt />
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

function AppRoutes() {
  const { isAuthenticated, hasExtensionConfig } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const loginCompleteRef = useRef(false);

  const extensionVersion = useMemo(
    () => extensionCommands.getVersion("2.8.0")
    , []);

  const isSettingsRoute = location.pathname === "/settings";

  const [activeMainTabState, setActiveMainTab] = useState<MainTab>("automation");
  const [activeSubTab, setActiveSubTab] = useState<AutomationSubTab>("config");
  const [currentPlatform, setCurrentPlatform] = useState<PlatformId | null>(null);

  // Guard: suppress the onboarding-redirect effect for a tick after the
  const loginRedirectConsumedRef = useRef(false);

  // Track persisted UI flags as state so React can react to changes and effect deps work correctly
  const [hasSelectedFbMode, setHasSelectedFbMode] = useState(() => localStorageService.getItem("fbLoginModeSelected") === "1");
  const [hasSelectedPersona, setHasSelectedPersona] = useState(() => !!localStorageService.getItem("selectedPersonaId"));

  const loginSuccessRedirect = localStorageService.getItem("login:login-success-redirect") === "1";
  const effectiveFbModeSelected = hasSelectedFbMode || localStorageService.getItem("fbLoginModeSelected") === "1";
  const effectivePersonaSelected = hasSelectedPersona || !!localStorageService.getItem("selectedPersonaId");

  const activeMainTab = loginSuccessRedirect ? "automation" : activeMainTabState;
  const isSelectPersonaRoute = location.pathname === "/select-persona";
  const isOnboardingPlatformRoute = location.pathname === "/facebook-login-mode" && !effectiveFbModeSelected;

  const showHeaderBar =
    isAuthenticated &&
    (hasExtensionConfig ||
      effectivePersonaSelected ||
      isSettingsRoute ||
      isSelectPersonaRoute ||
      isOnboardingPlatformRoute);
  const showBottomNav = isAuthenticated && effectiveFbModeSelected && !isSettingsRoute;

  useEffect(() => {
    function syncFromStorage() {
      setHasSelectedFbMode(localStorageService.getItem("fbLoginModeSelected") === "1");
      setHasSelectedPersona(!!localStorageService.getItem("selectedPersonaId"));
    };
    // Listen for cross-tab storage events
    window.addEventListener("storage", syncFromStorage);
    // Listen for same-tab sync events (dispatched after updating persisted UI state
    // flags, so React state updates promptly)
    window.addEventListener("localStorageSync", syncFromStorage);
    return () => {
      window.removeEventListener("storage", syncFromStorage);
      window.removeEventListener("localStorageSync", syncFromStorage);
    };
  }, []);

  function handleMainTabChange(tab: MainTab) {
    setActiveMainTab(tab);
    navigate("/");
  }

  // Render main content based on active tab
  function renderMainContent() {
    const selectedPlatformId = getSelectedPlatformId();

    switch (activeMainTab) {
      case "dashboard":
        return <DashboardPage />;
      case "group":
        return <GroupPage />;
      case "eviden":
        if (selectedPlatformId === null) return <UnsupportedPlatform />;
        return <EvidenStudio platform={selectedPlatformId} />;
      case "automation":
        if (selectedPlatformId !== "facebook") {
          return (
            <div className="automation-tab-container automation-tab-container--fill"            >
              <PlatformMetaBar />
              <UnsupportedPlatform />
            </div>
          );
        }
        return <AutomationPage activeView={activeSubTab} setActiveSubTab={setActiveSubTab} />;
      default:
        return <DashboardPage />;
    }
  }

  // Auto-navigate to eviden if there's a recent screenshot
  useEffect(() => {
    extensionStorage.get(["lastUnsavedProfileCase"]).then((result) => {
      const lup = result.lastUnsavedProfileCase as {
        id: string;
        timestamp: number;
      };
      if (Date.now() - lup?.timestamp < 30 * 1000) setActiveMainTab("eviden");
    });
  }, []);

  useEffect(() => {
    if (!isAuthenticated) {
      // Reset on logout so a fresh login goes through onboarding normally.
      loginCompleteRef.current = false;
      return;
    }

    // Reset when fbLoginModeSelected has been cleared (logout / session expiry)
    // so a fresh login is not blocked by a stale ref.
    if (localStorageService.getItem("fbLoginModeSelected") !== "1") {
      loginCompleteRef.current = false;
    }

    if (window.location.hash === "#/settings") return;
    if (localStorageService.getItem("login:login-success-redirect") === "1") return;
    if (loginRedirectConsumedRef.current) return;

    if (loginCompleteRef.current) return;

    const freshFbMode = localStorageService.getItem("fbLoginModeSelected") === "1";
    const freshPersona = !!localStorageService.getItem("selectedPersonaId");

    if (freshFbMode) return;
    if (hasExtensionConfig) {
      if (
        window.location.hash !== "#/facebook-login-mode" &&
        window.location.hash !== "#/switch-platform"
      ) {
        window.location.hash = "#/facebook-login-mode";
      }
      return;
    }
    if (!freshPersona && window.location.hash !== "#/select-persona") {
      window.location.hash = "#/select-persona";
      return;
    }
    if (
      freshPersona &&
      window.location.hash !== "#/facebook-login-mode" &&
      window.location.hash !== "#/switch-platform"
    ) {
      window.location.hash = "#/facebook-login-mode";
    }
  }, [
    isAuthenticated,
    hasExtensionConfig,
    hasSelectedPersona,
    hasSelectedFbMode,
  ]);

  // Detect current browser platform
  useEffect(() => {
    browserTabs.getActiveTab().then((tab) => {
      setCurrentPlatform(detectPlatformByPattern(tab?.url || tab?.pendingUrl));
    });
  }, []);

  useEffect(() => {
    const redirectFlag = localStorageService.getItem("login:login-success-redirect") === "1";
    if (redirectFlag) {
      loginRedirectConsumedRef.current = true;
      loginCompleteRef.current = true;
      localStorageService.removeItem("login:login-success-redirect");
      setActiveMainTab("automation");

      setHasSelectedFbMode(localStorageService.getItem("fbLoginModeSelected") === "1");
      setHasSelectedPersona(!!localStorageService.getItem("selectedPersonaId"));

      queueMicrotask(() => {
        loginRedirectConsumedRef.current = false;
      });
    }
  }, [location.pathname]);

  return (
    <div className="app-container">
      {showHeaderBar && <Navigation />}

      <div className="app-content">
        <Routes>
          <Route
            path="/login"
            element={
              <PublicRoute>
                <Login />
              </PublicRoute>
            }
          />

          <Route
            path="/select-persona"
            element={
              <ProtectedRoute>
                {hasExtensionConfig
                  ?
                  (<Navigate to="/facebook-login-mode" replace />)
                  :
                  (<SelectPersona />)}
              </ProtectedRoute>
            }
          />

          <Route
            path="/facebook-login-mode"
            element={
              <ProtectedRoute>
                <FacebookLoginMode />
              </ProtectedRoute>
            }
          />

          <Route
            path="/settings"
            element={<ProtectedRoute><SettingsPage /></ProtectedRoute>}
          />

          <Route
            path="/switch-platform"
            element={<Navigate to="/settings" replace />}
          />

          <Route
            path="/*"
            element={
              <ProtectedRoute>
                {!hasExtensionConfig && !effectivePersonaSelected ? (
                  <Navigate to="/select-persona" />
                ) : effectiveFbModeSelected ||
                  loginSuccessRedirect ||
                  loginRedirectConsumedRef.current ||
                  loginCompleteRef.current ? (
                  renderMainContent()
                ) : (
                  <Navigate to="/facebook-login-mode" />
                )}
              </ProtectedRoute>
            }
          />
        </Routes>
      </div>

      {showBottomNav && (
        <BottomNav
          activeTab={activeMainTab}
          onTabChange={handleMainTabChange}
        />
      )}
      <div className="global-version-footer">Version: {extensionVersion}</div>
    </div>
  );
}

export default AppRoutes;