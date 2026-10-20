import { useTranslation } from "../../helpers/i18n";
import { FaChevronLeft, FaChevronRight, FaFolderOpen, FaPlus } from "../../assets/constants/icons";
import SidebarItem from "./CaseSidebarItem";
import { useState, useEffect } from "react";
import { useDebounce } from "../../helpers/helpers";
import { CaseFilter, ProfileCase, GetProfileCasesResponse } from "../../types/types";
import { DEFAULT_PAGE_SIZE } from "../../helpers/constants";
import { PLATFORMS } from "../../helpers/helpers-ui";
import "../../assets/css/components/CaseSidebar.css";
import { IconButton, SearchInput } from "../ui";

interface CaseSidebarProps {
  defaultCase: ProfileCase;
  profileCases?: GetProfileCasesResponse;
  selectedCase: ProfileCase;
  onSelect: (newCase: ProfileCase) => void;
  isOpen: boolean;
  onToggle: () => void;
  setFilter: (filter: CaseFilter) => void;
}

function CaseSidebar({
  defaultCase,
  profileCases,
  selectedCase,
  isOpen,
  onSelect,
  onToggle,
  setFilter,
}: CaseSidebarProps) {
  const { t } = useTranslation();
  const [searchText, setSearchText] = useState("");
  const debouncedSearchText = useDebounce(searchText, 500);
  const [page, setPage] = useState(1);

  const totalPages = Math.max(
    1,
    Math.ceil((profileCases?.meta.total_count ?? 0) / DEFAULT_PAGE_SIZE),
  );

  useEffect(() => {
    setPage(1);
    setFilter({ search: debouncedSearchText, offset: 0, limit: DEFAULT_PAGE_SIZE });
  }, [debouncedSearchText]);

  const handlePageChange = (newPage: number) => {
    setPage(newPage);
    setFilter({
      search: debouncedSearchText,
      offset: (newPage - 1) * DEFAULT_PAGE_SIZE,
      limit: DEFAULT_PAGE_SIZE,
    });
  };

  return (
    <aside className={`case-sidebar ${isOpen ? "case-sidebar--open" : "case-sidebar--closed"}`}>
      <header className="case-sidebar__header">

        <div className="case-sidebar__heading">
          <p className="case-sidebar__title">{t("caseLibrary")}
            <span className="case-sidebar__count">{profileCases?.meta.total_count ?? 0}</span>
          </p>
        </div>

        <IconButton
          onClick={onToggle}
          ariaLabel={t("collapseSidebar")}
          className="case-sidebar__icon-button"
          icon={<FaChevronLeft />}
        />
      </header>

      <div className="case-sidebar__search-area">
        <SearchInput
          value={searchText}
          onChange={setSearchText}
          placeholder={t("caseSearch")}
          wrapperClassName="case-sidebar__search-field"
          iconClassName="case-sidebar__search-icon"
          inputClassName="case-sidebar__search-input"
        />
        <button
          type="button"
          className={`case-sidebar__create-button${selectedCase.id === defaultCase.id ? " case-sidebar__create-button--active" : ""}`}
          onClick={() => onSelect(defaultCase)}
          title={t("createCase")}
          aria-label={t("createCase")}
        >
          <FaPlus aria-hidden="true" />
        </button>
      </div>

      <div className="case-sidebar__section-heading">
        <span>{t("yourCases")}</span>
        <span className="case-sidebar__section-count">{profileCases?.meta.total_count ?? 0} {t("totalCases")}</span>
      </div>

      <ul className="case-sidebar__list custom-scroll">
        {profileCases?.data?.length === 0 && (debouncedSearchText || page > 1) && (
          <li className="case-sidebar__empty">
            <FaFolderOpen aria-hidden="true" />
            <span>{t("noCaseMatch")}</span>
            <small>{t("tryOtherSearch")}</small>
          </li>
        )}
        {profileCases?.data.map((c) => (
          <SidebarItem
            key={c.id}
            profileCase={c}
            isSelected={selectedCase.id === c.id}
            onSelect={onSelect}
            platformIcon={PLATFORMS.find((p) => p.id === c.platform)?.icon}
          />
        ))}
      </ul>

      {totalPages > 1 && (
        <footer className="case-sidebar__pagination">
          <IconButton
            onClick={() => handlePageChange(page - 1)}
            disabled={page === 1}
            ariaLabel={t("previous")}
            className="case-sidebar__pagination-button"
            icon={<FaChevronLeft size={11} />}
          />
          <span className="case-sidebar__page-label">{page} / {totalPages}</span>
          <IconButton
            onClick={() => handlePageChange(page + 1)}
            disabled={page === totalPages}
            ariaLabel={t("next")}
            className="case-sidebar__pagination-button"
            icon={<FaChevronRight size={11} />}
          />
        </footer>
      )}
    </aside>
  );
}

export default CaseSidebar;
