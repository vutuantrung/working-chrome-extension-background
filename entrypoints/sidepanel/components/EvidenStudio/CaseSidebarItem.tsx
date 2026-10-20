import { ReactNode } from "react";
import { FaPlus, FaCheck } from "../../assets/constants/icons";
import { ProfileCase } from "../../types/types";
import "../../assets/css/components/CaseSidebarItem.css";
import { useTranslation } from "../../helpers/i18n";

interface SidebarItemProps {
  profileCase: ProfileCase;
  isSelected: boolean;
  onSelect: (newCase: ProfileCase) => void;
  platformIcon?: ReactNode;
}

function SidebarItem({
  profileCase,
  isSelected,
  platformIcon,
  onSelect,
}: SidebarItemProps) {
  const isNew = profileCase.id === "new";
  const { t } = useTranslation();

  return (
    <li className={`case-sidebar-item${isNew ? " case-sidebar-item--new" : ""}`}>
      <button
        type="button"
        onClick={() => onSelect(profileCase)}
        className={`case-sidebar-item__button${isSelected ? " case-sidebar-item__button--selected" : ""}`}
      >
        <span className="case-sidebar-item__platform-icon">
          {isNew ? <FaPlus aria-hidden="true" /> : (platformIcon ?? null)}
        </span>
        <span className="case-sidebar-item__content">
          <span className="case-sidebar-item__name">{profileCase.name}</span>
          <span className="case-sidebar-item__url">{profileCase.id === "new" ? t("createCase") : (profileCase.origin_url || t("noOriginURL"))}</span>
        </span>
        {isSelected && <span className="case-sidebar-item__selected-mark"><FaCheck aria-hidden="true" /></span>}
      </button>
    </li>
  );
}

export default SidebarItem;
