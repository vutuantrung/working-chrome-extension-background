import "../../assets/css/features/automation.css";
import WorkspacePageHeader from "../../components/WorkspacePageHeader";
import { useTranslation } from "../../helpers/i18n";
import { useState, useEffect } from "react";
import AutomationTab from "../../components/AutomationTab";
import JsonEditor from "../../components/JsonEditor";
import TaskMonitorTab from "../../components/Automation/TaskMonitorTab";
import { updateExtensionSession } from "../../infrastructure/api/extension-user.api";
import {
  appStorage,
  extensionCommands,
  extensionStorage as storageService,
} from "../../../sidepanel/application/services/SidepanelServices";
import { AutomationSubTab } from "../../types/types";
import TopTabs from "../../components/TopTabs";
import { AUTOMATION_TABS, localizeOptions } from "../../helpers/constants";

interface AutomationPageProps {
  activeView: AutomationSubTab;
  setActiveSubTab: (tab: AutomationSubTab) => void;
}

function AutomationPage({ activeView, setActiveSubTab }: AutomationPageProps) {
  const { t } = useTranslation();
  const [showJsonEditor, setShowJsonEditor] = useState(false);
  const [settings, setSettings] = useState<any>(null);
  const [taskList, setTaskList] = useState<any[]>([]);
  const [userInfo, setUserInfo] = useState<any>(null);
  const [notification, setNotification] = useState<"success" | "failed" | null>(null);

  useEffect(() => {
    const timer = setTimeout(() => {
      loadSettings();
      loadUserInfo();
      loadTaskList();
    }, 300);

    // Listen for storage changes to keep UI in sync
    const handleStorageChange = (changes: any, areaName: string) => {
      if (areaName === "local" && changes.settings) {
        const newSettings = changes.settings.newValue;
        if (newSettings) {
          setSettings(newSettings);
        }
      }
      if (areaName === "local" && changes.taskList) {
        const newTaskList = changes.taskList.newValue;
        if (newTaskList) {
          setTaskList(newTaskList);
        }
      }
    };

    const unsubscribeStorage = storageService.subscribe(handleStorageChange);

    return () => {
      clearTimeout(timer);
      unsubscribeStorage();
    };
  }, []);

  const loadSettings = async () => {
    try {
      const data = await extensionCommands.getSettings();
      if (data) setSettings(data);
    } catch (error) {
      console.error("Error loading settings:", error);
    }
  };

  const loadUserInfo = async () => {
    try {
      const data = await extensionCommands.getUserInfo();
      if (data) setUserInfo(data);
    } catch (error) {
      console.log("Error loading user info: ", error);
    }
  };

  const loadTaskList = async () => {
    try {
      const result: any = await storageService.get("taskList");
      if (result.taskList) {
        setTaskList(result?.taskList || []);
      }
    } catch (error) {
      console.error("Error loading task list:", error);
    }
  };

  const handleSave = async (data: any) => {
    try {

      const updatedSettings = {
        ...settings,
        ...data,
      };

      // Always save settings first
      const saved = await extensionCommands.saveSettings(updatedSettings);

      if (!saved) {
        console.error("Failed to save settings");
        showNotification("failed");
        return;
      }

      const apiPayload = {
        // automation: updatedSettings.activatingAutomation,
        schedule_start_time: updatedSettings.scheduleStartTime,
        schedule_end_time: updatedSettings.scheduleEndTime,
      };

      // Update API
      await updateExtensionSession(userInfo.extension_session.id, apiPayload);

      // Sync extension state
      try {
        const extensionSessionData = {
          automation: updatedSettings.activatingAutomation,
          schedule_start_time: updatedSettings.scheduleStartTime,
          schedule_end_time: updatedSettings.scheduleEndTime,
        };

        await extensionCommands.initializeAfterLogin(extensionSessionData);

        const updatedUser = {
          ...userInfo,
          extension_session: {
            ...userInfo.extension_session,
            ...extensionSessionData,
          },
        };

        await appStorage.setItem("local:user", updatedUser);
      } catch (err) {
        console.error("[AutomationPage] Failed to sync after update:", err);
      }

      setSettings(updatedSettings);
      showNotification("success");

      if (showJsonEditor) {
        setShowJsonEditor(false);
      }
    } catch (error) {
      console.error("[AutomationPage] Error saving settings:", error);
      showNotification("failed");
    }
  };

  const showNotification = (type: "success" | "failed") => {
    setNotification(type);
    setTimeout(() => setNotification(null), 3000);
  };

  const handleEditJson = () => {
    setShowJsonEditor(true);
  };

  const handleCloseJsonEditor = () => {
    setShowJsonEditor(false);
  };

  // Parse schedule time from format like "|05:00:00||"
  const parseScheduleInfo = () => {
    if (!taskList || taskList.length === 0) return null;

    const scheduledTasks = taskList.filter((task) => {
      if (!task.scheduleTime) return false;
      // Format: |HH:MM:SS||
      const match = task.scheduleTime.match(/\|(\d{2}):(\d{2}):(\d{2})\|\|/);
      return match !== null;
    });

    if (scheduledTasks.length === 0) return null;

    const scheduleInfo = scheduledTasks
      .map((task) => {
        const match = task.scheduleTime.match(/\|(\d{2}):(\d{2}):(\d{2})\|\|/);
        if (match) {
          const [_, hours, minutes, seconds] = match;
          const scheduleDate = new Date();
          scheduleDate.setHours(
            parseInt(hours),
            parseInt(minutes),
            parseInt(seconds),
            0,
          );

          // If time has passed today, schedule for tomorrow
          if (scheduleDate < new Date()) {
            scheduleDate.setDate(scheduleDate.getDate() + 1);
          }

          return {
            taskName: task.name || t("unnamedTask"),
            scheduleTime: `${hours}:${minutes}:${seconds}`,
            nextRun: scheduleDate,
            count: 1, // Each scheduled time runs once per day
            frequency: "24h", // Runs every 24 hours (once per day)
            interval: "Every day",
          };
        }
        return null;
      })
      .filter(Boolean);

    return scheduleInfo;
  };

  const scheduleInfo = parseScheduleInfo();

  return (
    <main className="automation-page">

      <WorkspacePageHeader
        eyebrow={t("automationEyebrow")}
        title={t("navAutomation")}
        description={t("automationDescription")}
      />

      {notification && (
        <div
          className={`notification-text ${notification === "success"
            ? "notification-success"
            : "notification-failed"
            }`}
        >
          {notification === "success" ? t("success") : t("failedNotice")}
        </div>
      )}

      <TopTabs
        tabs={localizeOptions(AUTOMATION_TABS, t)}
        activeTab={activeView}
        onTabChange={setActiveSubTab}
      />

      {!showJsonEditor ? (
        <>
          {activeView === "config" ? (
            <>
              {scheduleInfo && scheduleInfo.length > 0 && (
                <div className="schedule-info-banner">
                  <div className="schedule-info-title">{t("scheduledTasks")}</div>
                  <div className="schedule-items">
                    {scheduleInfo.map((info: any, idx: number) => (
                      <div key={idx} className="schedule-item">
                        <span className="schedule-task-name">
                          {info.taskName}
                        </span>
                        <div className="schedule-time-info">
                          <span className="schedule-time">
                            {info.scheduleTime}
                          </span>
                          <span className="schedule-count">
                            {t("every")} {info.frequency}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
              <AutomationTab
                settings={settings}
                userInfo={userInfo}
                onSave={handleSave}
                onEditJson={handleEditJson}
              />
            </>
          ) : (
            <TaskMonitorTab />
          )}
        </>
      ) : (
        <JsonEditor
          settings={settings}
          onSave={handleSave}
          onClose={handleCloseJsonEditor}
        />
      )}
    </main>
  );
}

export default AutomationPage;
