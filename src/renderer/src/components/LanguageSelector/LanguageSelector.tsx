import React, { useState } from "react";
import { CheckSquare, Square, ChevronDown, Globe } from "lucide-react";
import {
  AVAILABLE_LANGUAGES,
  type LanguageOption,
} from "../../constants/languages";
import "./LanguageSelector.css";

export type { LanguageOption };

interface LanguageSelectorProps {
  selectedLanguages: LanguageOption[];
  onToggleLanguage: (language: LanguageOption) => void;
  onToggleRegion?: (region: string, languages: LanguageOption[]) => void;
}

const LanguageSelector: React.FC<LanguageSelectorProps> = ({
  selectedLanguages,
  onToggleLanguage,
  onToggleRegion,
}) => {
  const [showLanguages, setShowLanguages] = useState(false);

  const languagesByRegion = AVAILABLE_LANGUAGES.reduce(
    (acc, lang) => {
      if (!acc[lang.region!]) {
        acc[lang.region!] = [];
      }
      acc[lang.region!].push(lang);
      return acc;
    },
    {} as Record<string, LanguageOption[]>,
  );

  const totalLanguages = AVAILABLE_LANGUAGES.length;
  const allSelected = selectedLanguages.length === totalLanguages;
  const noneSelected = selectedLanguages.length === 0;

  const isRegionFullySelected = (
    region: string,
    langs: LanguageOption[],
  ): boolean => {
    return langs.every((lang) =>
      selectedLanguages.some((l) => l.id === lang.id),
    );
  };

  const isRegionPartiallySelected = (
    region: string,
    langs: LanguageOption[],
  ): boolean => {
    const selectedCount = langs.filter((lang) =>
      selectedLanguages.some((l) => l.id === lang.id),
    ).length;
    return selectedCount > 0 && selectedCount < langs.length;
  };

  const getRegionIcon = (region: string, langs: LanguageOption[]) => {
    if (isRegionFullySelected(region, langs)) {
      return (
        <CheckSquare size={16} className="toggle-checkbox fully-selected" />
      );
    }
    if (isRegionPartiallySelected(region, langs)) {
      return (
        <Square size={16} className="toggle-checkbox partially-selected" />
      );
    }
    return <Square size={16} className="toggle-checkbox" />;
  };

  const getToggleAllIcon = () => {
    if (allSelected) {
      return (
        <CheckSquare size={16} className="toggle-checkbox fully-selected" />
      );
    }
    if (noneSelected) {
      return <Square size={16} className="toggle-checkbox" />;
    }
    return <Square size={16} className="toggle-checkbox partially-selected" />;
  };

  const getToggleAllTitle = () => {
    if (allSelected) return "Deseleccionar todos";
    if (noneSelected) return "Seleccionar todos";
  };

  const handleRegionClick = (region: string, langs: LanguageOption[]) => {
    if (onToggleRegion) {
      onToggleRegion(region, langs);
    }
  };

  const handleToggleAll = () => {
    if (allSelected) {
      AVAILABLE_LANGUAGES.forEach((lang) => {
        if (selectedLanguages.some((l) => l.id === lang.id)) {
          onToggleLanguage(lang);
        }
      });
    } else {
      AVAILABLE_LANGUAGES.forEach((lang) => {
        if (!selectedLanguages.some((l) => l.id === lang.id)) {
          onToggleLanguage(lang);
        }
      });
    }
  };

  const getDropdownTitle = () => {
    return showLanguages ? "Ocultar lista" : "Mostrar lista";
  };

  return (
    <div className="config-section">
      <div className="section-header">
        <h3>
          <Globe size={18} />
          IDIOMAS
          <span className="section-count">
            {selectedLanguages.length}/{totalLanguages}
          </span>
        </h3>
        <div className="section-actions">
          <button
            className="toggle-all-btn"
            onClick={handleToggleAll}
            title={getToggleAllTitle()}
          >
            {getToggleAllIcon()}
          </button>
          <button
            className="dropdown-toggle"
            onClick={() => setShowLanguages(!showLanguages)}
            title={getDropdownTitle()}
          >
            <ChevronDown size={16} className={showLanguages ? "open" : ""} />
          </button>
        </div>
      </div>

      {showLanguages && (
        <div className="dropdown-content">
          <div className="languages-list">
            {Object.entries(languagesByRegion).map(([region, langs]) => (
              <div key={region} className="region-group">
                <div className="region-header">
                  <button
                    className="region-selector"
                    onClick={() => handleRegionClick(region, langs)}
                    title={
                      isRegionFullySelected(region, langs)
                        ? `Deseleccionar todos los idiomas de ${region}`
                        : `Seleccionar todos los idiomas de ${region}`
                    }
                  >
                    {getRegionIcon(region, langs)}
                    <h4 className="region-title">{region}</h4>
                  </button>
                </div>
                {langs.map((lang) => {
                  const isSelected = selectedLanguages.some(
                    (l) => l.id === lang.id,
                  );
                  return (
                    <div
                      key={lang.id}
                      className={`priority-item language-option ${isSelected ? "selected" : ""}`}
                      onClick={() => onToggleLanguage(lang)}
                    >
                      <button
                        className="select-toggle"
                        onClick={(e) => {
                          e.stopPropagation();
                          onToggleLanguage(lang);
                        }}
                        title={isSelected ? "Deseleccionar" : "Seleccionar"}
                      >
                        {isSelected ? (
                          <CheckSquare size={16} />
                        ) : (
                          <Square size={16} />
                        )}
                      </button>
                      <span className="priority-text">
                        <strong>{lang.name}</strong>
                        <small>
                          {" "}
                          • {lang.code} • {lang.country}
                        </small>
                      </span>
                    </div>
                  );
                })}
              </div>
            ))}
          </div>
        </div>
      )}

      {selectedLanguages.length > 0 && (
        <div className="selected-language">
          <Globe size={16} />
          <strong>{selectedLanguages.length} idioma(s)</strong> seleccionado(s)
          <small>{selectedLanguages.map((l) => l.code).join(", ")}</small>
        </div>
      )}
    </div>
  );
};

export default LanguageSelector;
