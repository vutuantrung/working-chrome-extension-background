import type { ChangeEvent, InputHTMLAttributes, ReactNode } from "react";
import { FaSearch } from "../../assets/constants/icons";

export interface SearchInputProps
  extends Omit<InputHTMLAttributes<HTMLInputElement>, "onChange" | "value"> {
  value: string;
  onChange: (value: string, event: ChangeEvent<HTMLInputElement>) => void;
  icon?: ReactNode;
  wrapperClassName?: string;
  iconClassName?: string;
  inputClassName?: string;
}

export function SearchInput({
  value,
  onChange,
  icon,
  wrapperClassName,
  iconClassName,
  inputClassName,
  ...inputProps
}: SearchInputProps) {
  return (
    <div className={wrapperClassName}>
      <span className={iconClassName} aria-hidden="true">
        {icon ?? <FaSearch />}
      </span>
      <input
        {...inputProps}
        type={inputProps.type ?? "search"}
        value={value}
        onChange={(event) => onChange(event.target.value, event)}
        className={inputClassName}
      />
    </div>
  );
}

export default SearchInput;
