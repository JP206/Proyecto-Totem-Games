// src/renderer/src/pages/Landing.tsx
import React, { useState, useEffect } from "react";
import { useParams, useLocation, useNavigate } from "react-router-dom";
import DesktopManager from "../utils/desktop";
import Navbar from "../pages/Navbar";
import {
  FileText,
  Globe,
  BookOpen,
  Layers,
  ChevronDown,
  Check,
  AlertCircle,
  Download,
  FileSpreadsheet,
  X,
  CheckSquare,
  Square
} from "lucide-react";
import "../styles/landing.css";

interface FileItem {
  name: string;
  path: string;
  isDirectory: boolean;
  isFile: boolean;
}

interface Language {
  id: string;
  name: string;
  code: string;
  region?: string;
  country?: string;
}

interface ContextFile {
  name: string;
  path: string;
  priority: number;
  selected: boolean;
}

interface GlossaryFile {
  name: string;
  path: string;
  priority: number;
  selected: boolean;
}

interface UploadPopupProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (type: 'context' | 'glossary' | 'localize') => void;
  fileName: string;
  fileExtension: string;
  repoName: string;
}

const UploadPopup: React.FC<UploadPopupProps> = ({ 
  isOpen, 
  onClose, 
  onConfirm, 
  fileName, 
  fileExtension,
  repoName 
}) => {
  if (!isOpen) return null;

  const isTxt = fileExtension === '.txt';
  const isCsvOrXlsx = ['.csv', '.xlsx'].includes(fileExtension);

  return (
    <div className="upload-popup-overlay" onClick={onClose}>
      <div className="upload-popup" onClick={e => e.stopPropagation()}>
        <button className="upload-popup-close" onClick={onClose}>×</button>
        
        <div className="upload-popup-header">
          {isTxt && <BookOpen size={24} className="popup-icon" />}
          {isCsvOrXlsx && <FileSpreadsheet size={24} className="popup-icon" />}
          <h3>¿Qué tipo de archivo es?</h3>
        </div>
        
        <p className="upload-popup-filename">
          <strong>{fileName}</strong>
        </p>
        
        <div className="upload-popup-options">
          {isTxt && (
            <button 
              className="upload-popup-btn context"
              onClick={() => onConfirm('context')}
            >
              <BookOpen size={20} />
              <div>
                <strong>Archivo de contexto</strong>
                <small>Se guardará en: Localizacion/contextos_especificos/</small>
              </div>
            </button>
          )}
          
          {isCsvOrXlsx && (
            <>
              <button 
                className="upload-popup-btn glossary"
                onClick={() => onConfirm('glossary')}
              >
                <FileText size={20} />
                <div>
                  <strong>Glosario</strong>
                  <small>Se guardará en: Localizacion/glosarios_especificos/</small>
                </div>
              </button>
              
              <button 
                className="upload-popup-btn localize"
                onClick={() => onConfirm('localize')}
              >
                <FileSpreadsheet size={20} />
                <div>
                  <strong>Archivo a localizar</strong>
                  <small>Se guardará como: {repoName}_localizar{fileExtension}</small>
                </div>
              </button>
            </>
          )}
        </div>
        
        {isTxt && (
          <p className="upload-popup-note">
            <AlertCircle size={14} />
            Los archivos .txt solo pueden ser contextos
          </p>
        )}
      </div>
    </div>
  );
};

