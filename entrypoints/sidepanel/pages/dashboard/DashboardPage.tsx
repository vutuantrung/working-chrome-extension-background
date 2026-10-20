import { useId, useState } from "react";
import { FaArrowTrendUp, FaCheck, FaCircleExclamation, FaClockRotateLeft, FaListCheck, FaBan, FaArrowRight, FaChartLine } from "../../assets/constants/icons";
import "../../assets/css/pages/dashboard.css";
import WorkspacePageHeader from "../../components/WorkspacePageHeader";
import { useTranslation } from "../../helpers/i18n";

type WindowRange = "24h" | "7d";
type PostPoint = { label: string; count: number };

// Fixed demo data only. Replace with a dashboard API when metrics become available.
const hourlyCounts: PostPoint[] = [
  { label: "00:00", count: 1240 }, { label: "01:00", count: 1243 },
  { label: "02:00", count: 1241 }, { label: "03:00", count: 1248 },
  { label: "04:00", count: 1251 }, { label: "05:00", count: 1257 },
  { label: "06:00", count: 1260 }, { label: "07:00", count: 1258 },
  { label: "08:00", count: 1269 }, { label: "09:00", count: 1276 },
  { label: "10:00", count: 1280 }, { label: "11:00", count: 1277 },
  { label: "12:00", count: 1289 }, { label: "13:00", count: 1296 },
  { label: "14:00", count: 1293 }, { label: "15:00", count: 1308 },
  { label: "16:00", count: 1316 }, { label: "17:00", count: 1312 },
  { label: "18:00", count: 1325 }, { label: "19:00", count: 1332 },
  { label: "20:00", count: 1329 }, { label: "21:00", count: 1339 },
  { label: "22:00", count: 1345 }, { label: "23:00", count: 1356 },
];
const weeklyCounts: PostPoint[] = [
  { label: "Mon", count: 1054 }, { label: "Tue", count: 1098 },
  { label: "Wed", count: 1121 }, { label: "Thu", count: 1189 },
  { label: "Fri", count: 1223 }, { label: "Sat", count: 1280 },
  { label: "Sun", count: 1356 },
];
const taskStats = { completed: 1084, failed: 52, canceled: 32 };
const total = taskStats.completed + taskStats.failed + taskStats.canceled;
const completionRate = Math.round((taskStats.completed / total) * 100);
const recentErrors = [
  { code: "TIMEOUT", title: "Task execution timed out", detail: "Facebook · Profile 1024", at: "2 min ago", level: "error" },
  { code: "SESSION_EXPIRED", title: "Authentication session expired", detail: "Instagram · Profile 0918", at: "18 min ago", level: "error" },
  { code: "RATE_LIMIT", title: "Request rate limit reached", detail: "Facebook · Profile 1112", at: "41 min ago", level: "warning" },
  { code: "NETWORK_ERROR", title: "Connection interrupted", detail: "TikTok · Profile 0875", at: "1 hr ago", level: "warning" },
] as const;

const formatted = (value: number) => new Intl.NumberFormat("en-US").format(value);

function PostChart({ data }: { data: PostPoint[] }) {
  const gradientId = useId().replace(/:/g, "");
  const left = 42, top = 16, width = 650, height = 200, bottom = top + height;
  const counts = data.map((point) => point.count);
  const min = Math.floor((Math.min(...counts) - 20) / 20) * 20;
  const max = Math.ceil((Math.max(...counts) + 20) / 20) * 20;
  const scaleY = (value: number) => bottom - ((value - min) / (max - min)) * height;
  const points = data.map((point, index) => ({ x: left + (index / (data.length - 1)) * width, y: scaleY(point.count) }));
  const path = points.map((point, index) => `${index === 0 ? "M" : "L"} ${point.x.toFixed(1)} ${point.y.toFixed(1)}`).join(" ");
  const fillPath = `${path} L ${left + width} ${bottom} L ${left} ${bottom} Z`;
  const yTicks = Array.from({ length: 5 }, (_, i) => min + ((max - min) * i) / 4);
  return (
    <div className="dashboard-chart-scroll">
      <svg className="dashboard-chart" viewBox="0 0 720 270" role="img" aria-label={`Post count increased from ${formatted(counts[0])} to ${formatted(counts[counts.length - 1])}`}>
        <defs><linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#B90B2F" stopOpacity=".19" /><stop offset="100%" stopColor="#B90B2F" stopOpacity="0" /></linearGradient></defs>
        {yTicks.map((tick) => <g key={tick}><line x1={left} x2={left + width} y1={scaleY(tick)} y2={scaleY(tick)} stroke="var(--dashboard-grid-line, #e9edf2)" strokeDasharray="4 5" /><text x={left - 9} y={scaleY(tick) + 4} textAnchor="end" className="dashboard-chart-label">{formatted(Math.round(tick))}</text></g>)}
        <path d={fillPath} fill={`url(#${gradientId})`} />
        <path d={path} fill="none" stroke="#B90B2F" strokeWidth="3" strokeLinejoin="round" strokeLinecap="round" />
        <circle cx={points[points.length - 1].x} cy={points[points.length - 1].y} r="5" fill="#B90B2F" stroke="var(--dashboard-point-outline, #ffffff)" strokeWidth="3" />
        {points.filter((_, index) => index % Math.max(1, Math.floor(data.length / 6)) === 0 || index === points.length - 1).map((point) => {
          const index = points.indexOf(point);
          return <text key={index} x={point.x} y="254" textAnchor={index === 0 ? "start" : index === points.length - 1 ? "end" : "middle"} className="dashboard-chart-label">{data[index].label}</text>;
        })}
      </svg>
    </div>
  );
}

