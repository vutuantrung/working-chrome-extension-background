import type { CSSProperties } from "react";
import type { Persona } from "../../types/types";
import "../../assets/css/components/Persona.css";

interface AvatarProps {
    persona: Persona;
    size?: number;
}

type AvatarCssVars = CSSProperties & {
    "--persona-avatar-size": string;
    "--persona-avatar-bg": string;
    "--persona-avatar-font-size": string;
};

const Avatar = ({ persona, size = 44 }: AvatarProps) => {
    const initials = `${persona.first_name?.[0] ?? ""}${persona.last_name?.[0] ?? ""}`.toUpperCase() || "?";
    const hue = (persona.id.charCodeAt(0) * 37 + persona.id.charCodeAt(1) * 13) % 360;
    const cssVars: AvatarCssVars = {
        "--persona-avatar-size": `${size}px`,
        "--persona-avatar-bg": `hsl(${hue}, 55%, 55%)`,
        "--persona-avatar-font-size": `${size * 0.34}px`,
    };

    return <div className="persona-avatar" style={cssVars}>{initials}</div>;
};

export default Avatar;