const Landing: React.FC = () => {
  const { projectName } = useParams<{ projectName: string }>();
  const location = useLocation();
  const navigate = useNavigate();
  const { repoPath, repoName } = location.state || {};
  
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  
  // Estados para la localización
  const [selectedFile, setSelectedFile] = useState<FileItem | null>(null);
  const [targetLanguages, setTargetLanguages] = useState<Language[]>([]);
  const [contextFiles, setContextFiles] = useState<ContextFile[]>([]);
  const [glossaryFiles, setGlossaryFiles] = useState<GlossaryFile[]>([]);
  
  // Popup state
  const [showUploadPopup, setShowUploadPopup] = useState(false);
  const [pendingFile, setPendingFile] = useState<{ file: File; extension: string } | null>(null);
  
  const [availableLanguages, setAvailableLanguages] = useState<Language[]>([
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
  ]);
  
  // Dropdown states
  const [showLanguages, setShowLanguages] = useState(false);
  const [showContexts, setShowContexts] = useState(false);
  const [showGlossaries, setShowGlossaries] = useState(false);

  useEffect(() => {
    if (repoPath) {
      loadProjectStructure();
    }
  }, [repoPath]);

  const loadProjectStructure = async () => {
    try {
      setLoading(true);
      const desktop = DesktopManager.getInstance();
      
      const files = await desktop.readFolder(repoPath);
      
      const localizacionFileName = `${repoName}_localizar.csv`;
      const csvFile = files.find(f => 
        f.isFile && f.name.toLowerCase() === localizacionFileName.toLowerCase()
      );
      
      if (csvFile) {
        setSelectedFile(csvFile);
      }
      
      await loadContexts();
      await loadGlossaries();
      
    } catch (error: any) {
      setError(`Error cargando proyecto: ${error.message}`);
      await DesktopManager.getInstance().showMessage(
        error.message,
        "Error",
        "error"
      );
    } finally {
      setLoading(false);
    }
  };

  const loadContexts = async () => {
    try {
      const desktop = DesktopManager.getInstance();
      const contextPath = `${repoPath}/Localizacion/contextos_especificos`;
      
      try {
        const contextFiles = await desktop.readFolder(contextPath);
        const txtFiles = contextFiles
          .filter(f => f.isFile && f.name.endsWith('.txt'))
          .map((f, index) => ({
            name: f.name,
            path: f.path,
            priority: index + 1,
            selected: true
          }));
        
        setContextFiles(txtFiles);
      } catch {
        setContextFiles([]);
      }
    } catch (error) {
      console.error("Error cargando contextos:", error);
    }
  };

  const loadGlossaries = async () => {
    try {
      const desktop = DesktopManager.getInstance();
      const glossaryPath = `${repoPath}/Localizacion/glosarios_especificos`;
      
      try {
        const glossaryFiles = await desktop.readFolder(glossaryPath);
        const csvFiles = glossaryFiles
          .filter(f => f.isFile && (f.name.endsWith('.csv') || f.name.endsWith('.xlsx')))
          .map((f, index) => ({
            name: f.name,
            path: f.path,
            priority: index + 1,
            selected: true
          }));
        
        setGlossaryFiles(csvFiles);
      } catch {
        setGlossaryFiles([]);
      }
    } catch (error) {
      console.error("Error cargando glosarios:", error);
    }
  };

  const toggleContextSelection = (index: number) => {
    const newContexts = [...contextFiles];
    newContexts[index].selected = !newContexts[index].selected;
    setContextFiles(newContexts);
  };

  const toggleGlossarySelection = (index: number) => {
    const newGlossaries = [...glossaryFiles];
    newGlossaries[index].selected = !newGlossaries[index].selected;
    setGlossaryFiles(newGlossaries);
  };

  const moveContextUp = (index: number) => {
    if (index === 0) return;
    const newContexts = [...contextFiles];
    [newContexts[index], newContexts[index - 1]] = [newContexts[index - 1], newContexts[index]];
    newContexts.forEach((ctx, i) => ctx.priority = i + 1);
    setContextFiles(newContexts);
  };

  const moveContextDown = (index: number) => {
    if (index === contextFiles.length - 1) return;
    const newContexts = [...contextFiles];
    [newContexts[index], newContexts[index + 1]] = [newContexts[index + 1], newContexts[index]];
    newContexts.forEach((ctx, i) => ctx.priority = i + 1);
    setContextFiles(newContexts);
  };

  const moveGlossaryUp = (index: number) => {
    if (index === 0) return;
    const newGlossaries = [...glossaryFiles];
    [newGlossaries[index], newGlossaries[index - 1]] = [newGlossaries[index - 1], newGlossaries[index]];
    newGlossaries.forEach((glos, i) => glos.priority = i + 1);
    setGlossaryFiles(newGlossaries);
  };

  const moveGlossaryDown = (index: number) => {
    if (index === glossaryFiles.length - 1) return;
    const newGlossaries = [...glossaryFiles];
    [newGlossaries[index], newGlossaries[index + 1]] = [newGlossaries[index + 1], newGlossaries[index]];
    newGlossaries.forEach((glos, i) => glos.priority = i + 1);
    setGlossaryFiles(newGlossaries);
  };

  const processFileUpload = async (fileType: 'context' | 'glossary' | 'localize') => {
    if (!pendingFile) return;
    
    const { file } = pendingFile;
    
    let targetFolder = '';
    let fileName = file.name;
    
    switch (fileType) {
      case 'context':
        targetFolder = `${repoPath}/Localizacion/contextos_especificos`;
        fileName = file.name.endsWith('.txt') ? file.name : `${file.name.split('.')[0]}.txt`;
        break;
      case 'glossary':
        targetFolder = `${repoPath}/Localizacion/glosarios_especificos`;
        break;
      case 'localize':
        targetFolder = `${repoPath}/Localizacion`;
        fileName = file.name.endsWith('.csv') ? `${repoName}_localizar.csv` : `${repoName}_localizar.xlsx`;
        break;
    }

    try {
      const desktop = DesktopManager.getInstance();
      
      await desktop.showMessage(
        `Archivo ${fileName} subido correctamente a:\n${targetFolder}`,
        "Archivo guardado"
      );
      
      const newFile: FileItem = {
        name: fileName,
        path: `${targetFolder}/${fileName}`,
        isFile: true,
        isDirectory: false
      };
      
      if (fileType === 'context') {
        setContextFiles(prev => [...prev, {
          name: fileName,
          path: newFile.path,
          priority: prev.length + 1,
          selected: true
        }]);
      } else if (fileType === 'glossary') {
        setGlossaryFiles(prev => [...prev, {
          name: fileName,
          path: newFile.path,
          priority: prev.length + 1,
          selected: true
        }]);
      } else {
        setSelectedFile(newFile);
      }
      
    } catch (error: any) {
      await DesktopManager.getInstance().showMessage(
        error.message,
        "Error al procesar archivo",
        "error"
      );
    }
    
    setShowUploadPopup(false);
    setPendingFile(null);
  };

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files;
    if (files && files.length > 0) {
      const file = files[0];
      const fileExtension = file.name.substring(file.name.lastIndexOf('.')).toLowerCase();
      
      // Validar extensiones permitidas
      const validExtensions = ['.txt', '.csv', '.xlsx'];
      if (!validExtensions.includes(fileExtension)) {
        await DesktopManager.getInstance().showMessage(
          `Solo se aceptan archivos .txt, .csv o .xlsx`,
          "Formato inválido",
          "error"
        );
        return;
      }

      // Guardar archivo pendiente y mostrar popup
      setPendingFile({ file, extension: fileExtension });
      setShowUploadPopup(true);
      
      // Limpiar el input
      event.target.value = '';
    }
  };

  const toggleLanguage = (language: Language) => {
    setTargetLanguages(prev => {
      const isSelected = prev.some(lang => lang.id === language.id);
      if (isSelected) {
        return prev.filter(lang => lang.id !== language.id);
      } else {
        return [...prev, language];
      }
    });
  };

  const handleDragOver = (event: React.DragEvent) => {
    event.preventDefault();
    event.currentTarget.classList.add('drag-over');
  };

  const handleDragLeave = (event: React.DragEvent) => {
    event.preventDefault();
    event.currentTarget.classList.remove('drag-over');
  };

  const handleDrop = async (event: React.DragEvent) => {
    event.preventDefault();
    event.currentTarget.classList.remove('drag-over');
    
    const files = event.dataTransfer.files;
    if (files.length > 0) {
      const file = files[0];
      const fakeEvent = {
        target: {
          files: [file]
        }
      } as any;
      
      await handleFileUpload(fakeEvent);
    }
  };

  const startLocalization = async () => {
    if (!selectedFile) {
      await DesktopManager.getInstance().showMessage(
        "Por favor sube un archivo CSV/XLSX para localizar",
        "Archivo requerido",
        "warning"
      );
      return;
    }

    if (targetLanguages.length === 0) {
      await DesktopManager.getInstance().showMessage(
        "Por favor selecciona al menos un idioma destino",
        "Idioma requerido",
        "warning"
      );
      return;
    }

    const selectedContexts = contextFiles.filter(ctx => ctx.selected);
    const selectedGlossaries = glossaryFiles.filter(glos => glos.selected);

    await DesktopManager.getInstance().showMessage(
      `Iniciando localización de:\n` +
      `• Archivo: ${selectedFile.name}\n` +
      `• Idiomas destino: ${targetLanguages.map(lang => lang.name).join(", ")}\n` +
      `• Contextos: ${selectedContexts.length > 0 ? selectedContexts.map(ctx => ctx.name).join(", ") : "Ninguno"}\n` +
      `• Glosarios: ${selectedGlossaries.length > 0 ? selectedGlossaries.map(glos => glos.name).join(", ") : "Ninguno"}\n\n`,
      "Proceso de localización iniciado"
    );
  };

  const languagesByRegion = availableLanguages.reduce((acc, lang) => {
    if (!acc[lang.region!]) {
      acc[lang.region!] = [];
    }
    acc[lang.region!].push(lang);
    return acc;
  }, {} as Record<string, Language[]>);

  if (loading) {
    return (
      <>
        <Navbar repoName={repoName} repoPath={repoPath} />
        <div className="landing-loading">
          <div className="spinner-large" />
          <p>Cargando proyecto {repoName}...</p>
        </div>
      </>
    );
  }

  return (
    <>
      <Navbar repoName={repoName} repoPath={repoPath} />
      
      <UploadPopup
        isOpen={showUploadPopup}
        onClose={() => {
          setShowUploadPopup(false);
          setPendingFile(null);
        }}
        onConfirm={processFileUpload}
        fileName={pendingFile?.file.name || ''}
        fileExtension={pendingFile?.extension || ''}
        repoName={repoName || ''}
      />
      
      <div className="landing-container">
        <div className="landing-content">
          {/* Panel izquierdo - Configuración */}
          <div className="config-panel">
            <h2 className="panel-title">
              <Layers size={20} />
              Localizador
              <span className="panel-subtitle">Complete los campos para localizar los textos</span>
            </h2>

            {/* Sección CONTEXTOS */}
            <div className="config-section">
              <div className="section-header">
                <h3>
                  <BookOpen size={18} />
                  CONTEXTOS
                  <span className="section-count">
                    {contextFiles.filter(ctx => ctx.selected).length}/{contextFiles.length}
                  </span>
                </h3>
                <button 
                  className="dropdown-toggle"
                  onClick={() => setShowContexts(!showContexts)}
                >
                  <ChevronDown size={16} className={showContexts ? "open" : ""} />
                </button>
              </div>
              
              {showContexts && (
                <div className="dropdown-content">
                  {contextFiles.length > 0 ? (
                    <div className="priority-list">
                      {contextFiles.map((ctx, index) => (
                        <div key={index} className="priority-item">
                          <button 
                            className="select-toggle"
                            onClick={() => toggleContextSelection(index)}
                          >
                            {ctx.selected ? <CheckSquare size={16} /> : <Square size={16} />}
                          </button>
                          <span className="priority-badge">#{ctx.priority}</span>
                          <span className="priority-text" title={ctx.path}>
                            {ctx.name}
                          </span>
                          <div className="priority-controls">
                            <button 
                              className="priority-btn"
                              onClick={() => moveContextUp(index)}
                              disabled={index === 0}
                            >↑</button>
                            <button 
                              className="priority-btn"
                              onClick={() => moveContextDown(index)}
                              disabled={index === contextFiles.length - 1}
                            >↓</button>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="empty-dropdown">
                      <AlertCircle size={16} />
                      No hay archivos de contexto disponibles
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Sección GLOSARIOS */}
            <div className="config-section">
              <div className="section-header">
                <h3>
                  <FileText size={18} />
                  GLOSARIOS
                  <span className="section-count">
                    {glossaryFiles.filter(glos => glos.selected).length}/{glossaryFiles.length}
                  </span>
                </h3>
                <button 
                  className="dropdown-toggle"
                  onClick={() => setShowGlossaries(!showGlossaries)}
                >
                  <ChevronDown size={16} className={showGlossaries ? "open" : ""} />
                </button>
              </div>
              
              {showGlossaries && (
                <div className="dropdown-content">
                  {glossaryFiles.length > 0 ? (
                    <div className="priority-list">
                      {glossaryFiles.map((glos, index) => (
                        <div key={index} className="priority-item">
                          <button 
                            className="select-toggle"
                            onClick={() => toggleGlossarySelection(index)}
                          >
                            {glos.selected ? <CheckSquare size={16} /> : <Square size={16} />}
                          </button>
                          <span className="priority-badge">#{glos.priority}</span>
                          <span className="priority-text" title={glos.path}>
                            {glos.name}
                          </span>
                          <div className="priority-controls">
                            <button 
                              className="priority-btn"
                              onClick={() => moveGlossaryUp(index)}
                              disabled={index === 0}
                            >↑</button>
                            <button 
                              className="priority-btn"
                              onClick={() => moveGlossaryDown(index)}
                              disabled={index === glossaryFiles.length - 1}
                            >↓</button>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="empty-dropdown">
                      <AlertCircle size={16} />
                      No hay archivos de glosario disponibles
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Sección IDIOMAS */}
            <div className="config-section">
              <div className="section-header">
                <h3>
                  <Globe size={18} />
                  IDIOMAS DESTINO
                  <span className="section-count">
                    {targetLanguages.length} seleccionados
                  </span>
                </h3>
                <button 
                  className="dropdown-toggle"
                  onClick={() => setShowLanguages(!showLanguages)}
                >
                  <ChevronDown size={16} className={showLanguages ? "open" : ""} />
                </button>
              </div>
              
              {showLanguages && (
                <div className="dropdown-content">
                  <div className="languages-list">
                    {Object.entries(languagesByRegion).map(([region, langs]) => (
                      <div key={region} className="region-group">
                        <h4 className="region-title">{region}</h4>
                        {langs.map((lang) => {
                          const isSelected = targetLanguages.some(l => l.id === lang.id);
                          return (
                            <div 
                              key={lang.id}
                              className={`language-option ${isSelected ? 'selected' : ''}`}
                              onClick={() => toggleLanguage(lang)}
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
              
              {targetLanguages.length > 0 && (
                <div className="selected-language">
                  <Globe size={16} />
                  <strong>{targetLanguages.length} idioma(s)</strong> seleccionado(s)
                  <small>{targetLanguages.map(l => l.code).join(", ")}</small>
                </div>
              )}
            </div>

            <div className="info-note">
              <AlertCircle size={16} />
              <span>Los archivos seleccionados se usarán en el orden de prioridad indicado</span>
            </div>
            
            <div className="info-note">
              <Check size={16} />
              <span>Puedes seleccionar/deseleccionar según necesites</span>
            </div>
          </div>

          {/* Panel derecho - Área de trabajo - UNA SOLA ÁREA DE SUBIDA */}
          <div className="work-panel">
            <div className="work-header">
              <h3>Subir archivos al proyecto</h3>
              
              {selectedFile && (
                <div className="selected-file-info">
                  <FileSpreadsheet size={20} />
                  <div>
                    <strong>Archivo a localizar:</strong>
                    <small>{selectedFile.name}</small>
                  </div>
                  <button 
                    className="clear-btn"
                    onClick={() => setSelectedFile(null)}
                    title="Quitar archivo"
                  >
                    <X size={16} />
                  </button>
                </div>
              )}
            </div>

            {/* Única área de drop/upload */}
            <div 
              className="drop-area unified"
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onDrop={handleDrop}
              onClick={() => document.getElementById('file-upload')?.click()}
            >
              <div className="drop-icon">
                <FileSpreadsheet size={48} />
                <FileText size={48} style={{ marginLeft: -20 }} />
                <BookOpen size={48} style={{ marginLeft: -20 }} />
              </div>
              
              <p className="drop-title">
                Arrastra cualquier archivo o haz click para subir
              </p>
              <p className="drop-description">
                .txt para contextos • .csv o .xlsx para glosarios o archivo a localizar
              </p>
              
              <input
                id="file-upload"
                type="file"
                accept=".txt,.csv,.xlsx"
                onChange={handleFileUpload}
                style={{ display: 'none' }}
              />
            </div>

            <div className="action-section">
              <button 
                className={`localize-btn ${selectedFile && targetLanguages.length > 0 ? 'active' : 'disabled'}`}
                onClick={startLocalization}
                disabled={!selectedFile || targetLanguages.length === 0}
              >
                <Download size={20} />
                {selectedFile && targetLanguages.length > 0 
                  ? `Iniciar Localización (${targetLanguages.length} idioma${targetLanguages.length > 1 ? 's' : ''})`
                  : 'Selecciona archivo e idiomas para continuar'
                }
              </button>
            </div>
          </div>
        </div>
      </div>
    </>
  );
};

export default Landing;