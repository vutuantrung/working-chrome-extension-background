import { useEffect, useMemo, useState } from "react";
import { FaRobot, FaGlobe, FaUser, FaCog, FaDatabase, FaCheck, FaExclamationTriangle, FaFacebook, FaSearch, FaClock, FaPlus, FaChevronDown, FaCheckCircle, FaTimesCircle, FaFolder, FaArrowRight, FaSyncAlt, FaShieldAlt, FiCopy, FiFilter, FiExternalLink, FiLayers, FiList } from "../assets/constants/icons";
import { MdOutlineCollections } from "../assets/constants/icons";
import { HiOutlineUserGroup } from "../assets/constants/icons";
import PersonaCard from "../components/Persona/PersonaCard";
import Avatar from "../components/Persona/Avatar";
import GenderDot from "../components/Persona/GenderDot";
import StatusBadge from "../components/Persona/StatusBadge";
import StatusScreen from "../components/Persona/StatusScreen";
import TopTabs from "../components/TopTabs";
import BottomNav from "../components/Nav/BottomNav";
import TaskMonitorTab from "../components/Automation/TaskMonitorTab";
import TaskPriorityBadge from "../components/Automation/TaskPriorityBadge";
import TaskStatusBadge from "../components/Automation/TaskStatusBadge";
import AutomationTab from "../components/AutomationTab";
import ImageDetailModal from "../components/EvidenStudio/ImageDetailModal";
import ConfirmModal from "../components/modal/ConfirmModal";
import { SidebarMenu } from "../components/Sidebar/SidebarMenu";
import { extensionStorage } from "../application/services/SidepanelServices";
import PlatformMetaBar from "../components/PlatformMetaBar";
import SidebarItem from "../components/Sidebar/SidebarItem";
import SidebarChildItem from "../components/Sidebar/SidebarChildItem";
import JsonEditor from "../components/JsonEditor";
import ComingSoon from "../components/modal/CommingSoon";
import UnsupportedPlatform from "../components/modal/UnsupportedPlatform";
import type {
  Persona,
  ProfileCase,
  GetProfileCasesResponse,
  CaseFilter,
  ImageItem,
  ImageMeta,
  Task,
  AuthContextType,
} from "../types/types";
import CaseDetail from "../components/EvidenStudio/CaseDetail";
import CaseSidebar from "../components/EvidenStudio/CaseSidebar";
import CaseSidebarItem from "../components/EvidenStudio/CaseSidebarItem";
import { PLATFORMS } from "../helpers/helpers-ui";
import type { MainTab } from "../helpers/constants";
import "../assets/css/gallery.css";
import "../assets/css/pages/settings.css";
import GroupPage, { type GroupPageDataSource } from "../pages/groups/GroupPage";
import AssignItem, { infiltrationLabels, type InfiltrationStatus } from "../pages/groups/AssignItem";
import DashboardPage from "../pages/dashboard/DashboardPage";
import WorkspacePageHeader from "../components/WorkspacePageHeader";
import { MultiSelectFilter, SearchInput } from "../components/ui";
import { PLATFORM_OPTIONS, FB_GROUP_TYPE, localizeOptions } from "../helpers/constants";
import { demoGroupProfiles } from "./groupSamples";
import { AuthContext } from "../contexts/AuthContext";
import PlatformSelect from "../components/PlatformSelect";
import { setLanguage, useTranslation, type AppLanguage } from "../helpers/i18n";

const persona: Persona = {
  id: "demo-persona",
  job: "Software Engineer",
  gender: "male",
  status: "active",
  address: "Ho Chi Minh City",
  country: "Vietnam",
  user_id: "demo-user",
  nickname: "Demo",
  last_name: "Nguyen",
  platforms: ["facebook", "tiktok"],
  extra_meta: {},
  first_name: "Alex",
  description: "Demo persona",
  assigned_vms: [],
  created_time: Date.now(),
  updated_time: Date.now(),
  date_of_birth: "1995-01-01",
  marital_status: "single",
  total_accounts: 3,
  assigned_emails: 2,
  logged_accounts: 2,
  place_of_origin: "Vietnam",
  assigned_mobiles: 1,
  assigned_proxies: 1,
};


const demoCaseDefault: ProfileCase = {
  id: "new-case",
  name: "New case",
  platform: "facebook",
  description: "Create a fresh Eviden Studio case.",
  profile_url: "https://facebook.com/new-profile",
  origin_url: "https://facebook.com/posts/new",
  profile_id: "demo-profile-new",
  created_time: Date.now() - 60 * 60 * 1000,
  updated_time: Date.now() - 30 * 60 * 1000,
  profileCaseEvidens: [],
};

