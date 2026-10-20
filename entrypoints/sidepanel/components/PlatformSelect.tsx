import { useTranslation } from "../helpers/i18n";
import React from "react";
import { PLATFORMS } from "../helpers/helpers-ui";
import type { PlatformId, PlatformObject } from "../types/types";

interface PlatformSelectProps {
  onSelectPlatform: (platform: PlatformObject) => void;
  busyId: PlatformId | null;
  variant?: "switch";
  currentPlatformId?: PlatformId | null;
}

const PlatformSelect = ({
  onSelectPlatform,
  busyId,
  variant,
  currentPlatformId,
}: PlatformSelectProps) => {
  const { t } = useTranslation();
  const arialLabelByPlatform = (platform: PlatformObject) => `${platform.label}${platform.disabled
    ? `, ${t("comingSoon")}`
    : currentPlatformId === platform.id && variant === "switch"
      ? `, ${t("currentPlatform")}`
      : ""
    }`;
  const classNameByPlatform = (platform: PlatformObject) => `platform-select__card ${platform.disabled || busyId !== null
    ? "platform-select__card--disabled"
    : ""
    } ${currentPlatformId === platform.id && variant === "switch"
      ? "platform-select__card--current"
      : ""
    }`;
  const isDisabledByPlatform = (platform: PlatformObject) => platform.disabled || busyId !== null;
  const displayIconByPlatform = (platform: PlatformObject) => variant === "switch" && !platform.disabled && <span className="platform-select__action">{currentPlatformId === platform.id ? t("current") : "↗"}</span>

  return (
    <div className={`platform-select ${variant === "switch" ? "platform-select--switch" : ""}`}>
      <div className="platform-select__grid">
        {PLATFORMS.map((platform) => {
          return (
            <button
              key={platform.id}
              type="button"
              disabled={isDisabledByPlatform(platform)}
              aria-label={arialLabelByPlatform(platform)}
              className={classNameByPlatform(platform)}
              style={
                {
                  "--platform-gradient": platform.gradient,
                  "--platform-glow": platform.hoverGlow,
                } as React.CSSProperties
              }
              onClick={() => onSelectPlatform(platform)}
            >
              {platform.disabled && (
                <span className="platform-select__coming-soon">
                  {t("comingSoon")}
                </span>
              )}
              {busyId === platform.id && (
                <span className="platform-select__spinner" />
              )}
              <span className="platform-select__icon">
                {platform.icon}
              </span>
              <span className="platform-select__label">
                {platform.label}
              </span>
              {displayIconByPlatform(platform)}
            </button>
          );
        })}
      </div>
    </div>
  );
}

export default PlatformSelect;