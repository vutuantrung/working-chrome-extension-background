import { renderSVGIcon } from "../helpers/helpers-ui";
import { useEffect, useState } from "react";
import {
  getSelectedPlatformId,
  getSelectedPlatformLabel,
} from "../helpers/helpers";
import {
  PLATFORM_CHANGED_EVENT
} from "../helpers/constants";

interface PlatformMetaBarProps {
  platformLabel?: string | null;
}

function PlatformMetaBar({ platformLabel }: PlatformMetaBarProps) {
  const [storedLabel, setStoredLabel] = useState(getSelectedPlatformLabel);
  const [storedId, setStoredId] = useState(getSelectedPlatformId);

  useEffect(() => {
    const sync = () => {
      setStoredLabel(getSelectedPlatformLabel());
      setStoredId(getSelectedPlatformId());
    };
    window.addEventListener(PLATFORM_CHANGED_EVENT, sync);
    return () => window.removeEventListener(PLATFORM_CHANGED_EVENT, sync);
  }, []);

  useEffect(() => {
    if (!platformLabel) {
      setStoredLabel(getSelectedPlatformLabel());
      setStoredId(getSelectedPlatformId());
    }
  }, [platformLabel]);

  const label = platformLabel ?? storedLabel;
  const platformId = platformLabel ? null : storedId; // use storedId if no manual label is passed

  if (!label) return null;

  const idClass = platformId || label.toLowerCase();

  return (
    <div className="platform-meta-bar">
      <div className={`platform-badge platform-badge--${idClass}`}>
        {renderSVGIcon(idClass) && (
          <span className="platform-badge__icon">{renderSVGIcon(idClass)}</span>
        )}
        <span className="platform-badge__name">{label}</span>
      </div>
    </div>
  );
}

export default PlatformMetaBar;
