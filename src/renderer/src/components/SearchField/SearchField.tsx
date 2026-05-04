import React from "react";
import { Search, X } from "lucide-react";
import "./SearchField.css";

export interface SearchFieldProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  className?: string;
  clearLabel?: string;
}

const SearchField: React.FC<SearchFieldProps> = ({
  value,
  onChange,
  placeholder = "Buscar...",
  className = "",
  clearLabel = "Limpiar búsqueda",
}) => {
  return (
    <div className={`app-search-field ${className}`.trim()}>
      <Search size={16} className="app-search-field-icon" aria-hidden />
      <input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="app-search-field-input"
      />
      {value ? (
        <button
          type="button"
          className="app-search-field-clear"
          onClick={() => onChange("")}
          aria-label={clearLabel}
        >
          <X size={14} />
        </button>
      ) : null}
    </div>
  );
};

export default SearchField;