const demoCases: ProfileCase[] = [
  {
    id: "case-facebook-001",
    name: "Alex Nguyen",
    platform: "facebook",
    description: "Representative Facebook investigation case used for CSS preview.",
    profile_url: "https://facebook.com/alex.nguyen",
    origin_url: "https://facebook.com/alex.nguyen/posts/1001",
    profile_id: "profile-1001",
    created_time: Date.now() - 2 * 24 * 60 * 60 * 1000,
    updated_time: Date.now() - 2 * 60 * 60 * 1000,
    profileCaseEvidens: [],
  },
  {
    id: "case-tiktok-002",
    name: "Taylor Smith",
    platform: "tiktok",
    description: "TikTok profile case preview.",
    profile_url: "https://tiktok.com/@taylor",
    origin_url: "https://tiktok.com/@taylor/video/123",
    profile_id: "profile-1002",
    created_time: Date.now() - 5 * 24 * 60 * 60 * 1000,
    updated_time: Date.now() - 5 * 60 * 60 * 1000,
    profileCaseEvidens: [],
  },
  {
    id: "case-x-003",
    name: "Jordan Lee",
    platform: "x",
    description: "X profile case preview.",
    profile_url: "https://x.com/jordan",
    origin_url: "https://x.com/jordan/status/999",
    profile_id: "profile-1003",
    created_time: Date.now() - 8 * 24 * 60 * 60 * 1000,
    updated_time: Date.now() - 24 * 60 * 60 * 1000,
    profileCaseEvidens: [],
  },
];

const demoProfileCases: GetProfileCasesResponse = {
  data: demoCases,
  meta: { total_count: demoCases.length, offset: 0, limit: 10 },
};

const entries = [
  "App shell / Navigation",
  "Icon Library",
  "DashboardPage",
  "SettingsPage",
  "WorkspacePageHeader",
  "SearchInput",
  "MultiSelectFilter",
  "AssignItem",
  "Group Status Badges",
  "Login",
  "FacebookLoginMode",
  "PlatformSelect",
  "SwitchPlatform",
  "SelectPersona",
  "SwitchPersona",
  "AutomationPage",
  "GroupPage",
  "EvidenStudio",
  "TopTabs",
  "BottomNav",
  "PlatformMetaBar",
  "AutomationTab",
  "TaskMonitorTab",
  "Task Priority Badges",
  "Task Status Badges",
  "JsonEditor",
  "Avatar",
  "GenderDot",
  "PersonaCard",
  "StatusBadge",
  "StatusScreen",
  "SidebarMenu",
  "SidebarItem",
  "SidebarChildItem",
  "CaseSidebar",
  "CaseSidebarItem",
  "CaseDetail",
  "ImageDetailModal",
  "ConfirmModal",
  "ComingSoon",
  "UnsupportedPlatform",
];

function Preview({ id, title, children, file }: { id: string; title: string; children: React.ReactNode; file?: string }) {
  return (
    <section id={id} className="gallery-preview-card">
      <div className="gallery-preview-card__head">
        <div>
          <div className="gallery-preview-card__title">{title}</div>
          {file && <code className="gallery-preview-card__file">{file}</code>}
        </div>
        <a className="gallery-preview-card__anchor" href={`#${id}`}>#</a>
      </div>
      <div className="gallery-preview-card__canvas">{children}</div>
    </section>
  );
}

function LoginPreview() {
  return (
    <div className="modern-login-page gallery-contained-page">
      <div className="modern-login-container">
        <h1 className="modern-login-title">Welcome back</h1>
        <p className="login-subtitle">Sign in to continue</p>
        <div className="modern-login-form">
          <div className="modern-form-group"><div className="modern-input-wrapper"><span className="input-icon">@</span><input placeholder="Email" /></div></div>
          <div className="modern-form-group"><div className="modern-input-wrapper modern-input-wrapper--password"><span className="input-icon">•</span><input type="password" value="password" readOnly /></div></div>
          <div className="remember-row"><label><input className="remember-checkbox" type="checkbox" defaultChecked /> Remember me</label></div>
          <button className="modern-login-btn">Sign in</button>
        </div>
      </div>
    </div>
  );
}

function PlatformGridPreview() {
  const [selected, setSelected] = useState<string | null>(null);
  return (
    <div className="fb-login-mode-container switch-platform-page switch-platform-redesign gallery-contained-page">
      {/* Platform switcher preview section */}
      <div className="switch-platform-redesign__shell">
        <div className="switch-platform-redesign__eyebrow">
          <span className="switch-platform-redesign__pulse" /> WORKSPACE SETTINGS
          <span className="switch-platform-redesign__step">STEP {selected ? "02" : "01"} / 02</span>
        </div>
        <div className="switch-platform-redesign__heading">
          <div className="switch-platform-redesign__heading-icon">↗</div>
          <div>
            <h1>{selected ? "Choose how to connect" : "Switch platform"}</h1>
            <p>{selected ? "Select a sign-in method for the selected network." : "Choose a network to manage in your workspace."}
            </p>
          </div>
        </div>

        {/* Progress indicator for platform switch steps */}
        <div className="switch-platform-redesign__progress">
          <span className="is-complete" /><span className={selected ? "is-complete" : ""} />
        </div>

        {selected
          ?
          < section className="switch-platform-redesign__section">
            <button className="switch-platform-redesign__back" onClick={() => setSelected(null)}>← All platforms
            </button>
            <div className="switch-platform-redesign__selected">
              <strong>{selected}</strong>
              <span className="switch-platform-redesign__selected-check">✓</span>
            </div>
            <div className="switch-platform-redesign__section-heading">
              <span>SIGN-IN METHOD</span>
            </div>
            <div className="switch-platform-redesign__mode-list">
              <button className="switch-platform-redesign__mode">
                <span className="switch-platform-redesign__mode-icon">⚡</span>
                <span className="switch-platform-redesign__mode-copy">
                  <strong>System account</strong>
                  <small>Continue with the account managed by your workspace.</small>
                </span>
                <span className="switch-platform-redesign__mode-arrow">→</span></button>
              <button className="switch-platform-redesign__mode">
                <span className="switch-platform-redesign__mode-icon">↗</span>
                <span className="switch-platform-redesign__mode-copy">
                  <strong>Personal account</strong>
                  <small>Sign in manually using your own credentials.</small>
                </span>
                <span className="switch-platform-redesign__mode-arrow">→</span>
              </button>
            </div>
          </section> :
          <section className="switch-platform-redesign__section">
            <div className="switch-platform-redesign__section-heading">
              <span>AVAILABLE NETWORKS</span>
              <span>Select a platform ↓</span>
            </div>
            <PlatformSelect
              busyId={null}
              variant="switch"
              currentPlatformId="facebook"
              onSelectPlatform={(platform) => setSelected(platform.label)} />
            <p className="switch-platform-redesign__hint">
              Your current workspace and data will remain available when switching networks.
            </p>
          </section>
        }
      </div>
    </div >
  );
}

