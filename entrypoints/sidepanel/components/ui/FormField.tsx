import type { ReactNode } from "react";

export interface FormFieldProps {
  label: ReactNode;
  children: ReactNode;
  className?: string;
  labelClassName?: string;
  htmlFor?: string;
}

export function FormField({ label, children, className, labelClassName, htmlFor }: FormFieldProps) {
  return (
    <div className={className}>
      <label className={labelClassName} htmlFor={htmlFor}>
        {label}
      </label>
      {children}
    </div>
  );
}

export default FormField;
