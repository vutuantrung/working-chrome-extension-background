import type { ButtonHTMLAttributes, ReactNode } from "react";

export interface IconButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  ariaLabel: string;
  icon: ReactNode;
}

export function IconButton({ ariaLabel, icon, type = "button", ...props }: IconButtonProps) {
  return (
    <button type={type} aria-label={ariaLabel} {...props}>
      {icon}
    </button>
  );
}

export default IconButton;