function AutomationPreview() {
  return (
    <div className="content-wrapper gallery-contained-page">
      <div className="schedule-info-banner">
        <div className="schedule-info-title"><FaRobot /> Automation</div>
        <div className="schedule-items">
          <div className="schedule-item"><span className="schedule-task-name">Facebook engagement</span><span className="schedule-time-info"><span className="schedule-time">09:30</span><span className="schedule-count">12 tasks</span></span></div>
          <div className="schedule-item"><span className="schedule-task-name">Profile sync</span><span className="schedule-time-info"><span className="schedule-time">14:00</span><span className="schedule-count">4 tasks</span></span></div>
        </div>
      </div>
      <div className="gallery-automation-grid">
        <div className="gallery-mini-panel"><strong>Configuration</strong><label>Delay<input value="5" readOnly /></label><button className="button">Save</button></div>
        <div className="gallery-mini-panel"><strong>Monitor</strong><div className="gallery-task-row"><FaCheck /> Running task</div><div className="gallery-task-row"><FaExclamationTriangle /> Waiting task</div></div>
      </div>
    </div>
  );
}

function AutomationTabDemo() {
  const [saved, setSaved] = useState<any>(null);
  const settings = {
    isTabSpecific: false,
    scheduleStartTime: "09:00:00",
    scheduleEndTime: "18:00:00",
    proxyOption: "system",
  };
  const userInfo = {
    id: "gallery-user",
    username: "gallery",
    name: "Gallery User",
    apikey: "gallery-demo-key",
    tenants: [],
    extension_session: {
      automation: true,
      schedule_start_time: "09:00:00",
      schedule_end_time: "18:00:00",
    },
  };
  return (
    <GalleryStorageSeed>
      <div className="gallery-real-component-frame">
        <AutomationTab
          settings={settings}
          userInfo={userInfo}
          onSave={(value) => setSaved(value)}
          onEditJson={() => setSaved({ action: "edit-json" })}
        />
        {saved && <pre className="gallery-demo-output">{JSON.stringify(saved, null, 2)}</pre>}
      </div>
    </GalleryStorageSeed>
  );
}

const mockGroupDataSource: GroupPageDataSource = async (
  _assigneeId,
  status,
  search,
  offset = 0,
  limit = 10,
  platforms,
  types,
) => {
  await new Promise((resolve) => setTimeout(resolve, 120));

  let filtered = [...demoGroupProfiles];

  if (status === "UNASSIGNED") {
    filtered = filtered.filter((item) => !item.assignedGroupId);
  } else if (status === "ASSIGNED") {
    filtered = filtered.filter((item) => Boolean(item.assignedGroupId));
  }

  if (search) {
    const query = search.toLowerCase();
    filtered = filtered.filter(
      (item) =>
        item.profileName.toLowerCase().includes(query) ||
        item.socialId.toLowerCase().includes(query),
    );
  }

  if (platforms?.length) {
    filtered = filtered.filter((item) => platforms.includes(item.channelName));
  }

  if (types?.length) {
    filtered = filtered.filter((item) => types.includes(item.profileType));
  }

  const data = filtered.slice(offset, offset + limit);
  return {
    success: true,
    data,
    memberSources: data,
    total: filtered.length,
  };
};

const noopAsync = async () => { };
const galleryAuthValue: AuthContextType = {
  user: {
    id: "gallery-user",
    username: "gallery",
    name: "Gallery User",
    apikey: "gallery-demo-key",
    tenants: [],
    extension_session: {},
  },
  facebookAccounts: [],
  extensionProxy: null,
  loading: false,
  login: async () => true,
  loginWithMode: async () => ({ success: true }),
  resumeSocialPlatformAfterRelogin: noopAsync,
  logout: noopAsync,
  restart: noopAsync,
  applyEffectiveProxy: noopAsync,
  persistAndApplyPersonaProxy: noopAsync,
  applyPersonaOnSelect: noopAsync,
  hasExtensionConfig: true,
  canSwitchPersona: true,
  switchPersona: async () => ({ success: true }),
  isAuthenticated: true,
  isApikeySession: false,
  error: null,
  clearError: () => { },
};

