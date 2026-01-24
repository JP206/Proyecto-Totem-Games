// src/renderer/src/pages/Landing.tsx
import React, { useState, useEffect } from "react";
import { useParams, useLocation, useNavigate } from "react-router-dom";
import DesktopManager from "../utils/desktop";
import {
  Upload,
  FileText,
  Globe,
  BookOpen,
  Layers,
  ChevronDown,
  Check,
  AlertCircle,
  ArrowLeft,
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
  const [targetLanguage, setTargetLanguage] = useState<Language | null>(null);
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
      } else {
        // Si no existe, verificar si hay algún archivo CSV en la carpeta Localizacion
        const localizarPath = `${repoPath}/Localizacion`;
        try {
          const localizarFiles = await desktop.readFolder(localizarPath);
          const csvFiles = localizarFiles.filter(f => f.isFile && f.name.endsWith('.csv'));
          if (csvFiles.length >= 0) {
            setSelectedFile(csvFiles[0]);
          }
        } catch (error) {
          console.log("No se encontró archivos CSV");
        }
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
            selected: true // Por defecto seleccionados
          }));
        
        setContextFiles(txtFiles);
      } catch {
        // Si no existe la carpeta, no hay contextos
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
        console.log("Glosary files:", glossaryFiles);
        const csvFiles = glossaryFiles
          .map((f, index) => ({
            name: f.name,
            path: f.path,
            priority: index + 1,
            selected: true // Por defecto seleccionados
          }));
        
        setGlossaryFiles(csvFiles);
      } catch {
        // Si no existe la carpeta, no hay glosarios
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
      
      if (!file.name.endsWith('.csv') && !file.name.endsWith('.xlsx')) {
        await DesktopManager.getInstance().showMessage(
          "Solo se aceptan archivos CSV o XLSX",
          "Formato inválido",
          "error"
        );
        return;
      }

      // Guardar localmente con la convención de nombres
      const fileName = file.name.endsWith('.csv') ? `${repoName}_localizar.csv` : `${repoName}_localizar.xlsx`;
      
      try {
        const desktop = DesktopManager.getInstance();
        
        // Aquí iría la lógica para guardar el archivo localmente
        // Por ahora solo mostramos el mensaje
        await desktop.showMessage(
          `Archivo ${fileName} listo para usar localmente\n(Se guardaría en: ${repoPath}/Localizacion/)`,
          "Archivo preparado"
        );
        
        // Simulamos que el archivo fue "subido"
        const newFile: FileItem = {
          name: fileName,
          path: `${repoPath}/Localizacion/${fileName}`,
          isFile: true,
          isDirectory: false
        };
        
        setSelectedFile(newFile);
        
      } catch (error: any) {
        await DesktopManager.getInstance().showMessage(
          error.message,
          "Error al procesar archivo",
          "error"
        );
      }
    }
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
      
      if (!file.name.endsWith('.csv') && !file.name.endsWith('.xlsx')) {
        await DesktopManager.getInstance().showMessage(
          "Solo se aceptan archivos CSV o XLSX",
          "Formato inválido",
          "error"
        );
        return;
      }

      // Simular el upload
      const fileName = file.name.endsWith('.csv') ? `${repoName}_localizar.csv` : `${repoName}_localizar.xlsx`;
      
      await DesktopManager.getInstance().showMessage(
        `Archivo ${fileName} dropeado y listo para usar localmente`,
        "Archivo recibido"
      );
      
      const newFile: FileItem = {
        name: fileName,
        path: `${repoPath}/Localizacion/${fileName}`,
        isFile: true,
        isDirectory: false
      };
      
      setSelectedFile(newFile);
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

    if (!targetLanguage) {
      await DesktopManager.getInstance().showMessage(
        "Por favor selecciona un idioma destino",
        "Idioma requerido",
        "warning"
      );
      return;
    }

    // Filtrar contextos seleccionados
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

    // Aquí iría la lógica para iniciar el proceso de localización
    const contextNames = selectedContexts.map(ctx => ctx.name).join(", ");
    const glossaryNames = selectedGlossaries.map(glos => glos.name).join(", ");
    
    await DesktopManager.getInstance().showMessage(
      `Iniciando localización de:\n` +
      `• Archivo: ${selectedFile.name}\n` +
      `• Idioma: ${targetLanguage.name}\n` +
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

  if (loading) {
    return (
      <div className="landing-loading">
        <div className="spinner-large" />
        <p>Cargando proyecto {repoName}...</p>
      </div>
    );
  }

  return (
    <div className="landing-container">
      {/* Header */}
      <div className="landing-header">
        <button 
          className="back-btn"
          onClick={() => navigate("/dashboard")}
        >
          <ArrowLeft size={20} />
          Volver al Dashboard
        </button>
        
        <div className="project-info">
          <h1 className="project-title">
            <FolderOpen size={24} />
            {repoName}
          </h1>
          <p className="project-path">
            <MapPin size={14} /> {repoPath}
          </p>
        </div>
        
        <div className="header-actions">
          <button className="header-btn active" title="Localizacion" onClick={() => window.location.reload()}>
            <Layers size={18} />
          </button>
          <button className="header-btn" title="Explorador proyectos">
            <Eye size={18} />
          </button>
          <button className="header-btn" title="Historial de cambios">
            <History size={18} />
          </button>
          <button className="header-btn" title="Notas rápidas">
            <MessageSquare size={18} />
          </button>
          <button className="header-btn" title="Reportes/Issues">
            <Flag size={18} />
          </button>
          <button className="header-btn" title="Configuración">
            <Settings size={18} />
          </button>
        </div>
      </div>

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

          {/* Sección 3: Selección de idioma */}
          <div className="config-section">
            <div className="section-header">
              <h3>
                <Globe size={18} />
                IDIOMA DESTINO
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
                      {langs.map((lang) => (
                        <div 
                          key={lang.id}
                          className={`language-option ${targetLanguage?.id === lang.id ? 'selected' : ''}`}
                          onClick={() => setTargetLanguage(lang)}
                        >
                          <div className="language-info">
                            {targetLanguage?.id === lang.id && <Check size={16} className="check-icon" />}
                            <span className="language-name">
                              <strong>{lang.name}</strong>
                              <small>{lang.code} • {lang.country}</small>
                            </span>
                          </div>
                        </div>
                      ))}
                    </div>
                  ))}
                </div>
              </div>
            )}
            
            {targetLanguage && (
              <div className="selected-language">
                <Globe size={16} />
                <strong>{targetLanguage.name}</strong> seleccionado
                <small>({targetLanguage.code})</small>
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
            <h3>Seleccione o arrastre el archivo de textos a localizar</h3>
            
            {selectedFile && (
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

          {/* Área de drop/upload */}
          <div 
            className={`drop-area ${selectedFile ? 'has-file' : ''}`}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
            onClick={() => !selectedFile && document.getElementById('file-upload')?.click()}
          >
            {!selectedFile ? (
              <>
                <Upload size={48} className="drop-icon" />
                <p>Arrastra tu archivo CSV/XLSX aquí o haz click para seleccionar</p>
                <small>
                  Se guardará localmente como: <code>{repoName}_localizar.csv</code>
                </small>
                
                <input
                  id="file-upload"
                  type="file"
                  accept=".csv,.xlsx"
                  onChange={handleFileUpload}
                  style={{ display: 'none' }}
                />
              </>
            ) : (
              <>
                <FileSpreadsheet size={64} className="file-icon" />
                <p className="file-ready">Archivo listo para localizar</p>
                <p className="file-note">
                  Se guarda localmente como: <strong>{selectedFile.name}</strong>
                </p>
                <button className="change-file-btn" onClick={() => setSelectedFile(null)}>
                  Cambiar archivo
                </button>
              </>
            )}
          </div>

          {/* Lista de archivos disponibles en el proyecto */}
          <div className="project-files">
            <h4>Archivos disponibles en el proyecto:</h4>
            <div className="files-grid">
              {projectFiles
                .filter(f => f.isFile && (f.name.endsWith('.csv') || f.name.endsWith('.xlsx')))
                .map((file, index) => (
                  <div 
                    key={index}
                    className={`file-item ${selectedFile?.path === file.path ? 'selected' : ''}`}
                    onClick={() => handleFileSelect(file)}
                  >
                    <FileSpreadsheet size={16} />
                    <span title={file.path}>{file.name}</span>
                    {selectedFile?.path === file.path && (
                      <Check size={16} className="check-icon" />
                    )}
                  </div>
                ))}
            </div>
            
            {projectFiles.filter(f => f.isFile && (f.name.endsWith('.csv') || f.name.endsWith('.xlsx'))).length === 0 && (
              <div className="no-files">
                <AlertCircle size={20} />
                <p>No se encontraron archivos CSV o XLSX en el proyecto</p>
                <p>Sube un archivo usando el área de arriba</p>
              </div>
            )}
          </div>

          {/* Botón de acción */}
          <div className="action-section">
            <button 
              className={`localize-btn ${selectedFile && targetLanguage ? 'active' : 'disabled'}`}
              onClick={startLocalization}
              disabled={!selectedFile || !targetLanguage}
            >
              <Download size={20} />
              {selectedFile && targetLanguage 
                ? `Iniciar Localización a ${targetLanguage.name}`
                : 'Selecciona archivo e idioma para continuar'
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
  );
};

export default Landing;