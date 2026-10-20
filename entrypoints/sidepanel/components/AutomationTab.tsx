import "../assets/css/components/AutomationTab.css";
import { useState, useEffect, useMemo, useRef } from "react";
import { User } from "../types/types";
import {
  extensionCommands,
  extensionStorage,
} from "../application/services/SidepanelServices";
import { FaClock, FaPlayCircle, FaCheckCircle, FaSpinner } from "../assets/constants/icons";
import { isTimeValid } from "../helpers/helpers";
import { useTranslation } from "../helpers/i18n";

interface AutomationTabProps {
  settings: any;
  userInfo: User;
  onSave: (data: any) => void;
  onEditJson: () => void;
}

const resolveIsTabSpecific = (settings: any): boolean => {
  if (typeof settings?.isTabSpecific === "boolean") {
    return settings.isTabSpecific;
  }
  if (typeof settings?.is_tab_specific === "boolean") {
    return settings.is_tab_specific;
  }
  return false;
};

function AutomationTab({
  settings,
  userInfo,
  onSave,
  onEditJson,
}: AutomationTabProps) {
  const { t } = useTranslation();
  const [formData, setFormData] = useState({
    activatingAutomation: false,
    scheduleStartTime: "",
    scheduleEndTime: "",
    proxyOption: "system",
    httpProxyHost: "",
    httpProxyPort: "",
    httpsProxyHost: "",
    httpsProxyPort: "",
    userActivatingAutomation: true,
  });
  const initializedRef = useRef(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string>("");
  // const [boundTabInfo, setBoundTabInfo] = useState<{
  //   id: number;
  //   title: string;
  //   url: string;
  // } | null>(null);
  const [fbAccount, setFbAccount] = useState<{ userId?: string; name?: string; } | null>(null);
  const isTabSpecific = useMemo(() => resolveIsTabSpecific(settings), [settings]);
  const [errors, setErrors] = useState<{ [key: string]: string | undefined }>({});

  const onBlur = (e: any) => {
    const { name, value } = e.target;
    if (value && !isTimeValid(value)) {
      setErrors((prev) => ({
        ...prev,
        [name]: "Format must be HH:MM:SS (24h)",
      }));
    } else {
      setErrors((prev) => ({ ...prev, [name]: undefined }));
    }
  };

  useEffect(() => {
    async function getAutomationStorage() {
      const { automationByUser } =
        await extensionStorage.get("automationByUser");
      if (typeof automationByUser === "boolean") {
        setFormData((prev) => ({
          ...prev,
          userActivatingAutomation: automationByUser,
        }));
      }
    }
    getAutomationStorage();
  }, []);

  useEffect(() => {
    const loadFbAccount = async () => {
      try {
        const account = await extensionCommands.getFacebookAccountCache();
        if (account) {
          setFbAccount(account);
        } else {
          setFbAccount(null);
        }
      } catch {
        setFbAccount(null);
      }
    };

    loadFbAccount();
  }, []);

  useEffect(() => {
    if (!settings || !userInfo) return;

    if (!initializedRef.current) {
      setFormData((prev) => ({
        ...prev,
        activatingAutomation: userInfo.extension_session?.automation ?? false,
        scheduleStartTime:
          userInfo.extension_session?.schedule_start_time || "",
        scheduleEndTime: userInfo.extension_session?.schedule_end_time || "",
      }));

      initializedRef.current = true;
    } else {
      setFormData((prev) => ({
        ...prev,
        activatingAutomation:
          settings.activatingAutomation ?? prev.activatingAutomation,
        scheduleStartTime: settings.scheduleStartTime ?? prev.scheduleStartTime,
        scheduleEndTime: settings.scheduleEndTime ?? prev.scheduleEndTime,
        proxyOption: settings.proxy === "system" ? "system" : "manual",
        httpProxyHost: settings.proxy?.http?.host || "",
        httpProxyPort: settings.proxy?.http?.port || "",
        httpsProxyHost: settings.proxy?.https?.host || "",
        httpsProxyPort: settings.proxy?.https?.port || "",
      }));
    }

    // Fetch bound tab info based on mode
    // if (isTabSpecific && settings.openingDevtoolsTabId) {
    //   fetchBoundTabInfo(settings.openingDevtoolsTabId);
    // } else if (!isTabSpecific && settings.firstFacebookTabId) {
    //   fetchBoundTabInfo(settings.firstFacebookTabId);
    // } else {
    //   setBoundTabInfo(null);
    // }
  }, [settings, userInfo]);

  // const fetchBoundTabInfo = async (tabId: number) => {
  //   try {
  //     const tab = await browserTabs.getTab(tabId);
  //     setBoundTabInfo({
  //       id: tab.id!,
  //       title: tab.title || "Untitled",
  //       url: tab.url || "",
  //     });
  //   } catch (error) {
  //     console.log("Bound tab no longer exists:", error);
  //     // Still show the tabId so users don't lose the binding context
  //     setBoundTabInfo({
  //       id: tabId,
  //       title: "(Unable to read tab title)",
  //       url: "",
  //     });
  //   }
  // };

  // const getDefaultTaskConfig = (taskName: string) => {
  //   let config: any;

  //   switch (taskName) {
  //     case "urtask_join_groups":
  //       config = {
  //         platform: "facebook",
  //         groupUrls: [
  //           "https://www.facebook.com/groups/123456789",
  //           "https://www.facebook.com/groups/987654321",
  //         ],
  //         delayBetweenJoins: 5000,
  //         maxGroupsToJoin: 10,
  //       };
  //       break;
  //     case "urtask_scroll_urls":
  //       config = {
  //         urls: [
  //           "https://www.facebook.com/groups/joins/?nav_source=tab&ordering=viewer_added",
  //         ],
  //         platform: "facebook",
  //         currentIdx: 0,
  //         groupNumber: 2,
  //         scrollTimes: "10,15",
  //         waitingTime: 3000,
  //       };
  //       break;
  //     case "urtask_scroll_joined_groups":
  //       config = {
  //         platform: "facebook",
  //         groupUrls: "",
  //         currentIdx: 0,
  //         groupNumber: 5,
  //         scrollTimes: "10,15",
  //         waitingTime: 3000,
  //         reviewPeriod: 900000,
  //         groupTypeFocused: "private",
  //       };
  //       break;
  //     default:
  //       config = "";
  //   }
  //   return config ? JSON.stringify(config, null, 2) : "";
  // };

  const handleInputChange = async (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { name, value, type } = e.target;
    const checked = (e.target as HTMLInputElement).checked;

    setFormData((prev) => {
      const newData = {
        ...prev,
        [name]: type === "checkbox" ? checked : value,
      };

      return newData;
    });
  };

  const handleSubmit = async () => {
    setSubmitError("");

    if (formData.activatingAutomation) {
      const timeRegex = /^([0-1]?[0-9]|2[0-3]):[0-5][0-9]:[0-5][0-9]$/;
      if (
        formData.scheduleStartTime &&
        !timeRegex.test(formData.scheduleStartTime)
      ) {
        setSubmitError("Invalid start time format. Please use HH: MM:SS");
        return;
      }

      if (
        formData.scheduleEndTime &&
        !timeRegex.test(formData.scheduleEndTime)
      ) {
        setSubmitError("Invalid end time format. Please use HH:MM: SS");
        return;
      }
    }

    setIsSubmitting(true);

    try {
      const data: any = {
        ...formData,
        proxy:
          formData.proxyOption === "system"
            ? "system"
            : {
              http: {
                host: formData.httpProxyHost,
                port: formData.httpProxyPort,
              },
              https: {
                host: formData.httpsProxyHost,
                port: formData.httpsProxyPort,
              },
            },
      };

      if (typeof formData.userActivatingAutomation === "boolean") {
        await extensionStorage.set({
          automationByUser: formData.userActivatingAutomation,
        });
      }

      onSave(data);
    } catch (error) {
      console.error("Error saving settings:", error);
      const errorMessage = error instanceof Error ? error.message : "Unknown error";
      setSubmitError(`Failed to save settings: ${errorMessage}`);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="automation-tab-container automation-redesign">
      <div className="automation-workspace">
        {!formData.activatingAutomation ? (
          <section className="automation-panel automation-unavailable" aria-label="Automation availability">
            <div className="automation-panel-icon"><FaPlayCircle /></div>
            <div>
              <h3>{t("automationUnavailable")}</h3>
              <p>{t("automationUnavailableHint")}</p>
            </div>
          </section>
        ) : (
          <>
            <section className="automation-panel" aria-labelledby="automation-control-title">
              <div className="automation-panel-top">
                <div className="automation-panel-icon"><FaPlayCircle /></div>
                <div className="automation-panel-copy">
                  <h3 id="automation-control-title">{t("automationControl")}</h3>
                  <p>{t("automationControlHint")}</p>
                </div>
                <span className={`automation-state-chip ${formData.userActivatingAutomation ? "is-on" : "is-off"}`}>
                  {formData.userActivatingAutomation ? t("on") : t("off")}
                </span>
              </div>
              <div className="automation-setting-row">
                <div>
                  <label className="automation-setting-name" htmlFor="userActivatingAutomation">{t("enableAutomation")}</label>
                  <p>{formData.userActivatingAutomation
                    ? t("autoTaskAnnounce1")
                    : t("autoTaskAnnounce2")}</p>
                </div>
                <label className="automation-switch">
                  <input type="checkbox" id="userActivatingAutomation" name="userActivatingAutomation" checked={formData.userActivatingAutomation} onChange={handleInputChange} />
                  <span className="automation-switch-track" aria-hidden="true" />
                </label>
              </div>
            </section>

            <section className="automation-panel" aria-labelledby="automation-schedule-title">
              <div className="automation-panel-top">
                <div className="automation-panel-icon"><FaClock /></div>
                <div className="automation-panel-copy">
                  <h3 id="automation-schedule-title">{t("schedule")}</h3>
                  <p>{t("scheduleHint")}</p>
                </div>
              </div>
              <div className="automation-time-grid">
                <div className="automation-time-field">
                  <label htmlFor="scheduleStartTime">{t("startTime")}</label>
                  <input type="text" id="scheduleStartTime" name="scheduleStartTime" inputMode="numeric" placeholder="HH:MM:SS" autoComplete="off" value={formData.scheduleStartTime} onChange={handleInputChange} onBlur={onBlur} aria-invalid={Boolean(errors.scheduleStartTime)} aria-describedby={errors.scheduleStartTime ? "automation-start-error" : undefined} />
                  {errors.scheduleStartTime && <span id="automation-start-error" className="automation-field-error">{errors.scheduleStartTime}</span>}
                </div>
                <div className="automation-time-field">
                  <label htmlFor="scheduleEndTime">{t("endTime")}</label>
                  <input type="text" id="scheduleEndTime" name="scheduleEndTime" inputMode="numeric" placeholder="HH:MM:SS" autoComplete="off" value={formData.scheduleEndTime} onChange={handleInputChange} onBlur={onBlur} aria-invalid={Boolean(errors.scheduleEndTime)} aria-describedby={errors.scheduleEndTime ? "automation-end-error" : undefined} />
                  {errors.scheduleEndTime && <span id="automation-end-error" className="automation-field-error">{errors.scheduleEndTime}</span>}
                </div>
              </div>
              <p className="automation-hint"><FaClock aria-hidden="true" /> {t("fillLeaveBlank")}</p>
            </section>

            <div className="automation-footer">
              {submitError && <div className="automation-submit-error" role="alert">{submitError}</div>}
              <button type="button" onClick={handleSubmit} className="automation-save-button" disabled={isSubmitting}>
                {isSubmitting ? <FaSpinner className="status-icon-spin" /> : <FaCheckCircle />}
                {isSubmitting ? t("saveSetting") : t("saving")}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

export default AutomationTab;