function GroupPreview() {
  return (
    <AuthContext.Provider value={galleryAuthValue}>
      <div className="gallery-real-component-frame gallery-group-page-frame">
        <GroupPage dataSource={mockGroupDataSource} />
      </div>
    </AuthContext.Provider>
  );
}

function SettingsPreview() {
  const [density, setDensity] = useState<"comfortable" | "compact">("comfortable");
  const [reducedMotion, setReducedMotion] = useState(false);
  const [previewTheme, setPreviewTheme] = useState<"light" | "dark">(() => document.documentElement.dataset.colorMode === "dark" ? "dark" : "light");
  return <div className="settings-page gallery-contained-page">
    <header className="settings-page__heading"><div className="settings-page__heading-icon"><FaCog /></div><div><h1>Settings</h1><p>Customize your workspace and how the interface behaves.</p></div></header>
    <section className="settings-page__section"><div className="settings-page__section-title"><span className="settings-page__section-icon"><FaGlobe /></span><div><h2>Platform</h2><p>Choose a social network and manage its connection.</p></div></div><PlatformGridPreview /></section>
    <section className="settings-page__section"><div className="settings-page__section-title"><span className="settings-page__section-icon"><FaCog /></span><div><h2>Appearance</h2><p>Choose a comfortable layout for your workflow.</p></div></div><div className="settings-page__setting"><div className="settings-page__description"><strong>Color mode</strong><span>Choose Light or Dark.</span></div><div className="settings-page__segmented" role="group" aria-label="Preview color mode"><button type="button" className={previewTheme === "light" ? "selected" : ""} onClick={() => { setPreviewTheme("light"); document.documentElement.dataset.colorMode = "light"; }}>Light</button><button type="button" className={previewTheme === "dark" ? "selected" : ""} onClick={() => { setPreviewTheme("dark"); document.documentElement.dataset.colorMode = "dark"; }}>Dark</button></div></div><div className="gallery-inline"><label><input type="radio" name="gallery-density" checked={density === "comfortable"} onChange={() => setDensity("comfortable")} /> Comfortable</label><label><input type="radio" name="gallery-density" checked={density === "compact"} onChange={() => setDensity("compact")} /> Compact</label></div></section>
    <section className="settings-page__section"><div className="settings-page__section-title"><span className="settings-page__section-icon"><FaCog /></span><div><h2>Behavior</h2><p>Motion preferences</p></div></div><label><input type="checkbox" checked={reducedMotion} onChange={(e) => setReducedMotion(e.target.checked)} /> Reduce motion</label></section>
    <p className="gallery-demo-output">Preview only · preferences are not persisted.</p>
  </div>;
}

function GalleryFiltersDemo() {
  const { t } = useTranslation();
  const [query, setQuery] = useState("");
  const [platforms, setPlatforms] = useState<string[]>([]);
  const [types, setTypes] = useState<string[]>([]);
  return <div className="gallery-stack"><SearchInput id="gallery-group-search" value={query} onChange={setQuery} placeholder={t("searchGroups")} />
    <div className="gallery-inline"><MultiSelectFilter label={t("platform")} options={localizeOptions(PLATFORM_OPTIONS, t)} selectedValues={platforms} onChange={setPlatforms} /><MultiSelectFilter label={t("groupType")} options={localizeOptions(FB_GROUP_TYPE, t)} selectedValues={types} onChange={setTypes} /></div>
    <small>Search: {query || "(empty)"} · Platforms: {platforms.join(", ") || "all"} · Types: {types.join(", ") || "all"}</small>
  </div>;
}

function EvidenStudioDemo() {
  const [selectedCase, setSelectedCase] = useState<ProfileCase>(demoCases[0]);
  const [isOpen, setIsOpen] = useState(true);
  const [, setFilter] = useState<CaseFilter>({ search: "", offset: 0, limit: 10 });

  return (
    <div className="gallery-eviden-real-shell">
      <CaseSidebar
        defaultCase={demoCaseDefault}
        profileCases={demoProfileCases}
        selectedCase={selectedCase}
        onSelect={setSelectedCase}
        isOpen={isOpen}
        onToggle={() => setIsOpen((value) => !value)}
        setFilter={setFilter}
      />
      <div className="gallery-eviden-real-detail">
        <CaseDetail
          selectedCase={selectedCase}
          setDefaultCase={setSelectedCase}
          sidebarOpen={isOpen}
          onOpenSidebar={() => setIsOpen(true)}
          onSaved={setSelectedCase}
        />
      </div>
    </div>
  );
}

function CaseSidebarDemo() {
  const [selectedCase, setSelectedCase] = useState<ProfileCase>(demoCases[0]);
  const [isOpen, setIsOpen] = useState(true);
  const [filter, setFilter] = useState<CaseFilter>({ search: "", offset: 0, limit: 10 });

  return (
    <div className="gallery-case-sidebar-frame">
      <CaseSidebar
        defaultCase={demoCaseDefault}
        profileCases={demoProfileCases}
        selectedCase={selectedCase}
        onSelect={setSelectedCase}
        isOpen={isOpen}
        onToggle={() => setIsOpen((v) => !v)}
        setFilter={setFilter}
      />
      <div className="gallery-case-sidebar-demo-info">
        <strong>Selected</strong>
        <span>{selectedCase.name}</span>
        <small>Filter: {filter.search || "(none)"}</small>
        {!isOpen && <button onClick={() => setIsOpen(true)}>Open sidebar</button>}
      </div>
    </div>
  );
}

