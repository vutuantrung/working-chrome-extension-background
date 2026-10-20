import type { CSSProperties } from "react";
import "../../assets/css/components/Persona.css";

type GenderCssVars = CSSProperties & {
    "--persona-gender-color": string;
};

const GenderDot = ({ gender }: { gender: string }) => {
    const color = gender === "male" ? "#60a5fa" : gender === "female" ? "#f472b6" : "#a3a3a3";
    const label = gender === "male" ? "♂" : gender === "female" ? "♀" : "○";
    const cssVars: GenderCssVars = { "--persona-gender-color": color };

    return <span className="persona-gender-dot" style={cssVars}>{label}</span>;
};

export default GenderDot;
