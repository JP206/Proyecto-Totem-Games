import React from "react";
import "./FilterSelect.css";

export interface FilterOption {
  value: string;
  label: string;
}

export interface FilterSelectProps
  extends Omit<React.SelectHTMLAttributes<HTMLSelectElement>, "onChange"> {
  label?: string;
  options: FilterOption[];
  value: string;
  onChange: (value: string) => void;
}

const FilterSelect: React.FC<FilterSelectProps> = ({
  label,
  options,
  value,
  onChange,
  className = "",
  ...props
}) => {
  return (
    <label className={`app-filter-select ${className}`.trim()}>
      {label ? <span className="app-filter-select-label">{label}</span> : null}
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="app-filter-select-input"
        {...props}
      >
        {options.map((option) => (
          <option key={`${option.value}-${option.label}`} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </label>
  );
};

export default FilterSelect;