function CaseSidebarItemDemo() {
  const [selectedId, setSelectedId] = useState(demoCases[0].id);

  return (
    <ul className="gallery-case-item-list">
      {demoCases.map((profileCase) => (
        <CaseSidebarItem
          key={profileCase.id}
          profileCase={profileCase}
          isSelected={selectedId === profileCase.id}
          onSelect={(value) => setSelectedId(value.id)}
          platformIcon={PLATFORMS.find((p) => p.id === profileCase.platform)?.icon}
        />
      ))}
    </ul>
  );
}

function CaseDetailDemo() {
  const [selectedCase, setSelectedCase] = useState<ProfileCase>(demoCases[0]);
  const [sidebarOpen, setSidebarOpen] = useState(false);

  return (
    <div className="gallery-case-detail-frame">
      <CaseDetail
        selectedCase={selectedCase}
        setDefaultCase={setSelectedCase}
        sidebarOpen={sidebarOpen}
        onOpenSidebar={() => setSidebarOpen(true)}
        onSaved={(updated) => setSelectedCase(updated)}
      />
    </div>
  );
}

function GalleryStorageSeed({ children }: { children: React.ReactNode }) {
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const now = Date.now();
    const tasks: Task[] = [
      { taskId: "task-1001", activityId: "activity-1", activityName: "Facebook engagement", platform: "facebook", priority: 2, state: "running", tabId: 7, createdTime: now - 120000, startTime: now - 90000 },
      { taskId: "task-1002", activityId: "activity-2", activityName: "Group scrolling", platform: "facebook", priority: 1, state: "pending", createdTime: now - 60000 },
      { taskId: "task-1003", activityId: "activity-3", activityName: "Profile sync", platform: "facebook", priority: 0, state: "finished", createdTime: now - 360000, startTime: now - 350000, endTime: now - 300000 },
    ];
    void extensionStorage.set({
      apikey: "gallery-demo-key",
      taskList: tasks,
      activities: [{ name: "SCROLL_JOINED_GROUPS", inputs: { defaultFeedGroupUrls: ["https://facebook.com/groups/demo-1", "https://facebook.com/groups/demo-2"] } }],
      automationByUser: true,
    }).finally(() => setReady(true));
  }, []);

  return ready ? <>{children}</> : <div className="gallery-demo-loading">Preparing mock extension state…</div>;
}

function BottomNavDemo() {
  const [active, setActive] = useState<MainTab>("automation");
  return (
    <GalleryStorageSeed>
      <div className="gallery-bottom-nav-frame">
        <BottomNav activeTab={active} onTabChange={setActive} />
      </div>
    </GalleryStorageSeed>
  );
}

function SidebarMenuDemo() {
  const [open, setOpen] = useState(true);
  const [activePage, setActivePage] = useState("config");
  return (
    <div className="gallery-sidebar-menu-frame">
      {!open && <button className="button" onClick={() => setOpen(true)}>Open menu</button>}
      <SidebarMenu
        isOpen={open}
        onClose={() => setOpen(false)}
        onNavigate={(view) => { setActivePage(view); setOpen(true); }}
        showMonitor
        showSwitchPersona
        showSwitchPlatform
        onSwitchPlatform={() => setActivePage("platform")}
        activePage={activePage}
        platform="facebook"
      />
    </div>
  );
}

function TaskMonitorDemo() {
  return <GalleryStorageSeed><TaskMonitorTab /></GalleryStorageSeed>;
}

function TaskPriorityBadgesDemo() {
  return (
    <div className="gallery-priority-badges">
      <TaskPriorityBadge priority={2} />
      <TaskPriorityBadge priority={1} />
      <TaskPriorityBadge priority={0} />
    </div>
  );
}

function TaskStatusBadgesDemo() {
  return (
    <div className="gallery-task-status-badges">
      <TaskStatusBadge status="running" />
      <TaskStatusBadge status="pending" />
      <TaskStatusBadge status="finished" />
    </div>
  );
}

const demoImageDataUrl = `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(`
  <svg xmlns="http://www.w3.org/2000/svg" width="900" height="520">
    <defs><linearGradient id="g" x1="0" x2="1"><stop stop-color="#e8eef8"/><stop offset="1" stop-color="#cbd5e1"/></linearGradient></defs>
    <rect width="100%" height="100%" fill="url(#g)"/>
    <rect x="80" y="80" width="740" height="360" rx="24" fill="white" opacity="0.95"/>
    <text x="450" y="245" text-anchor="middle" font-family="Arial" font-size="34" fill="#334155">Eviden screenshot preview</text>
    <text x="450" y="295" text-anchor="middle" font-family="Arial" font-size="20" fill="#64748b">Real ImageDetailModal component</text>
  </svg>`)} `;

