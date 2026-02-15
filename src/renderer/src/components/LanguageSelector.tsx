// src/renderer/src/components/LanguageSelector.tsx
import React, { useState } from "react";
import { CheckSquare, Square, ChevronDown, Globe } from "lucide-react";

interface Language {
  id: string;
  name: string;
  code: string;
  region?: string;
  country?: string;
}

interface LanguageSelectorProps {
  selectedLanguages: Language[];
  onToggleLanguage: (language: Language) => void;
  onToggleRegion?: (region: string, languages: Language[]) => void;
}

const AVAILABLE_LANGUAGES: Language[] = [
  // ESPAÑOL
  { id: "es_uy", name: "Español (Uruguay)", code: "ES-UY", region: "América", country: "Uruguay" },
  { id: "es_es", name: "Español (España)", code: "ES-ES", region: "Europa", country: "España" },
  { id: "es_mx", name: "Español (México)", code: "ES-MX", region: "América", country: "México" },
  { id: "es_ar", name: "Español (Argentina)", code: "ES-AR", region: "América", country: "Argentina" },
  { id: "es_co", name: "Español (Colombia)", code: "ES-CO", region: "América", country: "Colombia" },
  { id: "es_cl", name: "Español (Chile)", code: "ES-CL", region: "América", country: "Chile" },

  // INGLÉS
  { id: "en_us", name: "Inglés (Estados Unidos)", code: "EN-US", region: "América", country: "EE.UU." },
  { id: "en_gb", name: "Inglés (Reino Unido)", code: "EN-GB", region: "Europa", country: "Reino Unido" },
  { id: "en_au", name: "Inglés (Australia)", code: "EN-AU", region: "Oceanía", country: "Australia" },

  // ALEMÁN
  { id: "de_de", name: "Alemán (Alemania)", code: "DE-DE", region: "Europa", country: "Alemania" },

  // PORTUGUÉS
  { id: "pt_br", name: "Portugués (Brasil)", code: "PT-BR", region: "América", country: "Brasil" },
  { id: "pt_pt", name: "Portugués (Portugal)", code: "PT-PT", region: "Europa", country: "Portugal" },

  // FRANCÉS
  { id: "fr_fr", name: "Francés (Francia)", code: "FR-FR", region: "Europa", country: "Francia" },
  { id: "fr_ca", name: "Francés (Canadá)", code: "FR-CA", region: "América", country: "Canadá" },

  // RUSO
  { id: "ru_ru", name: "Ruso (Rusia)", code: "RU-RU", region: "Europa", country: "Rusia" },

  // CHINO TRADICIONAL
  { id: "zh_tw", name: "Chino tradicional (Taiwán)", code: "ZH-TW", region: "Asia", country: "Taiwán" },

  // CHINO SIMPLIFICADO
  { id: "zh_cn", name: "Chino simplificado (China)", code: "ZH-CN", region: "Asia", country: "China" },

  // JAPONÉS
  { id: "ja_jp", name: "Japonés (Japón)", code: "JA-JP", region: "Asia", country: "Japón" },

  // COREANO
  { id: "ko_kr", name: "Coreano (Corea del Sur)", code: "KO-KR", region: "Asia", country: "Corea del Sur" },

  // ITALIANO
  { id: "it_it", name: "Italiano (Italia)", code: "IT-IT", region: "Europa", country: "Italia" },

  // TURCO
  { id: "tr_tr", name: "Turco (Turquía)", code: "TR-TR", region: "Asia", country: "Turquía" },

  // INDONESIO
  { id: "id_id", name: "Indonesio (Indonesia)", code: "ID-ID", region: "Asia", country: "Indonesia" },

  // CATALÁN
  { id: "ca_es", name: "Catalán (España)", code: "CA-ES", region: "Europa", country: "España" },
];

