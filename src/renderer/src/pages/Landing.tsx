// src/renderer/src/pages/Landing.tsx
// src/renderer/src/pages/Landing.tsx
import React, { useState, useEffect } from "react";
import { useParams, useLocation, useNavigate } from "react-router-dom";
import DesktopManager from "../utils/desktop";
import Navbar from "../pages/Navbar";
import {
  Upload,
  FileText,
  Globe,
  BookOpen,
  Layers,
  ChevronDown,
  Check,
  AlertCircle,
  Download,
  Eye,
  History,
  MessageSquare,
  Flag,
  Settings,
  FileSpreadsheet,
  FolderOpen,
  X,
  MapPin,
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

type FileType = 'context' | 'glossary' | 'localize';

const Landing: React.FC = () => {
  const { projectName } = useParams<{ projectName: string }>();
  const location = useLocation();
  const navigate = useNavigate();
  const { repoPath, repoName } = location.state || {};
  
  const [projectFiles, setProjectFiles] = useState<FileItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  
  // Estados para la localización
  const [selectedFile, setSelectedFile] = useState<FileItem | null>(null);
  const [targetLanguages, setTargetLanguages] = useState<Language[]>([]);
  const [contextFiles, setContextFiles] = useState<ContextFile[]>([]);
  const [glossaryFiles, setGlossaryFiles] = useState<GlossaryFile[]>([]);
  const [availableLanguages, setAvailableLanguages] = useState<Language[]>([
    // Español por países
    { id: "es_uy", name: "Español (Uruguay)", code: "ES-UY", region: "América", country: "Uruguay" },
    { id: "es_ar", name: "Español (Argentina)", code: "ES-AR", region: "América", country: "Argentina" },
    { id: "es_mx", name: "Español (México)", code: "ES-MX", region: "América", country: "México" },
    { id: "es_es", name: "Español (España)", code: "ES-ES", region: "Europa", country: "España" },
    { id: "es_cl", name: "Español (Chile)", code: "ES-CL", region: "América", country: "Chile" },
    { id: "es_co", name: "Español (Colombia)", code: "ES-CO", region: "América", country: "Colombia" },
    { id: "es_pe", name: "Español (Perú)", code: "ES-PE", region: "América", country: "Perú" },
    
    // Otros idiomas
    { id: "en_us", name: "Inglés (Estados Unidos)", code: "EN-US", region: "América", country: "EE.UU." },
    { id: "en_gb", name: "Inglés (Reino Unido)", code: "EN-GB", region: "Europa", country: "Reino Unido" },
    { id: "de_de", name: "Alemán (Alemania)", code: "DE-DE", region: "Europa", country: "Alemania" },
    { id: "pt_br", name: "Portugués (Brasil)", code: "PT-BR", region: "América", country: "Brasil" },
    { id: "pt_pt", name: "Portugués (Portugal)", code: "PT-PT", region: "Europa", country: "Portugal" },
    { id: "fr_fr", name: "Francés (Francia)", code: "FR-FR", region: "Europa", country: "Francia" },
    { id: "ru_ru", name: "Ruso (Rusia)", code: "RU-RU", region: "Europa", country: "Rusia" },
    { id: "zh_tw", name: "Chino tradicional (Taiwán)", code: "ZH-TW", region: "Asia", country: "Taiwán" },
    { id: "ja_jp", name: "Japonés (Japón)", code: "JA-JP", region: "Asia", country: "Japón" },
    { id: "ko_kr", name: "Coreano (Corea del Sur)", code: "KO-KR", region: "Asia", country: "Corea del Sur" },
    { id: "it_it", name: "Italiano (Italia)", code: "IT-IT", region: "Europa", country: "Italia" },
    { id: "zh_cn", name: "Chino simplificado (China)", code: "ZH-CN", region: "Asia", country: "China" },
    { id: "tr_tr", name: "Turco (Turquía)", code: "TR-TR", region: "Asia", country: "Turquía" },
    { id: "id_id", name: "Indonesio (Indonesia)", code: "ID-ID", region: "Asia", country: "Indonesia" },
    { id: "ca_es", name: "Catalán (España)", code: "CA-ES", region: "Europa", country: "España" },
  ]);
  
  // Dropdown states
  const [showLanguages, setShowLanguages] = useState(false);
  const [showContexts, setShowContexts] = useState(false);
  const [showGlossaries, setShowGlossaries] = useState(false);
  
  // Estado para el tipo de archivo a subir
  const [uploadFileType, setUploadFileType] = useState<FileType>('localize');

  useEffect(() => {
    if (repoPath) {
      loadProjectStructure();
    }
  }, [repoPath]);

  const loadProjectStructure = async () => {
    try {
      setLoading(true);
      const desktop = DesktopManager.getInstance();
      
      // Leer estructura del repositorio
      const files = await desktop.readFolder(repoPath);
      setProjectFiles(files);
      
      // Buscar archivo CSV principal según convención
      const localizacionFileName = `${repoName}_localizar.csv`;
      const csvFile = files.find(f => 
        f.isFile && f.name.toLowerCase() === localizacionFileName.toLowerCase()
      );
      
      if (csvFile) {
        setSelectedFile(csvFile);
      }
      
      // Cargar contextos
      await loadContexts();
      
      // Cargar glosarios
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

  const handleFileSelect = (file: FileItem) => {
    if (file.isFile && (file.name.endsWith('.csv') || file.name.endsWith('.xlsx'))) {
      setSelectedFile(file);
    }
  };

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files;
    if (files && files.length > 0) {
      const file = files[0];
      
      let validExtensions = [];
      let targetFolder = '';
      let fileName = file.name;
      
      switch (uploadFileType) {
        case 'context':
          validExtensions = ['.txt'];
          targetFolder = `${repoPath}/Localizacion/contextos_especificos`;
          fileName = file.name.endsWith('.txt') ? file.name : `${file.name.split('.')[0]}.txt`;
          break;
        case 'glossary':
          validExtensions = ['.csv', '.xlsx'];
          targetFolder = `${repoPath}/Localizacion/glosarios_especificos`;
          break;
        case 'localize':
          validExtensions = ['.csv', '.xlsx'];
          targetFolder = `${repoPath}/Localizacion`;
          fileName = file.name.endsWith('.csv') ? `${repoName}_localizar.csv` : `${repoName}_localizar.xlsx`;
          break;
      }

      const fileExtension = file.name.substring(file.name.lastIndexOf('.')).toLowerCase();
      if (!validExtensions.includes(fileExtension)) {
        await DesktopManager.getInstance().showMessage(
          `Solo se aceptan archivos ${validExtensions.join(' o ')}`,
          "Formato inválido",
          "error"
        );
        return;
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
        
        // Actualizar las listas según el tipo
        if (uploadFileType === 'context') {
          setContextFiles(prev => [...prev, {
            name: fileName,
            path: newFile.path,
            priority: prev.length + 1,
            selected: true
          }]);
        } else if (uploadFileType === 'glossary') {
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
      
      // Simular el upload usando el tipo seleccionado
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
        "Por favor selecciona o sube un archivo CSV/XLSX para localizar",
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

    if (selectedContexts.length === 0 && contextFiles.length > 0) {
      await DesktopManager.getInstance().showMessage(
        "Por favor selecciona al menos un contexto o deselecciona todos si no quieres usar contextos",
        "Contextos requeridos",
        "warning"
      );
      return;
    }

    if (selectedGlossaries.length === 0 && glossaryFiles.length > 0) {
      await DesktopManager.getInstance().showMessage(
        "Por favor selecciona al menos un glosario o deselecciona todos si no quieres usar glosarios",
        "Glosarios requeridos",
        "warning"
      );
      return;
    }

    const languagesList = targetLanguages.map(lang => lang.name).join(", ");
    const contextNames = selectedContexts.map(ctx => ctx.name).join(", ");
    const glossaryNames = selectedGlossaries.map(glos => glos.name).join(", ");
    
    await DesktopManager.getInstance().showMessage(
      `Iniciando localización de:\n` +
      `• Archivo: ${selectedFile.name}\n` +
      `• Idiomas destino: ${languagesList}\n` +
      `• Contextos: ${selectedContexts.length > 0 ? contextNames : "Ninguno"}\n` +
      `• Glosarios: ${selectedGlossaries.length > 0 ? glossaryNames : "Ninguno"}\n\n` +
      `Nota: Los cambios se guardan localmente hasta que decidas subirlos al repositorio remoto.`,
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

  const getFileTypeIcon = () => {
    switch (uploadFileType) {
      case 'context':
        return <BookOpen size={20} />;
      case 'glossary':
        return <FileText size={20} />;
      case 'localize':
        return <FileSpreadsheet size={20} />;
    }
  };

  const getFileTypeText = () => {
    switch (uploadFileType) {
      case 'context':
        return 'Archivo de contexto (.txt)';
      case 'glossary':
        return 'Archivo de glosario (.csv/.xlsx)';
      case 'localize':
        return 'Archivo a localizar (.csv/.xlsx)';
    }
  };

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
      
      <div className="landing-container">
        <div className="landing-content">
          {/* Panel izquierdo - Configuración */}
          <div className="config-panel">
            <h2 className="panel-title">
              <Layers size={20} />
              Localizador
              <span className="panel-subtitle">Complete los campos para localizar los textos</span>
            </h2>

            {/* Sección 1: CONTEXTOS */}
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
                            title={ctx.selected ? "Deseleccionar" : "Seleccionar"}
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
                              title="Subir prioridad"
                            >
                              ↑
                            </button>
                            <button 
                              className="priority-btn"
                              onClick={() => moveContextDown(index)}
                              disabled={index === contextFiles.length - 1}
                              title="Bajar prioridad"
                            >
                              ↓
                            </button>
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

            {/* Sección 2: GLOSARIOS */}
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
                            title={glos.selected ? "Deseleccionar" : "Seleccionar"}
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
                              title="Subir prioridad"
                            >
                              ↑
                            </button>
                            <button 
                              className="priority-btn"
                              onClick={() => moveGlossaryDown(index)}
                              disabled={index === glossaryFiles.length - 1}
                              title="Bajar prioridad"
                            >
                              ↓
                            </button>
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

            {/* Sección 3: Selección de idiomas */}
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
                                {isSelected ? <CheckSquare size={16} className="check-icon" /> : <Square size={16} className="check-icon" />}
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

            {/* Notas informativas */}
            <div className="info-note">
              <AlertCircle size={16} />
              <span>Los archivos seleccionados se usarán en el orden de prioridad indicado</span>
            </div>
            
            <div className="info-note">
              <Check size={16} />
              <span>Puedes seleccionar/deseleccionar contextos y glosarios según necesites</span>
            </div>
          </div>

          {/* Panel derecho - Área de trabajo */}
          <div className="work-panel">
            <div className="work-header">
              <h3>Subir archivos al proyecto</h3>
              
              {selectedFile && uploadFileType === 'localize' && (
                <div className="selected-file-info">
                  <FileSpreadsheet size={20} />
                  <div>
                    <strong>{selectedFile.name}</strong>
                    <small>{selectedFile.path}</small>
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

            {/* Selector de tipo de archivo */}
            <div className="file-type-selector">
              <button 
                className={`file-type-btn ${uploadFileType === 'context' ? 'active' : ''}`}
                onClick={() => setUploadFileType('context')}
              >
                <BookOpen size={16} />
                Contexto
              </button>
              <button 
                className={`file-type-btn ${uploadFileType === 'glossary' ? 'active' : ''}`}
                onClick={() => setUploadFileType('glossary')}
              >
                <FileText size={16} />
                Glosario
              </button>
              <button 
                className={`file-type-btn ${uploadFileType === 'localize' ? 'active' : ''}`}
                onClick={() => setUploadFileType('localize')}
              >
                <FileSpreadsheet size={16} />
                Localizar
              </button>
            </div>

            {/* Área de drop/upload - ÚNICA */}
            <div 
              className={`drop-area ${uploadFileType === 'localize' && selectedFile ? 'has-file' : ''}`}
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onDrop={handleDrop}
              onClick={() => document.getElementById('file-upload')?.click()}
            >
              {getFileTypeIcon()}
              
              {uploadFileType === 'localize' && selectedFile ? (
                <>
                  <FileSpreadsheet size={64} className="file-icon" />
                  <p className="file-ready">Archivo listo para localizar</p>
                  <p className="file-note">
                    <strong>{selectedFile.name}</strong>
                  </p>
                  <button className="change-file-btn" onClick={(e) => {
                    e.stopPropagation();
                    setSelectedFile(null);
                  }}>
                    Cambiar archivo
                  </button>
                </>
              ) : (
                <>
                  <p className="drop-title">{getFileTypeText()}</p>
                  <p className="drop-description">
                    Arrastra tu archivo aquí o haz click para seleccionar
                  </p>
                  <small>
                    Se guardará en: {
                      uploadFileType === 'context' ? 'Localizacion/contextos_especificos/' :
                      uploadFileType === 'glossary' ? 'Localizacion/glosarios_especificos/' :
                      `Localizacion/ (como ${repoName}_localizar.*)`
                    }
                  </small>
                  
                  <input
                    id="file-upload"
                    type="file"
                    accept={
                      uploadFileType === 'context' ? '.txt' :
                      uploadFileType === 'glossary' ? '.csv,.xlsx' :
                      '.csv,.xlsx'
                    }
                    onChange={handleFileUpload}
                    style={{ display: 'none' }}
                  />
                </>
              )}
            </div>

            {/* Botón de acción */}
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
              
              <p className="action-note">
                <strong>Nota:</strong> Los cambios se guardan localmente. Para subirlos al repositorio remoto, 
                deberás hacerlo manualmente desde la sección de "Historial de cambios".
              </p>
            </div>
          </div>
        </div>
      </div>
    </>
  );
};

export default Landing;