function ImageDetailModalDemo() {
  const item: ImageItem = { kind: "pending", dataUrl: demoImageDataUrl.trim(), timestamp: Date.now() };
  const [meta, setMeta] = useState<ImageMeta>({ name: "Profile screenshot", description: "Mock screenshot metadata for CSS editing.", capture_time: Date.now() - 60000, capacity: 145920 });
  const [open, setOpen] = useState(true);

  return (
    <div className="gallery-modal-host">
      {!open && <button className="button" onClick={() => setOpen(true)}>Open ImageDetailModal</button>}
      {open && (
        <ImageDetailModal
          item={item}
          meta={meta}
          onMetaChange={(_key, patch) => setMeta((current) => ({ ...current, ...patch }))}
          onClose={() => setOpen(false)}
        />
      )}
    </div>
  );
}

function ConfirmModalDemo() {
  const [open, setOpen] = useState(true);
  const [busy, setBusy] = useState(false);
  return (
    <div className="gallery-modal-host">
      {!open && <button className="button" onClick={() => setOpen(true)}>Open ConfirmModal</button>}
      <ConfirmModal
        open={open}
        title="Confirm action"
        message={<>This is the <strong>real ConfirmModal</strong> rendered with mock gallery state.</>}
        confirmLabel="Apply"
        busy={busy}
        onCancel={() => setOpen(false)}
        onConfirm={() => { setBusy(true); window.setTimeout(() => { setBusy(false); setOpen(false); }, 500); }}
      />
    </div>
  );
}

