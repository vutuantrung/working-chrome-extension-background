import { useTranslation } from "../../helpers/i18n";
import type { Persona } from "../../types/types";
import Avatar from "./Avatar";
import GenderDot from "./GenderDot";
import StatusBadge from "./StatusBadge";
import { countryFlag } from "../../helpers/helpers";
import "../../assets/css/components/Persona.css";

interface PersonaCardProps {
    persona: Persona;
    selected: boolean;
    onSelect: () => void;
}

const PersonaCard = ({ persona, selected, onSelect }: PersonaCardProps) => {
    const { t } = useTranslation();
    const fullName = [persona.first_name, persona.last_name].filter(Boolean).join(" ").trim() || t("unnamedPersona");
    const hasJob = Boolean(persona.job && persona.job !== "string");

    return (
        <button
            type="button"
            onClick={onSelect}
            aria-pressed={selected}
            aria-label={`${selected ? t("deselect") : t("select")} ${fullName}`}
            className={`persona-card ${selected ? "persona-card--selected" : ""}`}
        >
            <span className="persona-card__avatar">
                <Avatar persona={persona} size={46} />
            </span>
            <span className="persona-card__body">
                <span className="persona-card__title-row">
                    <span className="persona-card__name" title={fullName}>{fullName}</span>
                    <GenderDot gender={persona.gender} />
                </span>
                {hasJob && <span className="persona-card__job" title={persona.job}>{persona.job}</span>}
                <span className="persona-card__meta">
                    <StatusBadge status={persona.status} />
                    {persona.country && (
                        <span className="persona-card__country" title={persona.country}>
                            <span aria-hidden="true">{countryFlag(persona.country)}</span>
                            <span className="persona-card__country-name">{persona.country}</span>
                        </span>
                    )}
                </span>
            </span>
            <span className="persona-card__selection" aria-hidden="true">
                {selected && <svg viewBox="0 0 20 20" fill="none" width="13" height="13"><path d="m4.5 10 3.5 3.5 7.5-8" stroke="currentColor" strokeWidth="2.3" strokeLinecap="round" strokeLinejoin="round" /></svg>}
            </span>
        </button>
    );
};

export default PersonaCard;
