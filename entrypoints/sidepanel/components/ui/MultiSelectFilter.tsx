import { useEffect, useRef, useState, type ReactNode } from "react";
import { FaChevronDown } from "../../assets/constants/icons";
import Button from "./Button";

export interface MultiSelectOption {
  id: string;
  label: string;
}

export interface MultiSelectFilterProps {
  label: string;
  options: MultiSelectOption[];
  selectedValues: string[];
  onChange: (newValues: string[]) => void;
  clearLabel?: string;
  leftIcon?: ReactNode;
}

export function MultiSelectFilter({
  label,
  options,
  selectedValues,
  onChange,
  clearLabel = "Bỏ chọn tất cả",
  leftIcon,
}: MultiSelectFilterProps) {
  const [open, setOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setOpen(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const getDisplayText = () => {
    if (selectedValues.length === 0) return label;
    if (selectedValues.length === 1) {
      const option = options.find((item) => item.id === selectedValues[0]);
      return `${label}: ${option?.label ?? selectedValues[0]}`;
    }
    return `${label}: ${selectedValues.length} đã chọn`;
  };

  const toggleOption = (id: string) => {
    onChange(
      selectedValues.includes(id)
        ? selectedValues.filter((value) => value !== id)
        : [...selectedValues, id],
    );
  };

  return (
    <div className="multi-select-filter" ref={dropdownRef}>
      <Button
        id={`multi-select-${label.toLowerCase().replace(/\s+/g, "-")}`}
        className={`multi-select-filter__trigger ${
          selectedValues.length > 0 ? "multi-select-filter__trigger--active" : ""
        }`}
        onClick={() => setOpen((value) => !value)}
        rightIcon={
          <FaChevronDown
            className={`multi-select-filter__arrow ${open ? "open" : ""}`}
            size={10}
          />
        }
>
        {leftIcon ? <span className="multi-select-filter__leading-icon" aria-hidden="true">{leftIcon}</span> : null}
        <span className="multi-select-filter__label">{getDisplayText()}</span>
      </Button>

      {open && (
        <div className="multi-select-filter__dropdown">
          {options.map((option) => {
            const checked = selectedValues.includes(option.id);
            return (
              <label key={option.id} className="multi-select-filter__option">
                <input
                  type="checkbox"
                  checked={checked}
                  onChange={() => toggleOption(option.id)}
                />
                <span>{option.label}</span>
              </label>
            );
          })}

          {selectedValues.length > 0 && (
            <div className="multi-select-filter__footer">
              <Button
                className="multi-select-filter__clear-btn"
                onClick={() => onChange([])}
              >
                {clearLabel}
              </Button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default MultiSelectFilter;