export default function StyleGallery() {
  const { language, t } = useTranslation();
  const [galleryTheme, setGalleryTheme] = useState<"light" | "dark">(() => document.documentElement.dataset.colorMode === "dark" ? "dark" : "light");
  const chooseTheme = (theme: "light" | "dark") => {
    setGalleryTheme(theme);
    document.documentElement.dataset.colorMode = theme;
    document.documentElement.style.colorScheme = theme;
    try {
      const current = JSON.parse(localStorage.getItem("hydra:ui-preferences") || "{}");
      localStorage.setItem("hydra:ui-preferences", JSON.stringify({ ...current, theme }));
    } catch { /* Preview remains usable when storage is unavailable. */ }
  };
  const chooseLanguage = (value: AppLanguage) => setLanguage(value);
  const [activeTab, setActiveTab] = useState("config");
  const [selectedPersona, setSelectedPersona] = useState(false);
  const [query, setQuery] = useState("");
  const filtered = useMemo(() => entries.filter((x) => x.toLowerCase().includes(query.toLowerCase())), [query]);
  const slug = (name: string) => {
    const ids: Record<string, string> = {
      "App shell / Navigation": "app-shell-navigation", "Task Priority Badges": "taskprioritybadges",
      "Task Status Badges": "taskstatusbadges", "FacebookLoginMode": "switchplatform",
      "PlatformSelect": "switchplatform", "SwitchPlatform": "switchplatform",
    };
    return ids[name] ?? name.toLowerCase().replace(/[^a-z0-9]+/g, "").replace(/^-|-$/g, "");
  };

  return (
    <div className="style-gallery">
      <aside className="style-gallery__sidebar">
        <div className="style-gallery__brand">UI Style Gallery</div>
        <div className="gallery-preferences" aria-label="Gallery preferences">
          <div className="gallery-preferences__group">
            <span className="gallery-preferences__label">Mode</span>
            <div className="gallery-preferences__options" role="group" aria-label="Gallery color mode">
              <button type="button" className={galleryTheme === "light" ? "is-active" : ""} aria-pressed={galleryTheme === "light"} onClick={() => chooseTheme("light")}>☀ Light</button>
              <button type="button" className={galleryTheme === "dark" ? "is-active" : ""} aria-pressed={galleryTheme === "dark"} onClick={() => chooseTheme("dark")}>☾ Dark</button>
            </div>
          </div>
          <div className="gallery-preferences__group">
            <span className="gallery-preferences__label">Language</span>
            <div className="gallery-preferences__options" role="group" aria-label="Gallery language">
              <button type="button" lang="en" className={language === "en" ? "is-active" : ""} aria-pressed={language === "en"} onClick={() => chooseLanguage("en")}>English</button>
              <button type="button" lang="vi" className={language === "vi" ? "is-active" : ""} aria-pressed={language === "vi"} onClick={() => chooseLanguage("vi")}>Tiếng Việt</button>
            </div>
          </div>
        </div>
        <p className="style-gallery__hint">Edit files under <code>entrypoints/sidepanel/css</code>. Vite updates this page instantly.</p>
        <input className="style-gallery__search" value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Find page/component..." />
        <nav className="style-gallery__nav">
          {filtered.map((name) => <a key={name} href={`#${slug(name)}`}>{name}</a>)}
        </nav>
        <a className="style-gallery__back" href="/">Open normal app</a>
      </aside>

      <main className="style-gallery__main">
        <header className="style-gallery__header">
          <div><h1>Sidepanel CSS Playground</h1><p>All major pages and reusable UI pieces in one scrollable development screen.</p></div>
          <code>?gallery=1</code>
        </header>

        <h2 className="style-gallery__section-title">Pages</h2>
        <Preview id="app-shell-navigation" title="App shell / Navigation" file="assets/css/layout/navigation-shell.css">
          <div className="modern-navigation gallery-normal-width"><div className="nav-content"><div className="user-profile"><div className="user-avatar"><FaUser /></div><div className="user-info"><span className="user-greeting">{t("greeting")},</span><span className="user-name-display">Alex</span></div></div><div className="nav-actions"><button className="modern-monitoring-btn"><FaCog /></button></div></div></div>
        </Preview>
        <Preview id="dashboardpage" title="DashboardPage (real page, fixed mock stats)" file="pages/dashboard/DashboardPage.tsx"><div className="gallery-real-component-frame"><DashboardPage /></div></Preview>
        <Preview id="settingspage" title="SettingsPage (isolated visual preview)" file="pages/settings/SettingsPage.tsx"><SettingsPreview /></Preview>
        <Preview id="workspacepageheader" title="WorkspacePageHeader (real component)" file="components/WorkspacePageHeader.tsx"><WorkspacePageHeader eyebrow="WORKSPACE / GROUPS" title="Group management" description="Search and manage your assigned groups." badge="Preview" /></Preview>
        <Preview id="login" title="Login (representative; auth-bound page)" file="pages/login/Login.tsx"><LoginPreview /></Preview>
        <Preview id="switchplatform" title="SwitchPlatform styling (real PlatformSelect child)" file="pages/SwitchPlatform.tsx"><PlatformGridPreview /></Preview>
        <Preview id="selectpersona" title="SelectPersona styling (real PersonaCard children)" file="pages/persona/SelectPersona.tsx"><div className="persona-page gallery-contained-page"><div className="persona-panel"><div className="persona-panel__header"><div className="persona-panel__title">Select persona</div><div className="persona-panel__subtitle">Choose an identity</div></div><div className="persona-panel__list"><PersonaCard persona={persona} selected={selectedPersona} onSelect={() => setSelectedPersona(!selectedPersona)} /><PersonaCard persona={{ ...persona, id: "demo-two", first_name: "Taylor", last_name: "Smith", gender: "female", status: "inactive", country: "United States" }} selected={!selectedPersona} onSelect={() => setSelectedPersona(false)} /></div><div className="persona-panel__footer"><button className="persona-primary-btn">Continue</button></div></div></div></Preview>
        <Preview id="switchpersona" title="SwitchPersona styling (real PersonaCard child)" file="pages/persona/SwitchPersona.tsx"><div className="persona-page gallery-contained-page"><div className="persona-panel"><div className="persona-panel__header"><div className="persona-panel__title">Switch persona</div><div className="persona-panel__subtitle">Current session preview</div></div><PersonaCard persona={persona} selected onSelect={() => { }} /></div></div></Preview>
        <Preview id="automationpage" title="Automation configuration (real AutomationTab)" file="components/AutomationTab.tsx"><AutomationTabDemo /></Preview>
        <Preview id="grouppage" title="GroupPage (real component + mock data)" file="pages/groups/GroupPage.tsx"><GroupPreview /></Preview>
        <Preview id="evidenstudio" title="EvidenStudio (real CaseSidebar + CaseDetail)" file="pages/eviden-studio/index.tsx"><EvidenStudioDemo /></Preview>

        <h2 className="style-gallery__section-title">Icon system</h2>
        <Preview id="iconlibrary" title="Icon Library (shared Lucide outline + brand marks)" file="icons/index.tsx">
          <div className="gallery-icon-library">
            {([
              ["Dashboard", <FaRobot />], ["Settings", <FaCog />], ["User", <FaUser />],
              ["Search", <FaSearch />], ["Add", <FaPlus />], ["Success", <FaCheckCircle />],
              ["Error", <FaTimesCircle />], ["Warning", <FaExclamationTriangle />],
              ["Refresh", <FaSyncAlt />], ["Filter", <FiFilter />], ["Copy", <FiCopy />],
              ["External link", <FiExternalLink />], ["Folder", <FaFolder />],
              ["Clock", <FaClock />], ["Next", <FaArrowRight />], ["Expand", <FaChevronDown />],
              ["Security", <FaShieldAlt />], ["Layers", <FiLayers />], ["List", <FiList />],
              ["Facebook (brand)", <FaFacebook />],
            ] as const).map(([label, icon]) => (
              <div className="gallery-icon-library__item" key={label}>
                <span className="gallery-icon-library__symbol">{icon}</span>
                <span>{label}</span>
              </div>
            ))}
          </div>
        </Preview>

        <h2 className="style-gallery__section-title">Navigation & shell components</h2>
        <Preview id="toptabs" title="TopTabs" file="assets/css/layout/bottom-top-nav.css"><TopTabs tabs={[{ id: "config", label: "Config", count: 12 }, { id: "monitor", label: "Monitor", count: 0 }]} activeTab={activeTab} onTabChange={setActiveTab} /></Preview>
        <Preview id="bottomnav" title="BottomNav" file="components/Nav/BottomNav.tsx"><BottomNavDemo /></Preview>
        <Preview id="platformmetabar" title="PlatformMetaBar" file="assets/css/features/platform.css"><PlatformMetaBar platformLabel="Facebook" /></Preview>
        <Preview id="sidebarmenu" title="SidebarMenu" file="components/Sidebar/SidebarMenu.tsx"><SidebarMenuDemo /></Preview>
        <Preview id="sidebaritem" title="SidebarItem" file="assets/css/components/Sidebar.css"><SidebarItem icon={<FaRobot />} label="Automation" active onClick={() => { }} sidebarCollapsed={false} /></Preview>
        <Preview id="sidebarchilditem" title="SidebarChildItem" file="assets/css/components/Sidebar.css"><SidebarChildItem icon={<FaCog />} label="Configuration" active onClick={() => { }} /></Preview>

        <h2 className="style-gallery__section-title">Automation & editor components</h2>
        <Preview id="automationtab" title="AutomationTab" file="components/AutomationTab.tsx"><AutomationTabDemo /></Preview>
        <Preview id="taskmonitortab" title="TaskMonitorTab" file="components/Automation/TaskMonitorTab.tsx"><TaskMonitorDemo /></Preview>
        <Preview id="taskprioritybadges" title="Task Priority Badges" file="components/Automation/TaskPriorityBadge.tsx"><TaskPriorityBadgesDemo /></Preview>
        <Preview id="taskstatusbadges" title="Task Status Badges" file="components/Automation/TaskStatusBadge.tsx"><TaskStatusBadgesDemo /></Preview>
        <Preview id="searchinput" title="SearchInput (real component)" file="components/ui/SearchInput.tsx"><GalleryFiltersDemo /></Preview>
        <Preview id="multiselectfilter" title="MultiSelectFilter (real component)" file="components/ui/MultiSelectFilter.tsx"><GalleryFiltersDemo /></Preview>
        <Preview id="groupstatusbadges" title="GroupPage — Membership Status Badges" file="assets/css/features/groups.css">
          <div className="gallery-group-status-badges">
            {(["requested", "not_joined", "joined"] as InfiltrationStatus[]).map((status) => (
              <div className="gallery-group-status-badges__item" key={status}>
                <code>{status}</code>
                <span className={`group-task-card__state group-task-card__state--${status}`}>
                  {infiltrationLabels[status]}
                </span>
              </div>
            ))}
          </div>
        </Preview>
        <Preview id="assignitem" title="AssignItem (real group row)" file="pages/groups/AssignItem.tsx"><div className="group-table-wrapper"><AssignItem {...demoGroupProfiles[0]} /><AssignItem {...demoGroupProfiles[2]} /></div></Preview>
        <Preview id="jsoneditor" title="JsonEditor" file="assets/css/components/JsonEditor.css"><JsonEditor settings={{ enabled: true, delay: 5, platform: "facebook" }} onSave={() => { }} onClose={() => { }} /></Preview>

        <h2 className="style-gallery__section-title">Persona components</h2>
        <Preview id="avatar" title="Avatar" file="assets/css/components/Persona.css"><div className="gallery-inline"><Avatar persona={persona} size={44} /><Avatar persona={persona} size={64} /></div></Preview>
        <Preview id="genderdot" title="GenderDot" file="assets/css/components/Persona.css"><div className="gallery-inline"><GenderDot gender="male" /><GenderDot gender="female" /></div></Preview>
        <Preview id="personacard" title="PersonaCard" file="assets/css/components/Persona.css"><div className="gallery-stack"><PersonaCard persona={persona} selected={false} onSelect={() => { }} /><PersonaCard persona={persona} selected onSelect={() => { }} /></div></Preview>
        <Preview id="statusbadge" title="StatusBadge" file="assets/css/components/Persona.css"><div className="gallery-inline"><StatusBadge status="active" /><StatusBadge status="inactive" /></div></Preview>
        <Preview id="statusscreen" title="StatusScreen" file="assets/css/components/Persona.css"><StatusScreen icon="✓" title="Ready" subtitle="Status screen secondary text" /></Preview>

        <h2 className="style-gallery__section-title">Eviden Studio components</h2>
        <Preview id="casesidebar" title="CaseSidebar" file="components/EvidenStudio/CaseSidebar.tsx"><CaseSidebarDemo /></Preview>
        <Preview id="casesidebaritem" title="CaseSidebarItem" file="components/EvidenStudio/CaseSidebarItem.tsx"><CaseSidebarItemDemo /></Preview>
        <Preview id="casedetail" title="CaseDetail" file="components/EvidenStudio/CaseDetail.tsx"><CaseDetailDemo /></Preview>
        <Preview id="imagedetailmodal" title="ImageDetailModal" file="components/EvidenStudio/ImageDetailModal.tsx"><ImageDetailModalDemo /></Preview>

        <h2 className="style-gallery__section-title">Modals & states</h2>
        <Preview id="confirmmodal" title="ConfirmModal" file="components/modal/ConfirmModal.tsx"><ConfirmModalDemo /></Preview>
        <Preview id="comingsoon" title="ComingSoon" file="Tailwind utility classes"><div className="gallery-state-box"><ComingSoon icon={FaRobot} /></div></Preview>
        <Preview id="unsupportedplatform" title="UnsupportedPlatform" file="Tailwind utility classes"><div className="gallery-state-box"><UnsupportedPlatform /></div></Preview>

        <footer className="style-gallery__footer">CSS Gallery · edit <code>entrypoints/sidepanel/css/</code> and save to see changes.</footer>
      </main>
    </div>
  );
}