export default function DashboardPage() {
  const { t } = useTranslation();
  const [range, setRange] = useState<WindowRange>("24h");
  const points = range === "24h" ? hourlyCounts : weeklyCounts;
  const first = points[0].count;
  const current = points[points.length - 1].count;
  const difference = current - first;
  const delta = ((difference / first) * 100).toFixed(1);
  return (
    <main className="dashboard-page">

      <WorkspacePageHeader
        eyebrow={t("dashboardEyebrow")}
        title={t("navDashboard")}
        description={t("dashboardDescription")}
      />

      <section className="dashboard-panel" aria-labelledby="dashboard-post-title">
        <div className="dashboard-panel-heading">
          <div>
            <div className="dashboard-section-kicker"><FaChartLine /> CONTENT ACTIVITY</div>
            <h2 id="dashboard-post-title">{t("postCount")}</h2>
            <p>{t("postCountHint")}</p>
          </div>
          <div className="dashboard-range" role="group" aria-label={t("timeframe")}>
            <button type="button" className={range === "24h" ? "selected" : ""} aria-pressed={range === "24h"} onClick={() => setRange("24h")}>24 hours</button>
            <button type="button" className={range === "7d" ? "selected" : ""} aria-pressed={range === "7d"} onClick={() => setRange("7d")}>7 days</button>
          </div>
        </div>
        <div className="dashboard-post-summary">
          <span className="dashboard-primary-number">{formatted(current)}</span>
          <span className="dashboard-growth"><FaArrowTrendUp /> +{formatted(difference)} ({delta}%)</span>
          <span className="dashboard-muted">{t("versusPeriod")}</span>
        </div>
        <PostChart data={points} />
      </section>

      <section className="dashboard-tasks" aria-labelledby="dashboard-tasks-title">
        <div className="dashboard-section-header"><div><h2 id="dashboard-tasks-title">{t("taskActivity")}</h2><p>{t("taskActivityHint")}</p></div><span className="dashboard-period"><FaClockRotateLeft /> Last 24h</span></div>
        <div className="dashboard-stat-grid">

          <article className="dashboard-stat-card">
            <div className="dashboard-stat-head">
              <span>{t("totalTasks")}</span>
              <span className="dashboard-stat-icon neutral"><FaListCheck /></span>
            </div>
            <strong>{formatted(total)}</strong>
            <span className="dashboard-stat-foot">{t("allExecutions")}</span>
          </article>

          <article className="dashboard-stat-card">
            <div className="dashboard-stat-head">
              <span>{t("completed")}</span>
              <span className="dashboard-stat-icon success"><FaCheck /></span>
            </div>
            <strong>{formatted(taskStats.completed)}</strong>
            <span className="dashboard-stat-foot success-text">{completionRate}% completion rate</span>
          </article>

          <article className="dashboard-stat-card">
            <div className="dashboard-stat-head">
              <span>{t("failed")}</span>
              <span className="dashboard-stat-icon danger"><FaCircleExclamation /></span>
            </div>
            <strong>{formatted(taskStats.failed)}</strong>
            <span className="dashboard-stat-foot">{t("failedTasks")}</span>
          </article>

          <article className="dashboard-stat-card">
            <div className="dashboard-stat-head">
              <span>{t("canceled")}</span>
              <span className="dashboard-stat-icon gray"><FaBan /></span>
            </div>
            <strong>{formatted(taskStats.canceled)}</strong>
            <span className="dashboard-stat-foot">{t("stoppedTasks")}</span>
          </article>
        </div>
        
        <div className="dashboard-completion">
          <div>
            <span>{t("taskDistribution")}</span>
            <strong>{completionRate}% completed</strong>
          </div>
          <div className="dashboard-progress-track" role="img" aria-label={`${completionRate}% completed, ${taskStats.failed} failed, ${taskStats.canceled} canceled`}>
            <span style={{ width: `${(taskStats.completed / total) * 100}%` }} className="dashboard-progress-completed" />
            <span style={{ width: `${(taskStats.failed / total) * 100}%` }} className="dashboard-progress-failed" />
            <span style={{ width: `${(taskStats.canceled / total) * 100}%` }} className="dashboard-progress-canceled" />
          </div>
          <div className="dashboard-progress-legend">
            <span><i className="complete" /> Completed</span>
            <span><i className="failed" /> Failed</span>
            <span><i className="canceled" /> Canceled</span>
          </div>
        </div>
      </section>

      <section className="dashboard-panel dashboard-errors" aria-labelledby="dashboard-errors-title">

        <div className="dashboard-panel-heading">
          <div>
            <div className="dashboard-section-kicker"><FaCircleExclamation /> ISSUE TRACKING</div>
            <h2 id="dashboard-errors-title">{t("recentErrors")}</h2>
            <p>{t("recentErrorsHint")}</p></div>
          <span className="dashboard-error-count">{recentErrors.length} recent</span>
        </div>

        <div className="dashboard-error-list">
          {recentErrors.map((error) =>
            <article className="dashboard-error-item" key={error.code}>
              <div className={`dashboard-error-icon ${error.level}`}><FaCircleExclamation /></div>
              <div className="dashboard-error-body"><div className="dashboard-error-title">{error.title}</div>
                <div className="dashboard-error-meta">
                  <code>{error.code}</code>
                  <span>{error.detail}</span>
                </div>
              </div>
              <span className="dashboard-error-time">{error.at}</span>
              <FaArrowRight className="dashboard-error-arrow" aria-hidden="true" />
            </article>
          )}
        </div>
      </section>
      <p className="dashboard-disclaimer">{t("mockDisclaimer")}</p>
    </main>
  );
}
