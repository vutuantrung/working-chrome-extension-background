import type { ButtonHTMLAttributes, ReactNode } from "react";

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  loading?: boolean;
  loadingLabel?: ReactNode;
  leftIcon?: ReactNode;
  rightIcon?: ReactNode;
}

export function Button({
  children,
  loading = false,
  loadingLabel,
  leftIcon,
  rightIcon,
  disabled,
  type = "button",
  ...props
}: ButtonProps) {
  return (
    <button type={type} disabled={disabled || loading} {...props}>
      {loading ? (
        loadingLabel ?? children
      ) : (
        <>
          {leftIcon}
          {children}
          {rightIcon}
        </>
      )}
    </button>
  );
}

export default Button;