const LanguageSelector: React.FC<LanguageSelectorProps> = ({ 
  selectedLanguages, 
  onToggleLanguage,
  onToggleRegion
}) => {
  const [showLanguages, setShowLanguages] = useState(false);

  const languagesByRegion = AVAILABLE_LANGUAGES.reduce((acc, lang) => {
    if (!acc[lang.region!]) {
      acc[lang.region!] = [];
    }
    acc[lang.region!].push(lang);
    return acc;
  }, {} as Record<string, Language[]>);

  const totalLanguages = AVAILABLE_LANGUAGES.length;
  const allSelected = selectedLanguages.length === totalLanguages;
  const noneSelected = selectedLanguages.length === 0;

  const isRegionFullySelected = (region: string, langs: Language[]): boolean => {
    return langs.every(lang => selectedLanguages.some(l => l.id === lang.id));
  };

  const isRegionPartiallySelected = (region: string, langs: Language[]): boolean => {
    const selectedCount = langs.filter(lang => 
      selectedLanguages.some(l => l.id === lang.id)
    ).length;
    return selectedCount > 0 && selectedCount < langs.length;
  };

  const getRegionIcon = (region: string, langs: Language[]) => {
    if (isRegionFullySelected(region, langs)) {
      return <CheckSquare size={16} className="region-checkbox fully-selected" />;
    }
    if (isRegionPartiallySelected(region, langs)) {
      return <Square size={16} className="region-checkbox partially-selected" />;
    }
    return <Square size={16} className="region-checkbox" />;
  };

  const getToggleAllIcon = () => {
    if (allSelected) {
      return <CheckSquare size={16} className="toggle-checkbox fully-selected" />;
    }
    if (noneSelected) {
      return <Square size={16} className="toggle-checkbox" />;
    }
    return <Square size={16} className="toggle-checkbox partially-selected" />;
  };

  const handleRegionClick = (region: string, langs: Language[]) => {
    if (onToggleRegion) {
      onToggleRegion(region, langs);
    }
  };

  const handleToggleAll = () => {
    if (allSelected) {
      // Si todos están seleccionados, deseleccionar todos
      AVAILABLE_LANGUAGES.forEach(lang => {
        if (selectedLanguages.some(l => l.id === lang.id)) {
          onToggleLanguage(lang);
        }
      });
    } else {
      // Si no, seleccionar todos los que no están seleccionados
      AVAILABLE_LANGUAGES.forEach(lang => {
        if (!selectedLanguages.some(l => l.id === lang.id)) {
          onToggleLanguage(lang);
        }
      });
    }
  };

  return (
    <div className="config-section">
      <div className="section-header">
        <h3>
          <Globe size={18} />
          IDIOMAS DESTINO
          <span className="section-count">
            {selectedLanguages.length} seleccionados
          </span>
        </h3>
        <div className="section-actions">
          {/* Botón único que cambia según el estado */}
          <button 
            className="toggle-all-btn"
            onClick={handleToggleAll}
            title={allSelected ? "Deseleccionar todos" : "Seleccionar todos"}
          >
            {getToggleAllIcon()}
          </button>
          <button 
            className="dropdown-toggle"
            onClick={() => setShowLanguages(!showLanguages)}
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
                  >
                    {getRegionIcon(region, langs)}
                    <h4 className="region-title">{region}</h4>
                  </button>
                </div>
                {langs.map((lang) => {
                  const isSelected = selectedLanguages.some(l => l.id === lang.id);
                  return (
                    <div 
                      key={lang.id}
                      className={`language-option ${isSelected ? 'selected' : ''}`}
                      onClick={() => onToggleLanguage(lang)}
                    >
                      <div className="language-info">
                        {isSelected ? <CheckSquare size={16} /> : <Square size={16} />}
                        <span className="language-name">
                          <strong>{lang.name}</strong>
                          <small>{lang.code} • {lang.country}</small>
                        </span>
                      </div>
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
          <small>{selectedLanguages.map(l => l.code).join(", ")}</small>
        </div>
      )}
    </div>
  );
};

export default LanguageSelector;