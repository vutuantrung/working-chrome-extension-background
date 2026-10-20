import { useTranslation } from "../helpers/i18n";
import { Tab } from "../types/types";

interface TopTabsProps<T extends string> {
  tabs: Tab<T>[];
  activeTab: T;
  onTabChange: any;
}

function TopTabs<T extends string>({
  tabs,
  activeTab,
  onTabChange,
}: TopTabsProps<T>) {
  const { t } = useTranslation();
  return (
    <div className="top-tabs" role="tablist" aria-label={t("subNavigation")}>
      {tabs.map((tab) => (
        <button
          key={tab.id}
          id={`top-tab-${tab.id}`}
          role="tab"
          aria-selected={activeTab === tab.id}
          className={`top-tabs__tab ${activeTab === tab.id ? "top-tabs__tab--active" : ""}`}
          onClick={() => onTabChange(tab.id)}
        >
          {tab.icon && <span className="top-tabs__tab-icon">{tab.icon}</span>}
          <span className="top-tabs__tab-label">{tab.label}</span>
          {typeof tab.count === "number" && (
            <span className="top-tabs__tab-count" aria-label={`${tab.count} ${t("items")}`}>
              {tab.count}
            </span>
          )}
        </button>
      ))}
    </div>
  );
}

export default TopTabs;