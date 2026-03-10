// src/renderer/src/pages/Landing.tsx
import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import DesktopManager from "../utils/desktop";
import Navbar from "../components/Navbar";
import LanguageSelector from "../components/LanguageSelector";
import UploadPopup from "../components/UploadPopup";
import {
  FileText, BookOpen, Layers, AlertCircle, Download,
  FileSpreadsheet, X, CheckSquare, Square, ChevronDown,
  CheckCircle, Globe
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
  isGlobal?: boolean;
}

interface Language {
  id: string;
  name: string;
  code: string;
  region?: string;
  country?: string;
}

const GENERAL_REPO = { name: "repo-general-totem-games", owner: "biancaluzz" };

const Landing: React.FC = () => {
  const navigate = useNavigate();
  const [state, setState] = useState({
    repoPath: "",
    repoName: "",
    generalRepoPath: "",
    loading: true,
    updatingGeneral: false,
    selectedFile: null as FileItem | null,
    targetLanguages: [] as Language[],
    contextFiles: [] as ContextFile[],
    glossaryFiles: [] as ContextFile[],
    showContexts: false,
    showGlossaries: false,
    showUploadPopup: false,
    pendingFile: null as { file: File; extension: string } | null,
    translating: false,
    progressPercent: 0,
    providerMode: "openai" as "openai" | "gemini" | "both",
    spellCheck: false,
    notification: null as { type: "success" | "error" | "warning"; message: string } | null,
  });

  useEffect(() => { loadProject(); }, []);

  const showNotification = (type: "success" | "error" | "warning", message: string) => {
    setState(prev => ({ ...prev, notification: { type, message } }));
    setTimeout(() => setState(prev => ({ ...prev, notification: null })), 3000);
  };

  const loadProject = async () => {
    try {
      setState(prev => ({ ...prev, loading: true }));
      const desktop = DesktopManager.getInstance();
      const project = await desktop.getConfig("current_project");

      if (!project?.repoPath || !project?.repoName) {
        showNotification("error", "No hay un proyecto seleccionado");
        setTimeout(() => navigate("/dashboard"), 2000);
        return;
      }

      setState(prev => ({ 
        ...prev, 
        repoPath: project.repoPath, 
        repoName: project.repoName 
      }));

      const basePath = project.repoPath.substring(0, project.repoPath.lastIndexOf("/"));
      console.log("Base path:", basePath, "Repo:", project.repoPath);

      // Obtener el path del repo general
      const generalPath = await ensureGeneralRepo(basePath);
      console.log("General repo path obtenido:", generalPath);
      
      // Actualizar el estado con el path del repo general
      setState(prev => ({ ...prev, generalRepoPath: generalPath }));
      
      // Cargar la estructura pasando el generalPath directamente
      await loadProjectStructure(project.repoPath, project.repoName, generalPath);
      
    } catch (error: any) {
      showNotification("error", error.message);
      setTimeout(() => navigate("/dashboard"), 2000);
    } finally {
      setState(prev => ({ ...prev, loading: false }));
    }
  };

  const ensureGeneralRepo = async (basePath: string): Promise<string> => {
    const desktop = DesktopManager.getInstance();
    const token = await desktop.getConfig("github_token");
    const generalPath = `${basePath}/${GENERAL_REPO.name}`;

    try {
      setState(prev => ({ ...prev, updatingGeneral: true }));
      const exists = await desktop.fileExists(generalPath);

      if (!exists) {
        showNotification("warning", "Clonando repositorio general...");
        await desktop.cloneRepository({
          url: `https://github.com/${GENERAL_REPO.owner}/${GENERAL_REPO.name}.git`,
          destination: generalPath,
          token,
        });
        showNotification("success", "Repositorio general clonado");
      } else {
        try {
          await desktop.gitCommand({ command: "git fetch origin", cwd: generalPath });
          await desktop.gitCommand({ command: "git reset --hard origin/main", cwd: generalPath });
          await desktop.gitCommand({ command: "git pull origin main --force", cwd: generalPath });
          console.log("Repo general actualizado");
        } catch (pullError) {
          console.error("Error actualizando repo general:", pullError);
        }
      }
      
      return generalPath;
      
    } catch (error) {
      console.error("Error con repo general:", error);
      showNotification("warning", "Usando solo archivos específicos");
      return "";
    } finally {
      setState(prev => ({ ...prev, updatingGeneral: false }));
    }
  };

  const loadProjectStructure = async (path: string, name: string, generalPath: string) => {
    const desktop = DesktopManager.getInstance();

    try {
      // Cargar archivo a localizar
      try {
        const files = await desktop.readFolder(`${path}/Localizacion`).catch(() => []);
        const csvFile = files.find((f: any) => f.isFile && f.name === `${name}_localizar.csv`);
        const xlsxFile = files.find((f: any) => f.isFile && f.name === `${name}_localizar.xlsx`);
        setState(prev => ({ ...prev, selectedFile: csvFile || xlsxFile || null }));
      } catch {
        console.log("Carpeta Localizacion no encontrada");
      }

      // Cargar contextos y glosarios específicos
      const [specificContexts, specificGlossaries] = await Promise.all([
        loadContexts(path),
        loadGlossaries(path)
      ]);

      // Cargar contextos y glosarios generales usando el generalPath recibido
      let generalContexts: ContextFile[] = [];
      let generalGlossaries: ContextFile[] = [];
      
      if (generalPath) {
        console.log("Cargando archivos generales desde:", generalPath);
        [generalContexts, generalGlossaries] = await Promise.all([
          loadGeneralContexts(generalPath),
          loadGeneralGlossaries(generalPath)
        ]);
        console.log("Contextos generales cargados:", generalContexts.length);
        console.log("Glosarios generales cargados:", generalGlossaries.length);
      }

      // Combinar todos los archivos
      setState(prev => ({
        ...prev,
        contextFiles: [...specificContexts, ...generalContexts],
        glossaryFiles: [...specificGlossaries, ...generalGlossaries]
      }));

    } catch (error) {
      console.error("Error cargando estructura:", error);
    }
  };

  const loadContexts = async (basePath: string) => {
    try {
      const desktop = DesktopManager.getInstance();
      const files = await desktop.readFolder(`${basePath}/Localizacion/contextos_especificos`);
      return files
        .filter((f: any) => f.isFile && f.name.endsWith(".txt"))
        .map((f: any, i: number) => ({
          name: f.name, 
          path: f.path, 
          priority: i + 1, 
          selected: true, 
          isGlobal: false
        }));
    } catch {
      return [];
    }
  };

  const loadGlossaries = async (basePath: string) => {
    try {
      const desktop = DesktopManager.getInstance();
      const files = await desktop.readFolder(`${basePath}/Localizacion/glosarios_especificos`);
      return files
        .filter((f: any) => f.isFile && (f.name.endsWith(".csv") || f.name.endsWith(".xlsx")))
        .map((f: any, i: number) => ({
          name: f.name, 
          path: f.path, 
          priority: i + 1, 
          selected: true, 
          isGlobal: false
        }));
    } catch {
      return [];
    }
  };

  const loadGeneralContexts = async (generalPath: string) => {
    if (!generalPath) return [];
    
    try {
      const desktop = DesktopManager.getInstance();
      const files = await desktop.readFolder(`${generalPath}/contextos_generales`);
      return files
        .filter((f: any) => f.isFile && f.name.endsWith(".txt"))
        .map((f: any, i: number) => ({
          name: `[GLOBAL] ${f.name}`, 
          path: f.path, 
          priority: i + 1, 
          selected: true, 
          isGlobal: true
        }));
    } catch (error) {
      console.log("No se pudieron cargar contextos generales:", error);
      return [];
    }
  };

  const loadGeneralGlossaries = async (generalPath: string) => {
    if (!generalPath) return [];
    
    try {
      const desktop = DesktopManager.getInstance();
      const files = await desktop.readFolder(`${generalPath}/glosarios_generales`);
      return files
        .filter((f: any) => f.isFile && (f.name.endsWith(".csv") || f.name.endsWith(".xlsx")))
        .map((f: any, i: number) => ({
          name: `[GLOBAL] ${f.name}`, 
          path: f.path, 
          priority: i + 1, 
          selected: true, 
          isGlobal: true
        }));
    } catch (error) {
      console.log("No se pudieron cargar glosarios generales:", error);
      return [];
    }
  };

  const toggleSelection = (files: ContextFile[], setFiles: Function, index: number) => {
    const newFiles = [...files];
    newFiles[index].selected = !newFiles[index].selected;
    setFiles(newFiles);
  };

  const toggleAll = (files: ContextFile[], setFiles: Function) => {
    const allSelected = files.every(f => f.selected);
    setFiles(files.map(f => ({ ...f, selected: !allSelected })));
  };

  const moveItem = (files: ContextFile[], setFiles: Function, index: number, dir: "up" | "down") => {
    if ((dir === "up" && index === 0) || (dir === "down" && index === files.length - 1)) return;
    const newFiles = [...files];
    const swap = dir === "up" ? index - 1 : index + 1;
    [newFiles[index], newFiles[swap]] = [newFiles[swap], newFiles[index]];
    newFiles.forEach((f, i) => (f.priority = i + 1));
    setFiles(newFiles);
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const ext = file.name.substring(file.name.lastIndexOf(".")).toLowerCase();
    if (![".txt", ".csv", ".xlsx"].includes(ext)) {
      showNotification("error", "Formato no válido");
      return;
    }
    setState(prev => ({ ...prev, pendingFile: { file, extension: ext }, showUploadPopup: true }));
    e.target.value = "";
  };

  const processFileUpload = async (type: "context" | "glossary" | "localize") => {
    if (!state.pendingFile || !state.repoPath || !state.repoName) return;
    const { file } = state.pendingFile;
    const desktop = DesktopManager.getInstance();
    const ext = file.name.substring(file.name.lastIndexOf(".")).toLowerCase();

    try {
      let targetFolder = "", fileName = "", finalPath = "";
      
      switch (type) {
        case "context":
          targetFolder = `${state.repoPath}/Localizacion/contextos_especificos`;
          fileName = file.name.endsWith(".txt") ? file.name : `${file.name.split(".")[0]}.txt`;
          finalPath = `${targetFolder}/${fileName}`;
          await desktop.saveFile(file, finalPath);
          setState(prev => ({
            ...prev,
            contextFiles: [...prev.contextFiles, { 
              name: fileName, 
              path: finalPath, 
              priority: prev.contextFiles.length + 1, 
              selected: true, 
              isGlobal: false 
            }]
          }));
          break;
        case "glossary":
          targetFolder = `${state.repoPath}/Localizacion/glosarios_especificos`;
          fileName = file.name;
          finalPath = `${targetFolder}/${fileName}`;
          await desktop.saveFile(file, finalPath);
          setState(prev => ({
            ...prev,
            glossaryFiles: [...prev.glossaryFiles, { 
              name: fileName, 
              path: finalPath, 
              priority: prev.glossaryFiles.length + 1, 
              selected: true, 
              isGlobal: false 
            }]
          }));
          break;
        case "localize":
          targetFolder = `${state.repoPath}/Localizacion`;
          fileName = `${state.repoName}_localizar${ext}`;
          finalPath = `${targetFolder}/${fileName}`;
          if (state.selectedFile) await desktop.deleteFile(state.selectedFile.path);
          await desktop.saveFile(file, finalPath);
          setState(prev => ({ 
            ...prev, 
            selectedFile: { 
              name: fileName, 
              path: finalPath, 
              isFile: true, 
              isDirectory: false 
            } 
          }));
          break;
      }
      showNotification("success", "Archivo guardado");
    } catch (error: any) {
      showNotification("error", error.message);
    }
    setState(prev => ({ ...prev, showUploadPopup: false, pendingFile: null }));
  };

  const removeSelectedFile = async () => {
    if (state.selectedFile) {
      try {
        await DesktopManager.getInstance().deleteFile(state.selectedFile.path);
        setState(prev => ({ ...prev, selectedFile: null }));
        showNotification("success", "Archivo eliminado");
      } catch (error: any) {
        showNotification("error", error.message);
      }
    }
  };

  const toggleLanguage = (lang: Language) => {
    setState(prev => ({
      ...prev,
      targetLanguages: prev.targetLanguages.some(l => l.id === lang.id)
        ? prev.targetLanguages.filter(l => l.id !== lang.id)
        : [...prev.targetLanguages, lang]
    }));
  };

  const toggleRegion = (region: string, languages: Language[]) => {
    const ids = languages.map(l => l.id);
    const allSelected = ids.every(id => state.targetLanguages.some(l => l.id === id));
    setState(prev => ({
      ...prev,
      targetLanguages: allSelected
        ? prev.targetLanguages.filter(l => !ids.includes(l.id))
        : [...prev.targetLanguages, ...languages.filter(l => !prev.targetLanguages.some(p => p.id === l.id))]
    }));
  };

  const startLocalization = async () => {
    const desktop = DesktopManager.getInstance();
    if (!state.selectedFile) return showNotification("warning", "Sube un archivo");
    if (state.targetLanguages.length === 0) return showNotification("warning", "Selecciona idiomas");

    setState(prev => ({ ...prev, translating: true, progressPercent: 0 }));
    
    try {
      const payload = {
        repoPath: state.repoPath,
        projectName: state.repoName,
        filePath: state.selectedFile.path,
        targetLanguages: state.targetLanguages.map(l => ({ code: l.code, name: l.name })),
        contexts: state.contextFiles.filter(c => c.selected).map(c => c.path),
        glossaries: state.glossaryFiles.filter(g => g.selected).map(g => g.path),
        providerOptions: { 
          mode: state.providerMode, 
          openaiModel: "gpt-4.1-mini", 
          geminiModel: "gemini-1.5-flash" 
        },
      };

      if (state.spellCheck) {
        const unsub = desktop.onSpellCheckProgress(d => 
          setState(prev => ({ ...prev, progressPercent: d.percent }))
        );
        const result = await desktop.spellCheckFile({ 
          filePath: state.selectedFile.path, 
          language: "Español", 
          applyToFile: false, 
          providerOptions: payload.providerOptions 
        });
        unsub();
        navigate("/translation-preview", { 
          state: { 
            spellCheckOnly: true, 
            fileInfo: { 
              filePath: result.filePath, 
              csvContent: result.csvContent 
            }, 
            spellCheckPreview: result.preview, 
            translationPayload: payload, 
            repoPath: state.repoPath, 
            providerMode: state.providerMode, 
            targetLanguages: state.targetLanguages 
          } 
        });
      } else {
        const unsub = desktop.onTranslationProgress(d => 
          setState(prev => ({ ...prev, progressPercent: d.percent }))
        );
        const result = await desktop.translateFile(payload);
        unsub();
        navigate("/translation-preview", { 
          state: { 
            fileInfo: { 
              filePath: result.filePath, 
              csvContent: result.csvContent 
            }, 
            previewData: { 
              preview: result.preview, 
              stats: result.stats, 
              providerMode: state.providerMode, 
              targetLanguages: state.targetLanguages 
            }, 
            repoPath: state.repoPath, 
            providerMode: state.providerMode 
          } 
        });
      }
    } catch (error: any) {
      showNotification("error", error?.message || "Error");
    } finally {
      setState(prev => ({ ...prev, translating: false, progressPercent: 0 }));
    }
  };

  const getToggleIcon = (files: ContextFile[]) => {
    if (!files.length) return null;
    const allSelected = files.every(f => f.selected);
    const noneSelected = files.every(f => !f.selected);
    if (allSelected) return <CheckSquare size={16} className="toggle-checkbox fully-selected" />;
    if (noneSelected) return <Square size={16} className="toggle-checkbox" />;
    return <Square size={16} className="toggle-checkbox partially-selected" />;
  };

  const FileList = ({ title, icon: Icon, files, show, setShow, type }: any) => (
    <div className="config-section">
      <div className="section-header">
        <h3><Icon size={18} /> {title} <span className="section-count">{files.filter((f: any) => f.selected).length}/{files.length}</span></h3>
        <div className="section-actions">
          {files.length > 0 && (
            <button 
              className="toggle-all-btn" 
              onClick={() => toggleAll(files, (newFiles: any) => setState(prev => ({ ...prev, [type]: newFiles })))}
            >
              {getToggleIcon(files)}
            </button>
          )}
          <button className="dropdown-toggle" onClick={() => setShow(!show)}>
            <ChevronDown size={16} className={show ? "open" : ""} />
          </button>
        </div>
      </div>
      {show && (
        <div className="dropdown-content">
          {files.length > 0 ? (
            <div className="priority-list">
              {files.map((file: ContextFile, idx: number) => (
                <div key={idx} className="priority-item">
                  <button 
                    className="select-toggle" 
                    onClick={() => toggleSelection(files, (newFiles: any) => setState(prev => ({ ...prev, [type]: newFiles })), idx)}
                  >
                    {file.selected ? <CheckSquare size={16} /> : <Square size={16} />}
                  </button>
                  <span className="priority-badge">{file.priority}</span>
                  <span className={`priority-text ${file.isGlobal ? "global" : ""}`}>
                    {file.isGlobal && <Globe size={12} className="global-icon" />}
                    {file.name}
                  </span>
                  <div className="priority-controls">
                    <button 
                      className="priority-btn" 
                      onClick={() => moveItem(files, (newFiles: any) => setState(prev => ({ ...prev, [type]: newFiles })), idx, "up")} 
                      disabled={idx === 0}
                    >↑</button>
                    <button 
                      className="priority-btn" 
                      onClick={() => moveItem(files, (newFiles: any) => setState(prev => ({ ...prev, [type]: newFiles })), idx, "down")} 
                      disabled={idx === files.length - 1}
                    >↓</button>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="empty-dropdown"><AlertCircle size={16} /> No hay archivos</div>
          )}
        </div>
      )}
    </div>
  );

  if (state.loading) {
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

  return (
    <>
      <Navbar />
      {state.updatingGeneral && (
        <div className="general-update-notification">
          <div className="spinner-small" />
          <span>Actualizando repositorio general...</span>
        </div>
      )}
      {state.notification && (
        <div className={`landing-notification ${state.notification.type}`}>
          {state.notification.type === "success" ? <CheckCircle size={18} /> : <AlertCircle size={18} />}
          <span>{state.notification.message}</span>
        </div>
      )}
      <UploadPopup
        isOpen={state.showUploadPopup}
        onClose={() => setState(prev => ({ ...prev, showUploadPopup: false, pendingFile: null }))}
        onConfirm={processFileUpload}
        fileName={state.pendingFile?.file.name || ""}
        fileExtension={state.pendingFile?.extension || ""}
        repoName={state.repoName}
      />
      <div className="landing-container">
        <div className="landing-content">
          <div className="config-panel">
            <h2 className="panel-title">
              <Layers size={20} /> Localizador 
              <span className="panel-subtitle">Complete los campos para localizar los textos</span>
            </h2>
            <FileList 
              title="CONTEXTOS" 
              icon={BookOpen} 
              files={state.contextFiles} 
              show={state.showContexts} 
              setShow={(v: boolean) => setState(prev => ({ ...prev, showContexts: v }))} 
              type="contextFiles" 
            />
            <FileList 
              title="GLOSARIOS" 
              icon={FileText} 
              files={state.glossaryFiles} 
              show={state.showGlossaries} 
              setShow={(v: boolean) => setState(prev => ({ ...prev, showGlossaries: v }))} 
              type="glossaryFiles" 
            />
            <LanguageSelector 
              selectedLanguages={state.targetLanguages} 
              onToggleLanguage={toggleLanguage}
              onToggleRegion={toggleRegion}
            />
            <div className="info-note">
              <AlertCircle size={16} />
              <span>Los archivos con <Globe size={12} /> son globales</span>
            </div>
          </div>
          <div className="work-panel">
            <div className="work-header">
              <h3>Subir archivos al proyecto</h3>
              {state.selectedFile && (
                <div className="selected-file-info">
                  <FileSpreadsheet size={20} />
                  <div><strong>Archivo:</strong> <small>{state.selectedFile.name}</small></div>
                  <button className="clear-btn" onClick={removeSelectedFile}><X size={16} /></button>
                </div>
              )}
            </div>
            <div 
              className="drop-area unified" 
              onDragOver={(e) => { e.preventDefault(); e.currentTarget.classList.add("drag-over"); }} 
              onDragLeave={(e) => { e.preventDefault(); e.currentTarget.classList.remove("drag-over"); }} 
              onDrop={async (e) => { 
                e.preventDefault(); 
                e.currentTarget.classList.remove("drag-over"); 
                const file = e.dataTransfer.files[0]; 
                if (file) await handleFileUpload({ target: { files: [file] } } as any); 
              }} 
              onClick={() => document.getElementById("file-upload")?.click()}
            >
              <div className="drop-icon">
                <FileSpreadsheet size={48} />
                <FileText size={48} style={{ marginLeft: -20 }} />
                <BookOpen size={48} style={{ marginLeft: -20 }} />
              </div>
              <p className="drop-title">Arrastra o haz click para subir</p>
              <p className="drop-description">.txt para contextos • .csv/.xlsx para glosarios o archivo a localizar</p>
              <input id="file-upload" type="file" accept=".txt,.csv,.xlsx" onChange={handleFileUpload} style={{ display: "none" }} />
            </div>
            <div className="spellcheck-option">
              <label className="spellcheck-label">
                <input 
                  type="checkbox" 
                  checked={state.spellCheck} 
                  onChange={(e) => setState(prev => ({ ...prev, spellCheck: e.target.checked }))} 
                />
                <span>Revisar ortografía/gramática antes de traducir</span>
              </label>
            </div>
            <div className="action-section">
              <button 
                className={`localize-btn ${state.selectedFile && state.targetLanguages.length > 0 ? "active" : "disabled"}`} 
                onClick={startLocalization} 
                disabled={!state.selectedFile || state.targetLanguages.length === 0 || state.translating}
              >
                {state.translating ? (
                  <><div className="spinner-small" /> {state.spellCheck ? `Revisando... ${state.progressPercent}%` : `Procesando... ${state.progressPercent}%`}</>
                ) : (
                  <><Download size={20} /> {state.selectedFile && state.targetLanguages.length > 0 ? `Iniciar Localización (${state.targetLanguages.length} idioma${state.targetLanguages.length > 1 ? "s" : ""})` : "Selecciona archivo e idiomas"}</>
                )}
              </button>
            </div>
          </div>
        </div>
      </div>
    </>
  );
};

export default Landing;