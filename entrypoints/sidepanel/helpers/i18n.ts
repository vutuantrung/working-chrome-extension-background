import { useSyncExternalStore } from "react";

export type AppLanguage = "en" | "vi";
const STORAGE_KEY = "hydra:ui-preferences";
const EVENT = "hydra:language-changed";

export function getLanguage(): AppLanguage {
  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) || "{}");
    return saved.language === "vi" ? "vi" : "en";
  } catch {
    return "en";
  }
}

export function setLanguage(language: AppLanguage) {
  try {
    const old = JSON.parse(localStorage.getItem(STORAGE_KEY) || "{}");
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ ...old, language }));
  } catch { /* Storage unavailable: still update the active UI */ }
  document.documentElement.lang = language;
  window.dispatchEvent(new Event(EVENT));
}

const dictionary = {
  en: {
    platformFacebook: "Facebook", platformYoutube: "YouTube", platformTiktok: "TikTok", platformThreads: "Threads", platformTelegram: "Telegram", platformTwitter: "Twitter", platformDiscord: "Discord", platformX: "X (Twitter)",
    configTab: "Configuration", monitorTab: "Monitor", reviewedStatus: "Reviewed", assignedStatus: "Assigned",
    caseLibrary: "Case library", totalCases: "total", creatingCase: "Creating…", savingCase: "Saving…", createCaseAction: "Create case", saveChanges: "Save changes", caseSaved: "Saved", addScreenshotAction: "Add screenshot",
    personaSwitchLead: "You are about to switch to", personaSwitchBody: "This will apply proxy settings for the new persona. With system-account login, the extension will sign in using that persona’s account for the current platform. With your own account, the platform cookies will be cleared to avoid mixing sessions, and you can sign in again. Security checkpoints may occur.", personaInfoLoading: "Loading persona info…",
    scheduledTasks: "Scheduled Tasks", success: "Success!", failedNotice: "Failed!", every: "Every", unnamedTask: "Unnamed Task",
    confirm: "Confirm", applying: "Applying…", close: "Close", current: "CURRENT", currentPlatform: "current platform", items: "items", subNavigation: "Sub navigation",
    priorityUrgent: "Urgent", priorityHigh: "High", priorityMedium: "Medium", priorityLow: "Low", unknown: "Unknown", taskFinished: "Finished", select: "Select", deselect: "Deselect", unnamedPersona: "Unnamed persona",
    loading: "Loading…",
    imageName: "Name", imageDescription: "Description", imageNamePlaceholder: "Enter image name…", imageDescriptionPlaceholder: "Add a description…", imageClose: "Close image details", screenshot: "Screenshot", imageAddName: "Add name…", imageEditName: "Click to edit name", imageDiscard: "Discard", imageUndoRemoval: "Undo removal", undo: "Undo", remove: "Remove", jsonPlaceholder: "Paste your JSON here...", invalidJson: "Invalid JSON format", save: "Save", editText: "Edit Text", tab: "Tab", groupsScrolled: "Groups scrolled", feedsScrolled: "Feeds scrolled",
    evidenceEyebrow: "WORKSPACE / EVIDENCE", evidenceTitle: "Eviden Studio", evidenceDescription: "Organize evidence, manage cases, and review captured content.",
    postCount: "Post Count", postCountHint: "Changes in the total number of posts over time.", timeframe: "Post count timeframe", versusPeriod: "vs. beginning of period", taskActivity: "Task activity", taskActivityHint: "Tasks performed in the last 24 hours", last24h: "Last 24h", totalTasks: "Total tasks", allExecutions: "All executions", failed: "Failed", failedTasks: "Unsuccessful tasks", canceled: "Canceled", stoppedTasks: "Stopped executions", taskDistribution: "Task distribution", recentErrors: "Recent errors", recentErrorsHint: "Most recent problems encountered during execution.", mockDisclaimer: "All metrics shown are illustrative mock data and are not connected to your account or activity logs.",
    caseSearch: "Search cases...", createCase: "Create a new case", yourCases: "YOUR CASES", noCaseMatch: "No matching cases", tryOtherSearch: "Try a different search term.", caseName: "Case name", caseOrgURL: "Origin URL", caseUrl: "Profile URL", caseNameHint: "Enter a descriptive case name", description: "Description", optional: "Optional", caseDescriptionHint: "Add context or notes about this case…", created: "Created", caseScreenshots: "Screenshots", screenshotsHint: "Manage the evidence collected for this case", noScreenshots: "No screenshots yet", addScreenshot: "Add a screenshot to start collecting evidence.", caseNavigation: "Case navigation", openCaseSidebar: "Open cases sidebar", caseInformation: "Case information", dismissError: "Dismiss error", caseSaveStatus: "Case save status",
    automationUnavailable: "Automation is not available", automationUnavailableHint: "Automation has not been enabled for this session. Once available, execution controls and scheduling will appear here.", automationControl: "Automation control", automationControlHint: "Choose whether automated activities can run for this account.", enableAutomation: "Enable automation", schedule: "Schedule", scheduleHint: "Set an optional daily time window using 24-hour time.", startTime: "Start time", endTime: "End time",
    autoRefresh: "Auto-refresh", running: "Running", pending: "Pending", completed: "Completed", total: "Total", started: "Started", duration: "Duration", taskId: "Task ID", tabId: "Tab ID", activityId: "Activity ID", queued: "Queued", finished: "Finished", result: "Result", noTasks: "No tasks yet", stopRunning: "Stop this running task", stopPending: "Stop this pending task",
    loginWelcome: "Welcome back", loginSubtitle: "Enter your account details to access your workspace.", loginUser: "Username", loginPassword: "Password", loginEnterUser: "Enter your username", loginEnterPassword: "Enter your password", loginRemember: "Remember me", loginSubmit: "Sign in", loginSigning: "Signing in...", loginProtected: "Protected sign-in", loginEyebrow: "YOUR WORKSPACE, CONNECTED", loginTagline: "One space.", loginWorkflow: "Every workflow.", loginBrandCopy: "Manage your workspace, stay organized, and get back to what matters.", loginSecure: "Secure workspace access", showPassword: "Show password", hidePassword: "Hide password", closeError: "Close error",
    chooseConnect: "Choose how to connect", chooseNetwork: "Choose a network to manage in your workspace.", chooseMethod: "Connect to {platform} using your preferred sign-in method.", step: "STEP", availableNetworks: "AVAILABLE NETWORKS", selectPlatform: "Select a platform", platformHintSafe: "Your current workspace and data will remain available when switching networks.", allPlatforms: "All platforms", selectedNetwork: "Selected network", signInMethod: "SIGN-IN METHOD", chooseOne: "Choose one option", connecting: "Connecting…", systemAccount: "System account", systemAccountHint: "Continue with the account managed by your workspace.", opening: "Opening…", personalAccount: "Personal account", personalAccountHint: "Sign in manually using your own credentials.",
    selectPersona: "Select Persona", selectPersonaHint: "Choose the persona you want to operate as", noPersonas: "No personas available.", loadingPersonas: "Loading personas…", creatingPersona: "Setting up your persona…", justMoment: "This only takes a moment", activatingPersona: "Activating persona…", continue: "Continue", activating: "Activating…", switchPersonaTitle: "Switch Persona", switchPersonaHint: "Select a persona to switch to", noOtherPersonas: "No other personas available", switchPersonaUnavailable: "Switch persona unavailable", switchPersonaUnavailableHint: "Your session uses extension config. Persona switching is unavailable while extension config is assigned.", switchingPersona: "Switching persona…", switching: "Switching…", switch: "Switch", switchConfirm: "Switch persona?", yesSwitch: "Yes, switch", cancel: "Cancel", thisPersona: "this persona",
    personaLoadError: "Failed to load personas. Please try again.", personaCreateError: "Failed to create a persona. Please try again.", personaActivateError: "Failed to activate persona. Please try again.", personaSwitchError: "Failed to switch persona. Please try again.",
    comingSoon: "Coming Soon", unsupportedPlatform: "Unsupported Platform",
    dashboardEyebrow: "WORKSPACE / OVERVIEW", dashboardDescription: "Track your content activity and recent automation performance.", automationEyebrow: "WORKSPACE / AUTOMATION", automationDescription: "Monitor execution progress, statuses, and task activity.", groupListEyebrow: "WORKSPACE / GROUPS", groupListDescription: "Track your target status and joining progress.",
    navDashboard: "Dashboard", navAutomation: "Automation", navGroup: "Groups", navEviden: "Evidence", navigation: "Main navigation", monitoring: "Monitoring", evidenceCollection: "Evidence collection", evidenceStudio: "Evidence studio", switchPlatform: "Switch platform", switchPersona: "Switch persona", expandSidebar: "Expand sidebar", collapseSidebar: "Collapse sidebar", collapse: "Collapse",
    back: "Back", settings: "Settings", preferences: "PREFERENCES", settingsHint: "Customize your workspace and how the interface behaves.",
    platform: "Platform", platformHint: "Choose a social network and manage its connection.",
    appearance: "Appearance", appearanceHint: "Choose a comfortable layout for your workflow.",
    colorMode: "Color mode", colorModeHint: "Choose a light or dark appearance across the application.",
    light: "Light", dark: "Dark", density: "Interface density", densityHint: "Control spacing within the application.",
    comfortable: "Comfortable", compact: "Compact", behavior: "Behavior", behaviorHint: "Adjust interface animations.",
    reduceMotion: "Reduce motion", reduceMotionHint: "Minimize decorative animation and transitions.",
    saved: "Preferences saved automatically", saveFailed: "Unable to save preferences in this browser",
    restore: "Restore defaults", language: "Language", languageHint: "Choose the display language for the application.",
    english: "English", vietnamese: "Vietnamese",
    tasksTitle: "Task list", searchGroups: "Search group name, ID...", channel: "Channel", groupType: "Group type",
    clearFilters: "Clear filters", all: "All", joinedFilter: "Joined", notJoinedFilter: "Not joined", requestedFilter: "Requested",
    filterStatus: "Filter task status", groupsList: "Group list", tasks: "Tasks", refresh: "Refresh data",
    loadingGroups: "Loading...", failedGroups: "Unable to load groups", noGroups: "No groups found",
    retry: "Try again", retryHint: "Try another keyword or filter.", failedGroupsHint: "Unable to load groups from server.",
    previous: "Previous page", next: "Next page", active: "Active", inactive: "Inactive",
    joined: "Joined", not_joined: "Not joined", requested: "Requested", unknownName: "Unnamed",
    private_group: "Private group", group: "Public group", profile: "Profile", fanpage: "Fanpage",
    openLink: "Open link", copyId: "Copy ID", unknownId: "Unknown ID", updated: "Updated",
    justUpdated: "just now", inFuture: "in the future", saveSetting: "Save settings", saving: "Saving", stop: "Stop", recentHistory: "Recent History", runningTasks: "Running Tasks", autoTaskAnnounce1: "Automation is allowed to run during the configured schedule.", autoTaskAnnounce2: "Automation is paused until you enable it again.", fillLeaveBlank: "Leave a field blank to use the existing default feature.", removing: "Removing", pendingSave: "Pending save", noOriginURL: "No origin URL", captured: "Captured", download: "Download", done: "Done", on: "On", off: "Off", logoutFailed: "Logout failed", restartFailed: "Restart failed", unknownChannel: "Unknown channel", open: "Open",
    login_err_no_account: "No account is linked. Please add an account first.",
    login_err_no_cookie: "This account has no saved session. Please re-authenticate.",
    login_err_cookies_invalid: "The session for this account has expired or is invalid. Please log in again.",
    login_err_unknown: "Login failed. Please contact support or try again.", greeting: "Hi"
  },
  vi: {
    platformFacebook: "Facebook", platformYoutube: "YouTube", platformTiktok: "TikTok", platformThreads: "Threads", platformTelegram: "Telegram", platformTwitter: "Twitter", platformDiscord: "Discord", platformX: "X (Twitter)",
    configTab: "Cấu hình", monitorTab: "Giám sát", reviewedStatus: "Đã rà soát", assignedStatus: "Đã phân công",
    caseLibrary: "Thư viện hồ sơ", totalCases: "tổng", creatingCase: "Đang tạo…", savingCase: "Đang lưu…", createCaseAction: "Tạo hồ sơ", saveChanges: "Lưu thay đổi", caseSaved: "Đã lưu", addScreenshotAction: "Thêm ảnh chụp",
    personaSwitchLead: "Bạn sắp chuyển sang", personaSwitchBody: "Thao tác này sẽ áp dụng proxy của nhân dạng mới. Nếu đăng nhập bằng tài khoản hệ thống, extension sẽ đăng nhập bằng tài khoản của nhân dạng đó trên nền tảng hiện tại. Nếu dùng tài khoản cá nhân, cookie của nền tảng sẽ được xóa để tránh trộn lẫn phiên đăng nhập; bạn có thể đăng nhập lại sau đó. Có thể xuất hiện bước xác minh bảo mật.", personaInfoLoading: "Đang tải thông tin nhân dạng…",
    scheduledTasks: "Tác vụ đã lên lịch", success: "Thành công!", failedNotice: "Thất bại!", every: "Mỗi", unnamedTask: "Tác vụ chưa có tên",
    confirm: "Xác nhận", applying: "Đang áp dụng…", close: "Đóng", current: "HIỆN TẠI", currentPlatform: "nền tảng hiện tại", items: "mục", subNavigation: "Điều hướng phụ",
    priorityUrgent: "Khẩn cấp", priorityHigh: "Cao", priorityMedium: "Trung bình", priorityLow: "Thấp", unknown: "Không rõ", taskFinished: "Đã hoàn thành", select: "Chọn", deselect: "Bỏ chọn", unnamedPersona: "Nhân dạng chưa có tên",
    loading: "Đang tải…",
    imageName: "Tên", imageDescription: "Mô tả", imageNamePlaceholder: "Nhập tên ảnh…", imageDescriptionPlaceholder: "Thêm mô tả…", imageClose: "Đóng chi tiết ảnh", screenshot: "Ảnh chụp", imageAddName: "Thêm tên…", imageEditName: "Nhấn để sửa tên", imageDiscard: "Bỏ thay đổi", imageUndoRemoval: "Hoàn tác xóa", undo: "Hoàn tác", remove: "Xóa", jsonPlaceholder: "Dán JSON vào đây...", invalidJson: "Định dạng JSON không hợp lệ", save: "Lưu", editText: "Sửa văn bản", tab: "Tab", groupsScrolled: "Nhóm đã cuộn", feedsScrolled: "Bảng tin đã cuộn",
    evidenceEyebrow: "KHÔNG GIAN / BẰNG CHỨNG", evidenceTitle: "Studio bằng chứng", evidenceDescription: "Sắp xếp bằng chứng, quản lý hồ sơ và xem lại nội dung đã thu thập.",
    postCount: "Số lượng bài viết", postCountHint: "Thay đổi tổng số bài viết theo thời gian.", timeframe: "Khoảng thời gian thống kê bài viết", versusPeriod: "so với đầu kỳ", taskActivity: "Hoạt động tác vụ", taskActivityHint: "Các tác vụ trong 24 giờ qua", last24h: "24 giờ qua", totalTasks: "Tổng tác vụ", allExecutions: "Tất cả lượt chạy", failed: "Thất bại", failedTasks: "Tác vụ không thành công", canceled: "Đã hủy", stoppedTasks: "Các lượt chạy đã dừng", taskDistribution: "Phân bố tác vụ", recentErrors: "Lỗi gần đây", recentErrorsHint: "Các sự cố mới nhất trong quá trình thực thi.", mockDisclaimer: "Tất cả số liệu chỉ mang tính minh họa, chưa được kết nối với tài khoản hoặc nhật ký hoạt động của bạn.",
    caseSearch: "Tìm kiếm hồ sơ...", createCase: "Tạo hồ sơ mới", yourCases: "HỒ SƠ CỦA BẠN", noCaseMatch: "Không tìm thấy hồ sơ phù hợp", tryOtherSearch: "Thử từ khóa tìm kiếm khác.", caseName: "Tên hồ sơ", caseOrgURL: "URL gốc", caseUrl: "Hồ sơ URL", caseNameHint: "Nhập tên mô tả hồ sơ", description: "Mô tả", optional: "Không bắt buộc", caseDescriptionHint: "Thêm bối cảnh hoặc ghi chú cho hồ sơ…", created: "Đã tạo", caseScreenshots: "Ảnh chụp", screenshotsHint: "Quản lý bằng chứng đã thu thập cho hồ sơ", noScreenshots: "Chưa có ảnh chụp", addScreenshot: "Thêm ảnh chụp để bắt đầu thu thập bằng chứng.", caseNavigation: "Điều hướng hồ sơ", openCaseSidebar: "Mở danh sách hồ sơ", caseInformation: "Thông tin hồ sơ", dismissError: "Đóng thông báo lỗi", caseSaveStatus: "Trạng thái lưu hồ sơ",
    automationUnavailable: "Tự động hóa chưa khả dụng", automationUnavailableHint: "Tự động hóa chưa được bật cho phiên này. Khi khả dụng, các điều khiển và lịch thực thi sẽ xuất hiện.", automationControl: "Điều khiển tự động hóa", automationControlHint: "Chọn có cho phép các hoạt động tự động chạy với tài khoản này hay không.", enableAutomation: "Bật tự động hóa", schedule: "Lịch chạy", scheduleHint: "Đặt khoảng thời gian chạy hằng ngày theo định dạng 24 giờ.", startTime: "Giờ bắt đầu", endTime: "Giờ kết thúc",
    autoRefresh: "Tự động làm mới", running: "Đang chạy", pending: "Đang chờ", completed: "Hoàn thành", total: "Tổng", started: "Bắt đầu", duration: "Thời lượng", taskId: "ID tác vụ", tabId: "ID tab", activityId: "ID hoạt động", queued: "Vào hàng đợi", finished: "Đã xong", result: "Kết quả", noTasks: "Chưa có tác vụ", stopRunning: "Dừng tác vụ đang chạy", stopPending: "Dừng tác vụ đang chờ",
    loginWelcome: "Chào mừng trở lại", loginSubtitle: "Nhập thông tin tài khoản để truy cập không gian làm việc.", loginUser: "Tên đăng nhập", loginPassword: "Mật khẩu", loginEnterUser: "Nhập tên đăng nhập", loginEnterPassword: "Nhập mật khẩu", loginRemember: "Ghi nhớ tôi", loginSubmit: "Đăng nhập", loginSigning: "Đang đăng nhập...", loginProtected: "Đăng nhập an toàn", loginEyebrow: "KHÔNG GIAN LÀM VIỆC KẾT NỐI", loginTagline: "Một không gian.", loginWorkflow: "Mọi quy trình.", loginBrandCopy: "Quản lý công việc, luôn ngăn nắp và tập trung vào điều quan trọng.", loginSecure: "Truy cập bảo mật", showPassword: "Hiện mật khẩu", hidePassword: "Ẩn mật khẩu", closeError: "Đóng thông báo lỗi",
    chooseConnect: "Chọn phương thức kết nối", chooseNetwork: "Chọn mạng xã hội để quản lý trong không gian làm việc.", chooseMethod: "Kết nối với {platform} bằng phương thức đăng nhập phù hợp.", step: "BƯỚC", availableNetworks: "CÁC MẠNG XÃ HỘI", selectPlatform: "Chọn nền tảng", platformHintSafe: "Dữ liệu và không gian làm việc của bạn vẫn được giữ khi đổi nền tảng.", allPlatforms: "Tất cả nền tảng", selectedNetwork: "Nền tảng đã chọn", signInMethod: "PHƯƠNG THỨC ĐĂNG NHẬP", chooseOne: "Chọn một phương thức", connecting: "Đang kết nối…", systemAccount: "Tài khoản hệ thống", systemAccountHint: "Tiếp tục với tài khoản do không gian làm việc quản lý.", opening: "Đang mở…", personalAccount: "Tài khoản cá nhân", personalAccountHint: "Đăng nhập thủ công bằng tài khoản riêng.",
    selectPersona: "Chọn nhân dạng", selectPersonaHint: "Chọn nhân dạng bạn muốn sử dụng", noPersonas: "Không có nhân dạng nào.", loadingPersonas: "Đang tải nhân dạng…", creatingPersona: "Đang tạo nhân dạng…", justMoment: "Quá trình này chỉ mất ít phút", activatingPersona: "Đang kích hoạt nhân dạng…", continue: "Tiếp tục", activating: "Đang kích hoạt…", switchPersonaTitle: "Chuyển nhân dạng", switchPersonaHint: "Chọn nhân dạng muốn chuyển đến", noOtherPersonas: "Không có nhân dạng khác", switchPersonaUnavailable: "Không thể chuyển nhân dạng", switchPersonaUnavailableHint: "Phiên hiện tại dùng extension config; không thể chuyển nhân dạng khi cấu hình này đang được gán.", switchingPersona: "Đang chuyển nhân dạng…", switching: "Đang chuyển…", switch: "Chuyển", switchConfirm: "Chuyển nhân dạng?", yesSwitch: "Có, chuyển", cancel: "Hủy", thisPersona: "nhân dạng này",
    personaLoadError: "Không thể tải nhân dạng. Vui lòng thử lại.", personaCreateError: "Không thể tạo nhân dạng. Vui lòng thử lại.", personaActivateError: "Không thể kích hoạt nhân dạng. Vui lòng thử lại.", personaSwitchError: "Không thể chuyển nhân dạng. Vui lòng thử lại.",
    comingSoon: "Sắp ra mắt", unsupportedPlatform: "Nền tảng chưa được hỗ trợ",
    dashboardEyebrow: "KHÔNG GIAN / TỔNG QUAN", dashboardDescription: "Theo dõi hoạt động nội dung và hiệu suất tự động hóa gần đây.", automationEyebrow: "KHÔNG GIAN / TỰ ĐỘNG HÓA", automationDescription: "Theo dõi tiến độ, trạng thái và hoạt động tác vụ.", groupListEyebrow: "KHÔNG GIAN / NHÓM THEO DÕI", groupListDescription: "Theo dõi tình trạng của đối tượng và quá trình thâm nhập.",
    navDashboard: "Tổng quan", navAutomation: "Tự động hóa", navGroup: "Hội nhóm", navEviden: "Bằng chứng", navigation: "Điều hướng chính", monitoring: "Giám sát", evidenceCollection: "Bộ sưu tập bằng chứng", evidenceStudio: "Studio bằng chứng", switchPlatform: "Chuyển nền tảng", switchPersona: "Chuyển nhân dạng", expandSidebar: "Mở rộng menu", collapseSidebar: "Thu gọn menu", collapse: "Thu gọn",
    back: "Quay lại", settings: "Cài đặt", preferences: "TÙY CHỌN", settingsHint: "Tùy chỉnh không gian làm việc và giao diện ứng dụng.",
    platform: "Nền tảng", platformHint: "Chọn mạng xã hội và quản lý kết nối.",
    appearance: "Giao diện", appearanceHint: "Chọn cách hiển thị phù hợp với bạn.",
    colorMode: "Chế độ màu", colorModeHint: "Chọn giao diện sáng hoặc tối cho ứng dụng.",
    light: "Sáng", dark: "Tối", density: "Mật độ giao diện", densityHint: "Điều chỉnh khoảng cách các thành phần.",
    comfortable: "Thoải mái", compact: "Gọn", behavior: "Hành vi", behaviorHint: "Điều chỉnh hiệu ứng giao diện.",
    reduceMotion: "Giảm chuyển động", reduceMotionHint: "Giảm các hiệu ứng và chuyển cảnh không cần thiết.",
    saved: "Đã tự động lưu tùy chọn", saveFailed: "Không thể lưu tùy chọn trong trình duyệt",
    restore: "Khôi phục mặc định", language: "Ngôn ngữ", languageHint: "Chọn ngôn ngữ hiển thị cho ứng dụng.",
    english: "Tiếng Anh", vietnamese: "Tiếng Việt",
    tasksTitle: "Danh sách nhiệm vụ", searchGroups: "Tìm kiếm tên nhóm, ID...", channel: "Kênh", groupType: "Loại nhóm",
    clearFilters: "Xóa các bộ lọc", all: "Tất cả", joinedFilter: "Đã thâm nhập", notJoinedFilter: "Chưa thâm nhập", requestedFilter: "Đã gửi yêu cầu",
    filterStatus: "Lọc trạng thái nhiệm vụ", groupsList: "Danh sách nhóm", tasks: "Nhiệm vụ", refresh: "Làm mới dữ liệu",
    loadingGroups: "Đang tải danh sách...", failedGroups: "Không thể tải danh sách", noGroups: "Không tìm thấy hội nhóm",
    retry: "Thử lại", retryHint: "Thử thay đổi từ khóa hoặc bộ lọc.", failedGroupsHint: "Không thể tải danh sách hội nhóm từ máy chủ.",
    previous: "Trang trước", next: "Trang sau", active: "Đang hoạt động", inactive: "Không hoạt động",
    joined: "Đã thâm nhập", not_joined: "Chưa thâm nhập", requested: "Đã gửi yêu cầu", unknownName: "Không có tên",
    private_group: "Nhóm riêng tư", group: "Nhóm công khai", profile: "Trang cá nhân", fanpage: "Fanpage",
    openLink: "Mở liên kết", copyId: "Sao chép ID", unknownId: "Không rõ ID", updated: "Cập nhật",
    justUpdated: "vừa cập nhật", inFuture: "trong tương lai", saveSetting: "Lưu cài đặt", saving: "Đang lưu", stop: "Dừng", recentHistory: "Lịch sử gần đây", runningTasks: "Tiến trình đang chạy", autoTaskAnnounce1: "Chu trình tự động hóa được cho phép trong thời gian được thiết lập.", autoTaskAnnounce2: "Chu trình tự động hóa đang bị tạm dừng cho đến khi được bật trở lại.", fillLeaveBlank: "Hãy để trống để sử dụng tính năng mặc định.", removing: "Đang loại bỏ", pendingSave: "Đang chờ lưu", noOriginURL: "Không có URL gốc", captured: "Đã chụp", download: "Tải về", done: "Hoàn tất", on: "Bật", off: "Tắt", logoutFailed: "Đăng xuất thất bại", "restartFailed": "Khởi động lại thất bại", unknownChannel: "Không rõ kênh", open: "Mở",
    login_err_no_account: "Không có tài khoản nào được liên kết. Vui lòng thêm tài khoản trước.",
    login_err_no_cookie: "Tài khoản này không có phiên đăng nhập đã lưu. Vui lòng xác thực lại.",
    login_err_cookies_invalid: "Phiên đăng nhập cho tài khoản này đã hết hạn hoặc không hợp lệ. Vui lòng đăng nhập lại.",
    login_err_unknown: "Đăng nhập thất bại. Vui lòng liên hệ hỗ trợ hoặc thử lại.", greeting: "Xin chào"

  }
}

export type TranslationKey = keyof typeof dictionary.en;
export function translate(language: AppLanguage, key: TranslationKey): string {
  return dictionary[language][key];
}
const subscribe = (callback: () => void) => {
  window.addEventListener(EVENT, callback);
  window.addEventListener("storage", callback);
  return () => { window.removeEventListener(EVENT, callback); window.removeEventListener("storage", callback); };
};
export function useTranslation() {
  const language = useSyncExternalStore(subscribe, getLanguage, () => "en" as AppLanguage);
  return { language, t: (key: TranslationKey) => translate(language, key) };
}
