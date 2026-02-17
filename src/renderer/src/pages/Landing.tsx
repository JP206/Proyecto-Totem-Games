// src/renderer/src/pages/Landing.tsx
import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import DesktopManager from "../utils/desktop";
import Navbar from "../components/Navbar";
import LanguageSelector from "../components/LanguageSelector";
import UploadPopup from "../components/UploadPopup";
import {
  FileText,
  BookOpen,
  Layers,
  AlertCircle,
  Download,
  FileSpreadsheet,
  X,
  CheckSquare,
  Square,
  ChevronDown
} from "lucide-react";
import "../styles/landing.css";

interface FileItem {
  name: string;
  path: string;
  isDirectory: boolean;
  isFile: boolean;
}

interface ContextFile {
  name: string;
  path: string;
  priority: number;
  selected: boolean;
}

interface Language {
  id: string;
  name: string;
  code: string;
  region?: string;
  country?: string;
}

const Landing: React.FC = () => {
  const navigate = useNavigate();
  
  const [repoPath, setRepoPath] = useState<string>("");
  const [repoName, setRepoName] = useState<string>("");
  const [loading, setLoading] = useState(true);
  const [selectedFile, setSelectedFile] = useState<FileItem | null>(null);
  const [targetLanguages, setTargetLanguages] = useState<Language[]>([]);
  const [contextFiles, setContextFiles] = useState<ContextFile[]>([]);
  const [glossaryFiles, setGlossaryFiles] = useState<ContextFile[]>([]);
  
  // UI states
  const [showContexts, setShowContexts] = useState(false);
  const [showGlossaries, setShowGlossaries] = useState(false);
  const [showUploadPopup, setShowUploadPopup] = useState(false);
  const [pendingFile, setPendingFile] = useState<{ file: File; extension: string } | null>(null);
  
  useEffect(() => {
    loadProjectFromStore();
  }, []);

  const loadProjectFromStore = async () => {
    try {
      setLoading(true);
      const desktop = DesktopManager.getInstance();
      
      // Cargar proyecto directamente del store
      const project = await desktop.getConfig("current_project");
      
      if (!project?.repoPath || !project?.repoName) {
        await desktop.showMessage(
          "No hay un proyecto seleccionado",
          "Error",
          "error"
        );
        navigate('/dashboard');
        return;
      }

      setRepoPath(project.repoPath);
      setRepoName(project.repoName);

      await loadProjectStructure(project.repoPath, project.repoName);
      
    } catch (error: any) {
      const desktop = DesktopManager.getInstance();
      await desktop.showMessage(error.message, "Error", "error");
      navigate('/dashboard');
    } finally {
      setLoading(false);
    }
  };

  const loadProjectStructure = async (path: string, name: string) => {
    try {
      const desktop = DesktopManager.getInstance();
      
      // Cargar archivo a localizar
      try {
        const files = await desktop.readFolder(`${path}/Localizacion`);
        const csvFile = files.find(f => f.isFile && f.name === `${name}_localizar.csv`);
        const xlsxFile = files.find(f => f.isFile && f.name === `${name}_localizar.xlsx`);
        setSelectedFile(csvFile || xlsxFile || null);
      } catch {
        console.log("Carpeta Localizacion no encontrada");
      }
      
      await Promise.all([
        loadContexts(path),
        loadGlossaries(path)
      ]);
    } catch (error) {
      console.error("Error cargando estructura:", error);
    }
  };

  const loadContexts = async (basePath: string) => {
    try {
      const desktop = DesktopManager.getInstance();
      const files = await desktop.readFolder(
        `${basePath}/Localizacion/contextos_especificos`
      );
      setContextFiles(
        files
          .filter(f => f.isFile && f.name.endsWith('.txt'))
          .map((f, i) => ({ 
            name: f.name, 
            path: f.path, 
            priority: i + 1, 
            selected: true 
          }))
      );
    } catch {
      setContextFiles([]);
    }
  };

  const loadGlossaries = async (basePath: string) => {
    try {
      const desktop = DesktopManager.getInstance();
      const files = await desktop.readFolder(
        `${basePath}/Localizacion/glosarios_especificos`
      );
      setGlossaryFiles(
        files
          .filter(f => f.isFile && (f.name.endsWith('.csv') || f.name.endsWith('.xlsx')))
          .map((f, i) => ({ 
            name: f.name, 
            path: f.path, 
            priority: i + 1, 
            selected: true 
          }))
      );
    } catch {
      setGlossaryFiles([]);
    }
  };

  // Handlers genéricos para listas
  const toggleSelection = (files: ContextFile[], setFiles: Function, index: number) => {
    const newFiles = [...files];
    newFiles[index].selected = !newFiles[index].selected;
    setFiles(newFiles);
  };

  const toggleAll = (files: ContextFile[], setFiles: Function) => {
    const allSelected = files.every(f => f.selected);
    setFiles(files.map(f => ({ ...f, selected: !allSelected })));
  };

  const moveItem = (files: ContextFile[], setFiles: Function, index: number, direction: 'up' | 'down') => {
    if ((direction === 'up' && index === 0) || (direction === 'down' && index === files.length - 1)) return;
    const newFiles = [...files];
    const swapIndex = direction === 'up' ? index - 1 : index + 1;
    [newFiles[index], newFiles[swapIndex]] = [newFiles[swapIndex], newFiles[index]];
    newFiles.forEach((f, i) => f.priority = i + 1);
    setFiles(newFiles);
  };

  // Upload handlers
  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    
    const ext = file.name.substring(file.name.lastIndexOf('.')).toLowerCase();
    if (!['.txt', '.csv', '.xlsx'].includes(ext)) {
      const desktop = DesktopManager.getInstance();
      await desktop.showMessage(
        "Formato no válido. Solo se permiten archivos .txt, .csv o .xlsx",
        "Error",
        "error"
      );
      return;
    }
    
    setPendingFile({ file, extension: ext });
    setShowUploadPopup(true);
    e.target.value = '';
  };

  const processFileUpload = async (type: 'context' | 'glossary' | 'localize') => {
    if (!pendingFile || !repoPath || !repoName) return;
    
    const { file } = pendingFile;
    const desktop = DesktopManager.getInstance();
    const ext = file.name.substring(file.name.lastIndexOf('.')).toLowerCase();
    
    try {
      let targetFolder = '', fileName = '', finalPath = '';
      
      switch (type) {
        case 'context':
          targetFolder = `${repoPath}/Localizacion/contextos_especificos`;
          fileName = file.name.endsWith('.txt') ? file.name : `${file.name.split('.')[0]}.txt`;
          finalPath = `${targetFolder}/${fileName}`;
          await desktop.saveFile(file, finalPath);
          setContextFiles(prev => [...prev, { 
            name: fileName, 
            path: finalPath, 
            priority: prev.length + 1, 
            selected: true 
          }]);
          break;
          
        case 'glossary':
          targetFolder = `${repoPath}/Localizacion/glosarios_especificos`;
          fileName = file.name;
          finalPath = `${targetFolder}/${fileName}`;
          await desktop.saveFile(file, finalPath);
          setGlossaryFiles(prev => [...prev, { 
            name: fileName, 
            path: finalPath, 
            priority: prev.length + 1, 
            selected: true 
          }]);
          break;
          
        case 'localize':
          targetFolder = `${repoPath}/Localizacion`;
          fileName = `${repoName}_localizar${ext}`;
          finalPath = `${targetFolder}/${fileName}`;
          
          if (selectedFile) {
            await desktop.deleteFile(selectedFile.path);
          }
          
          await desktop.saveFile(file, finalPath);
          setSelectedFile({ 
            name: fileName, 
            path: finalPath, 
            isFile: true, 
            isDirectory: false 
          });
          break;
      }
      
      await desktop.showMessage(
        `Archivo guardado exitosamente en ${targetFolder}`,
        "Éxito",
        "info"
      );
    } catch (error: any) {
      await desktop.showMessage(error.message, "Error", "error");
    }
    
    setShowUploadPopup(false);
    setPendingFile(null);
  };

  // Language handlers
  const toggleLanguage = (lang: Language) => {
    setTargetLanguages(prev => 
      prev.some(l => l.id === lang.id)
        ? prev.filter(l => l.id !== lang.id)
        : [...prev, lang]
    );
  };

  const toggleRegion = (region: string, languages: Language[]) => {
    const regionIds = languages.map(l => l.id);
    const allSelected = regionIds.every(id => targetLanguages.some(l => l.id === id));
    
    setTargetLanguages(prev => 
      allSelected
        ? prev.filter(l => !regionIds.includes(l.id))
        : [...prev, ...languages.filter(l => !prev.some(p => p.id === l.id))]
    );
  };

  // Action handler
  const startLocalization = async () => {
    if (!selectedFile) {
      const desktop = DesktopManager.getInstance();
      await desktop.showMessage(
        "Por favor sube un archivo CSV o XLSX para localizar",
        "Archivo requerido",
        "warning"
      );
      return;
    }

    if (targetLanguages.length === 0) {
      const desktop = DesktopManager.getInstance();
      await desktop.showMessage(
        "Por favor selecciona al menos un idioma destino",
        "Idioma requerido",
        "warning"
      );
      return;
    }

    const selectedContexts = contextFiles.filter(ctx => ctx.selected);
    const selectedGlossaries = glossaryFiles.filter(glos => glos.selected);

    const desktop = DesktopManager.getInstance();
    await desktop.showMessage(
      `Iniciando localización de:\n` +
      `• Archivo: ${selectedFile.name}\n` +
      `• Idiomas destino: ${targetLanguages.map(lang => lang.name).join(", ")}\n` +
      `• Contextos: ${selectedContexts.length > 0 ? selectedContexts.map(ctx => ctx.name).join(", ") : "Ninguno"}\n` +
      `• Glosarios: ${selectedGlossaries.length > 0 ? selectedGlossaries.map(glos => glos.name).join(", ") : "Ninguno"}`,
      "Proceso de localización iniciado",
      "info"
    );
  };

  // UI Helpers
  const getToggleIcon = (files: ContextFile[]) => {
    if (!files.length) return null;
    const allSelected = files.every(f => f.selected);
    const noneSelected = files.every(f => !f.selected);
    
    if (allSelected) return <CheckSquare size={16} className="toggle-checkbox fully-selected" />;
    if (noneSelected) return <Square size={16} className="toggle-checkbox" />;
    return <Square size={16} className="toggle-checkbox partially-selected" />;
  };

  const removeSelectedFile = async () => {
    if (selectedFile) {
      const desktop = DesktopManager.getInstance();
      try {
        await desktop.deleteFile(selectedFile.path);
        setSelectedFile(null);
      } catch (error: any) {
        await desktop.showMessage(error.message, "Error", "error");
      }
    }
  };

  if (loading) {
    return (
      <>
        <Navbar />
        <div className="landing-loading">
          <div className="spinner-large" />
          <p>Cargando proyecto...</p>
        </div>
      </>
    );
  }

  const renderFileList = (
    title: string,
    icon: React.ElementType,
    files: ContextFile[],
    show: boolean,
    setShow: React.Dispatch<React.SetStateAction<boolean>>,
    toggleItem: (index: number) => void,
    toggleAllFn: () => void,
    moveUp: (index: number) => void,
    moveDown: (index: number) => void
  ) => (
    <div className="config-section">
      <div className="section-header">
        <h3>
          {React.createElement(icon, { size: 18 })}
          {title}
          <span className="section-count">{files.filter(f => f.selected).length}/{files.length}</span>
        </h3>
        <div className="section-actions">
          {files.length > 0 && (
            <button 
              className="toggle-all-btn" 
              onClick={toggleAllFn} 
              title={
                files.every(f => f.selected) ? "Deseleccionar todos" : 
                files.some(f => f.selected) ? "Seleccionar todos" : 
                "Seleccionar todos"
              }
            >
              {getToggleIcon(files)}
            </button>
          )}
          <button className="dropdown-toggle" onClick={() => setShow(!show)} title={show ? "Ocultar lista" : "Mostrar lista"}>
            <ChevronDown size={16} className={show ? "open" : ""} />
          </button>
        </div>
      </div>
      
      {show && (
        <div className="dropdown-content">
          {files.length > 0 ? (
            <div className="priority-list">
              {files.map((file, idx) => (
                <div key={idx} className="priority-item">
                  <button 
                    className="select-toggle" 
                    onClick={() => toggleItem(idx)}
                    title={file.selected ? "Deseleccionar" : "Seleccionar"}
                  >
                    {file.selected ? <CheckSquare size={16} /> : <Square size={16} />}
                  </button>
                  <span className="priority-badge">{file.priority}</span>
                  <span className="priority-text">{file.name}</span>
                  <div className="priority-controls">
                    <button 
                      className="priority-btn" 
                      onClick={() => moveUp(idx)} 
                      disabled={idx === 0}
                      title="Subir prioridad"
                    >
                      ↑
                    </button>
                    <button 
                      className="priority-btn" 
                      onClick={() => moveDown(idx)} 
                      disabled={idx === files.length - 1}
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
              No hay archivos disponibles
            </div>
          )}
        </div>
      )}
    </div>
  );

  return (
    <>
      <Navbar />
      
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
          {/* Panel izquierdo */}
          <div className="config-panel">
            <h2 className="panel-title">
              <Layers size={20} />
              Localizador
              <span className="panel-subtitle">Complete los campos para localizar los textos</span>
            </h2>

            {renderFileList(
              "CONTEXTOS", 
              BookOpen,
              contextFiles, 
              showContexts, 
              setShowContexts,
              (i: number) => toggleSelection(contextFiles, setContextFiles, i),
              () => toggleAll(contextFiles, setContextFiles),
              (i: number) => moveItem(contextFiles, setContextFiles, i, 'up'),
              (i: number) => moveItem(contextFiles, setContextFiles, i, 'down')
            )}

            {renderFileList(
              "GLOSARIOS", 
              FileText,
              glossaryFiles, 
              showGlossaries, 
              setShowGlossaries,
              (i: number) => toggleSelection(glossaryFiles, setGlossaryFiles, i),
              () => toggleAll(glossaryFiles, setGlossaryFiles),
              (i: number) => moveItem(glossaryFiles, setGlossaryFiles, i, 'up'),
              (i: number) => moveItem(glossaryFiles, setGlossaryFiles, i, 'down')
            )}

            <LanguageSelector 
              selectedLanguages={targetLanguages}
              onToggleLanguage={toggleLanguage}
              onToggleRegion={toggleRegion}
            />

            <div className="info-note">
              <AlertCircle size={16} />
              <span>Los archivos se usarán en el orden de prioridad indicado</span>
            </div>
          </div>

          {/* Panel derecho */}
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
                    onClick={removeSelectedFile} 
                    title="Quitar archivo"
                  >
                    <X size={16} />
                  </button>
                </div>
              )}
            </div>

            <div 
              className="drop-area unified"
              onDragOver={(e) => { 
                e.preventDefault(); 
                e.currentTarget.classList.add('drag-over'); 
              }}
              onDragLeave={(e) => { 
                e.preventDefault(); 
                e.currentTarget.classList.remove('drag-over'); 
              }}
              onDrop={async (e) => {
                e.preventDefault();
                e.currentTarget.classList.remove('drag-over');
                const file = e.dataTransfer.files[0];
                if (file) {
                  const fakeEvent = { target: { files: [file] } } as any;
                  await handleFileUpload(fakeEvent);
                }
              }}
              onClick={() => document.getElementById('file-upload')?.click()}
            >
              <div className="drop-icon">
                <FileSpreadsheet size={48} />
                <FileText size={48} style={{ marginLeft: -20 }} />
                <BookOpen size={48} style={{ marginLeft: -20 }} />
              </div>
              <p className="drop-title">Arrastra cualquier archivo o haz click para subir</p>
              <p className="drop-description">
                .txt para contextos • .csv/.xlsx para glosarios o archivo a localizar
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