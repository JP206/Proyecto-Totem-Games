// src/renderer/src/pages/Landing.tsx
import React, { useState, useEffect, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import DesktopManager from "../../utils/desktop";
import InlineBanner from "../../components/InlineBanner/InlineBanner";
import PageWithNavbar from "../../components/PageWithNavbar/PageWithNavbar";
import LoadingState from "../../components/LoadingState/LoadingState";
import LanguageSelector from "../../components/LanguageSelector/LanguageSelector";
import {
  FileText, BookOpen, Layers, AlertCircle, Download,
  FileSpreadsheet, ChevronDown,
  Globe, Sparkles, Coins, Binary
} from "lucide-react";
import { getTokensToday, addTokensToday } from "../../utils/tokenUsage";
import FileListSection from "./components/FileListSection";
import LandingFloatingHelp from "./components/LandingFloatingHelp";
import { LANDING_PANEL_TITLE } from "./constants";
import "./landing.css";

interface FileItem { name: string; path: string; isDirectory: boolean; isFile: boolean; }
interface ContextFile { name: string; path: string; priority: number; selected: boolean; isGlobal?: boolean; }
interface Language { id: string; name: string; code: string; region?: string; country?: string; }

const GENERAL_REPO = { name: "repo-general-totem-games", owner: "Proyecto-Final-de-Grado" };

const Landing: React.FC = () => {
  const navigate = useNavigate();
  const [state, setState] = useState({
    repoPath: "", repoName: "", generalRepoPath: "", loading: true, updatingGeneral: false,
    selectedFile: null as FileItem | null, targetLanguages: [] as Language[],
    contextFiles: [] as ContextFile[], glossaryFiles: [] as ContextFile[],
    showContexts: false, showGlossaries: false,
    translating: false, progressPercent: 0, providerMode: null as "openai" | "gemini" | null,
    spellCheck: false, openaiModel: "gpt-4.1-mini", geminiModel: "gemini-1.5-flash",
    spellCheckBeforeTranslate: false, tokensToday: 0,
    personalOpenaiModel: "", personalGeminiModel: "",
    hasPersonalOpenAI: false, hasPersonalGemini: false,
    openaiModels: [] as string[], geminiModels: [] as string[],
    openaiEmbeddingModels: [] as string[], geminiEmbeddingModels: [] as string[],
    showProviderConfig: false,
    confidenceTextSimilarity: false,
    confidenceEmbeddingSimilarity: false,
    confidenceEmbeddingModel: "",
    estimatingCost: false,
    estimatedTokens: 0,
    showOverwriteConfirm: false,
    pendingFile: null as File | null
  });

  const [errorModal, setErrorModal] = useState({ show: false, message: "", filename: "" });

  useEffect(() => { loadProject(); }, []);

  useEffect(() => {
    if (!state.repoPath) return;
    setState(prev => ({ ...prev, tokensToday: getTokensToday(state.repoPath) }));
  }, [state.repoPath]);

  // Preserve list order (priority), same as payload sent to estimation — not sorted paths.
  const estimateSelectionKey = useMemo(() => {
    const ctx = state.contextFiles
      .filter((c) => c.selected)
      .map((c) => c.path)
      .join("\0");
    const glo = state.glossaryFiles
      .filter((g) => g.selected)
      .map((g) => g.path)
      .join("\0");
    return `${ctx}|||${glo}`;
  }, [state.contextFiles, state.glossaryFiles]);

  useEffect(() => {
    let cancelled = false;
    const desktop = DesktopManager.getInstance();
    const selectedProviderMode =
      state.providerMode === "openai" || state.providerMode === "gemini"
        ? state.providerMode
        : null;
    const hasSelectedProvider = selectedProviderMode !== null;
    const hasSelectedProviderKey =
      (state.providerMode === "openai" && state.hasPersonalOpenAI) ||
      (state.providerMode === "gemini" && state.hasPersonalGemini);
    const shouldEstimate =
      !!state.selectedFile &&
      state.targetLanguages.length > 0 &&
      hasSelectedProvider &&
      hasSelectedProviderKey &&
      !state.translating;

    if (!shouldEstimate) {
      setState(prev => ({
        ...prev,
        estimatingCost: false,
        estimatedTokens: 0,
      }));
      return;
    }

    const timer = setTimeout(async () => {
      try {
        if (cancelled) return;
        setState(prev => ({ ...prev, estimatingCost: true }));
        const payload = {
          repoPath: state.repoPath,
          projectName: state.repoName,
          filePath: state.selectedFile!.path,
          sourceLanguageName: undefined as string | undefined,
          targetLanguages: state.targetLanguages.map(l => ({ code: l.code, name: l.name })),
          contexts: state.contextFiles.filter(c => c.selected).map(c => c.path),
          glossaries: state.glossaryFiles.filter(g => g.selected).map(g => g.path),
          providerOptions: {
            mode: selectedProviderMode as "openai" | "gemini",
            openaiModel: state.openaiModel,
            geminiModel: state.geminiModel,
            personalOpenAIModel: state.personalOpenaiModel || undefined,
            personalGeminiModel: state.personalGeminiModel || undefined,
          },
          confidenceTextSimilarity: state.confidenceTextSimilarity,
          confidenceEmbeddingSimilarity: state.confidenceEmbeddingSimilarity,
          confidenceEmbeddingModel:
            state.confidenceEmbeddingSimilarity
              ? state.confidenceEmbeddingModel || undefined
              : undefined,
        };
        if (cancelled) return;
        const estimate = await desktop.estimateRunCost({
          translationPayload: payload,
          includeSpellcheck: state.spellCheck || state.spellCheckBeforeTranslate,
          spellcheckPayload: {
            filePath: state.selectedFile!.path,
            language: "Español",
            applyToFile: false,
            providerOptions: payload.providerOptions,
          },
        });
        if (cancelled) return;
        setState(prev => ({
          ...prev,
          estimatingCost: false,
          estimatedTokens: estimate.total.estimatedTokens,
        }));
      } catch {
        if (cancelled) return;
        setState(prev => ({
          ...prev,
          estimatingCost: false,
          estimatedTokens: 0,
        }));
      }
    }, 350);

    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [
    state.selectedFile,
    state.targetLanguages,
    estimateSelectionKey,
    state.spellCheck,
    state.spellCheckBeforeTranslate,
    state.providerMode,
    state.openaiModel,
    state.geminiModel,
    state.personalOpenaiModel,
    state.personalGeminiModel,
    state.confidenceTextSimilarity,
    state.confidenceEmbeddingSimilarity,
    state.confidenceEmbeddingModel,
    state.hasPersonalOpenAI,
    state.hasPersonalGemini,
    state.repoPath,
    state.repoName,
    state.translating,
  ]);

  useEffect(() => {
    const onFocus = () => {
      if (state.repoPath) setState(prev => ({ ...prev, tokensToday: getTokensToday(state.repoPath) }));
    };
    window.addEventListener("focus", onFocus);
    return () => window.removeEventListener("focus", onFocus);
  }, [state.repoPath]);

  // Cargar proyecto desde el store  
  const loadProject = async () => {
    try {
      setState(prev => ({ ...prev, loading: true }));
      const desktop = DesktopManager.getInstance();
      const project = await desktop.getConfig("current_project");

      if (!project?.repoPath || !project?.repoName) {
        setTimeout(() => navigate("/dashboard"), 2000);
        return;
      }

      setState(prev => ({ ...prev, repoPath: project.repoPath, repoName: project.repoName }));
      const lastSep = Math.max(project.repoPath.lastIndexOf("/"), project.repoPath.lastIndexOf("\\"));
      const basePath = lastSep >= 0 ? project.repoPath.substring(0, lastSep) : project.repoPath;
      const generalPath = await ensureGeneralRepo(basePath);
      
      setState(prev => ({ ...prev, generalRepoPath: generalPath }));
      await loadProjectStructure(project.repoPath, project.repoName, generalPath);

      try {
        const aiConfig = await window.electronAPI.getPersonalAIConfig();
        setState(prev => ({
          ...prev,
          ...(aiConfig?.openai ? {
            hasPersonalOpenAI: aiConfig.openai.hasKey,
            openaiModels: aiConfig.openai.models?.map((m: any) => m.id) || [],
            openaiEmbeddingModels: aiConfig.openai.embeddingModels?.map((m: any) => m.id) || [],
            ...(aiConfig.openai.defaultModel ? { personalOpenaiModel: aiConfig.openai.defaultModel } : {}),
          } : {}),
          ...(aiConfig?.gemini ? {
            hasPersonalGemini: aiConfig.gemini.hasKey,
            geminiModels: aiConfig.gemini.models?.map((m: any) => m.id) || [],
            geminiEmbeddingModels: aiConfig.gemini.embeddingModels?.map((m: any) => m.id) || [],
            ...(aiConfig.gemini.defaultModel ? { personalGeminiModel: aiConfig.gemini.defaultModel } : {}),
          } : {}),
        }));
      } catch {
      }
    } catch (error: any) {
      setTimeout(() => navigate("/dashboard"), 2000);
    } finally {
      setState(prev => ({ ...prev, loading: false }));
    }
  };

  // Asegurar que el repositorio general existe y está actualizado  
  const ensureGeneralRepo = async (basePath: string): Promise<string> => {
    const desktop = DesktopManager.getInstance();
    const token = await desktop.getConfig("github_token");
    const generalPath = `${basePath}/${GENERAL_REPO.name}`;

    try {
      setState(prev => ({ ...prev, updatingGeneral: true }));
      const exists = await desktop.fileExists(generalPath);

      if (!exists) {
        await desktop.cloneRepository({
          url: `https://github.com/${GENERAL_REPO.owner}/${GENERAL_REPO.name}.git`,
          destination: generalPath, token
        });
      } else {
        await desktop.gitCommand({ command: "git fetch origin", cwd: generalPath });
        await desktop.gitCommand({ command: "git reset --hard origin/main", cwd: generalPath });
        await desktop.gitCommand({ command: "git pull origin main --force", cwd: generalPath });
      }
      return generalPath;
    } catch (error) {
      console.error("Error con repo general:", error);
      return "";
    } finally {
      setState(prev => ({ ...prev, updatingGeneral: false }));
    }
  };

  // Cargar estructura del proyecto
  const loadProjectStructure = async (path: string, name: string, generalPath: string) => {
    try {
      const desktop = DesktopManager.getInstance();
      
      // Cargar archivo a localizar
      try {
        const files = await desktop.readFolder(`${path}/Localizacion`);
        const csvFile = files.find((f: any) => f.isFile && f.name === `${name}_localizar.csv`);
        const xlsxFile = files.find((f: any) => f.isFile && f.name === `${name}_localizar.xlsx`);
        setState(prev => ({ ...prev, selectedFile: csvFile || xlsxFile || null }));
      } catch {
        console.log("Carpeta Localizacion no encontrada");
      }
      
      const [specificContexts, specificGlossaries] = await Promise.all([
        loadContexts(path), loadGlossaries(path)
      ]);

      let generalContexts: ContextFile[] = [], generalGlossaries: ContextFile[] = [];
      if (generalPath) {
        [generalContexts, generalGlossaries] = await Promise.all([
          loadGeneralContexts(generalPath), loadGeneralGlossaries(generalPath)
        ]);
      }

      // Unificar y ordenar: primero globales, luego específicos
      const allContexts = [...generalContexts, ...specificContexts];
      const allGlossaries = [...generalGlossaries, ...specificGlossaries];

      // Reasignar prioridades en orden (globales tienen prioridad más alta)
      const reindexedContexts = allContexts.map((file, index) => ({
        ...file,
        priority: index + 1
      }));

      const reindexedGlossaries = allGlossaries.map((file, index) => ({
        ...file,
        priority: index + 1
      }));

      setState(prev => ({
        ...prev,
        contextFiles: reindexedContexts,
        glossaryFiles: reindexedGlossaries
      }));
    } catch (error) {
      console.error("Error cargando estructura:", error);
    }
  };

  // Cargar contextos específicos
  const loadContexts = async (basePath: string) => {
    try {
      const desktop = DesktopManager.getInstance();
      const files = await desktop.readFolder(`${basePath}/Localizacion/contextos_especificos`);
      return files.filter((f: any) => f.isFile && f.name.endsWith(".txt"))
        .map((f: any) => ({ 
          name: f.name, path: f.path, priority: 0, 
          selected: true, isGlobal: false
        }));
    } catch { return []; }
  };

  // Cargar glosarios específicos
  const loadGlossaries = async (basePath: string) => {
    try {
      const desktop = DesktopManager.getInstance();
      const files = await desktop.readFolder(`${basePath}/Localizacion/glosarios_especificos`);
      return files.filter((f: any) => f.isFile && (f.name.endsWith(".csv") || f.name.endsWith(".xlsx")))
        .map((f: any) => ({ 
          name: f.name, path: f.path, priority: 0, 
          selected: true, isGlobal: false
        }));
    } catch { return []; }
  };

  // Cargar contextos generales
  const loadGeneralContexts = async (generalPath: string) => {
    if (!generalPath) return [];
    try {
      const desktop = DesktopManager.getInstance();
      const files = await desktop.readFolder(`${generalPath}/contextos_generales`);
      return files.filter((f: any) => f.isFile && f.name.endsWith(".txt"))
        .map((f: any) => ({ 
          name: f.name, path: f.path, priority: 0, 
          selected: true, isGlobal: true
        }));
    } catch { return []; }
  };

  // Cargar glosarios generales
  const loadGeneralGlossaries = async (generalPath: string) => {
    if (!generalPath) return [];
    try {
      const desktop = DesktopManager.getInstance();
      const files = await desktop.readFolder(`${generalPath}/glosarios_generales`);
      return files.filter((f: any) => f.isFile && (f.name.endsWith(".csv") || f.name.endsWith(".xlsx")))
        .map((f: any) => ({ 
          name: f.name, path: f.path, priority: 0, 
          selected: true, isGlobal: true
        }));
    } catch { return []; }
  };

  // Manejadores de listas
  const toggleSelection = (files: ContextFile[], setFiles: Function, index: number) => {
    const newFiles = files.map((f, i) =>
      i === index ? { ...f, selected: !f.selected } : f,
    );
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
    // Reasignar prioridades después del movimiento
    newFiles.forEach((f, i) => (f.priority = i + 1));
    setFiles(newFiles);
  };

  // Manejador de subida de archivo a localizar
  const handleFileUpload = async (file: File) => {
    const ext = file.name.substring(file.name.lastIndexOf(".")).toLowerCase();
    if (![".csv", ".xlsx"].includes(ext)) {
      console.error("Formato no válido. Solo se permiten archivos .csv o .xlsx para localización");
      setErrorModal({
        show: true,
        message: "Formato no válido. Solo se permiten archivos .csv o .xlsx para localización.",
        filename: file.name
      });
      return;
    }

    // Si ya existe un archivo, mostrar confirmación
    if (state.selectedFile) {
      setState(prev => ({ ...prev, showOverwriteConfirm: true, pendingFile: file }));
    } else {
      // Si no existe, subir directamente
      await uploadLocalizeFile(file);
    }
  };

  const uploadLocalizeFile = async (file: File) => {
    if (!state.repoPath || !state.repoName) return;
    
    const desktop = DesktopManager.getInstance();
    const ext = file.name.substring(file.name.lastIndexOf(".")).toLowerCase();
    const targetFolder = `${state.repoPath}/Localizacion`;
    const fileName = `${state.repoName}_localizar${ext}`;
    const finalPath = `${targetFolder}/${fileName}`;
    
    try {
      // Si ya existe, lo eliminamos primero
      if (state.selectedFile) {
        await desktop.deleteFile(state.selectedFile.path);
      }
      
      await desktop.saveFile(file, finalPath);
      
      setState(prev => ({ 
        ...prev, 
        selectedFile: { 
          name: fileName, 
          path: finalPath, 
          isFile: true, 
          isDirectory: false 
        },
        showOverwriteConfirm: false,
        pendingFile: null
      }));
    } catch (error: any) {
      console.error("Error subiendo archivo:", error);
      setErrorModal({
        show: true,
        message: "Error al subir el archivo: " + error.message,
        filename: fileName
      });
    }
  };

  const handleOverwriteConfirm = async () => {
    if (state.pendingFile) {
      await uploadLocalizeFile(state.pendingFile);
    }
  };

  const handleOverwriteCancel = () => {
    setState(prev => ({ ...prev, showOverwriteConfirm: false, pendingFile: null }));
  };

  // Idiomas
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

  // Localización
  const startLocalization = async () => {
    const desktop = DesktopManager.getInstance();
    if (!state.selectedFile) {
      console.warn("Por favor sube un archivo CSV o XLSX para localizar");
      return;
    }
    if (!state.targetLanguages.length) {
      console.warn("Por favor selecciona al menos un idioma destino");
      return;
    }
    const selectedProviderMode =
      state.providerMode === "openai" || state.providerMode === "gemini"
        ? state.providerMode
        : null;
    const missingSelectedProvider = selectedProviderMode === null;
    if (missingSelectedProvider) {
      alert("Selecciona un proveedor (OpenAI o Gemini) para continuar.");
      return;
    }
    const missingSelectedPersonalKey =
      (state.providerMode === "openai" && !state.hasPersonalOpenAI) ||
      (state.providerMode === "gemini" && !state.hasPersonalGemini);
    if (missingSelectedPersonalKey) {
      alert("Configuración requerida: Debes configurar tu API key personal del proveedor seleccionado en tu perfil.");
      return;
    }
    if (
      state.confidenceEmbeddingSimilarity &&
      !state.confidenceEmbeddingModel
    ) {
      alert("Selecciona un modelo de embeddings para usar similitud por embeddings.");
      return;
    }

    setState(prev => ({ ...prev, translating: true, progressPercent: 0 }));
    
    try {
      const payload = {
        repoPath: state.repoPath, projectName: state.repoName, filePath: state.selectedFile.path,
        sourceLanguageName: undefined as string | undefined,
        targetLanguages: state.targetLanguages.map(l => ({ code: l.code, name: l.name })),
        contexts: state.contextFiles.filter(c => c.selected).map(c => c.path),
        glossaries: state.glossaryFiles.filter(g => g.selected).map(g => g.path),
        providerOptions: {
          mode: selectedProviderMode as "openai" | "gemini",
          openaiModel: state.openaiModel,
          geminiModel: state.geminiModel,
          personalOpenAIModel: state.personalOpenaiModel || undefined,
          personalGeminiModel: state.personalGeminiModel || undefined,
        },
        confidenceTextSimilarity: state.confidenceTextSimilarity,
        confidenceEmbeddingSimilarity: state.confidenceEmbeddingSimilarity,
        confidenceEmbeddingModel:
          state.confidenceEmbeddingSimilarity
            ? state.confidenceEmbeddingModel || undefined
            : undefined,
      };

      const spellCheckActive = state.spellCheck || state.spellCheckBeforeTranslate;

      if (spellCheckActive) {
        const unsub = desktop.onSpellCheckProgress(d => setState(prev => ({ ...prev, progressPercent: d.percent })));
        const result = await desktop.spellCheckFile({ 
          filePath: state.selectedFile.path, language: "Español", 
          applyToFile: false, providerOptions: payload.providerOptions 
        });
        unsub();
        setState(prev => ({ ...prev, progressPercent: 100 }));
        
        if (state.repoPath && (result.stats?.tokensUsed ?? 0) > 0) {
          addTokensToday(state.repoPath, result.stats.tokensUsed ?? 0);
        }

        if (state.spellCheckBeforeTranslate) {
          // Si es solo corrección, navegar a preview
          navigate("/translation-preview", { 
            state: { 
              spellCheckOnly: true, 
              fileInfo: { filePath: result.filePath, csvContent: result.csvContent }, 
              spellCheckPreview: result.preview,
              spellCheckStats: result.stats,
              translationPayload: payload, 
              repoPath: state.repoPath, 
              providerMode: state.providerMode, 
              targetLanguages: state.targetLanguages,
              sourceLanguageName: "Origen"
            } 
          });
        } else {
          // Si es corrección + traducción, continuar con traducción
          const transUnsub = desktop.onTranslationProgress(d => setState(prev => ({ ...prev, progressPercent: d.percent })));
          const transResult = await desktop.translateFile(payload);
          transUnsub();
          setState(prev => ({ ...prev, progressPercent: 100 }));
          
          if (state.repoPath && (transResult.stats?.tokensUsed ?? 0) > 0) {
            addTokensToday(state.repoPath, transResult.stats.tokensUsed ?? 0);
          }
          
          navigate("/translation-preview", { 
            state: { 
              fileInfo: { filePath: transResult.filePath, csvContent: transResult.csvContent }, 
              previewData: { preview: transResult.preview, stats: transResult.stats, providerMode: state.providerMode, 
              targetLanguages: state.targetLanguages }, 
              repoPath: state.repoPath, 
              providerMode: state.providerMode,
              sourceLanguageName: "Origen"
            } 
          });
        }
      } else {
        const unsub = desktop.onTranslationProgress(d => setState(prev => ({ ...prev, progressPercent: d.percent })));
        const result = await desktop.translateFile(payload);
        unsub();
        setState(prev => ({ ...prev, progressPercent: 100 }));
        
        if (state.repoPath && (result.stats?.tokensUsed ?? 0) > 0) {
          addTokensToday(state.repoPath, result.stats.tokensUsed ?? 0);
        }
        
        navigate("/translation-preview", { 
          state: { 
            fileInfo: { filePath: result.filePath, csvContent: result.csvContent }, 
            previewData: { preview: result.preview, stats: result.stats, providerMode: state.providerMode, 
            targetLanguages: state.targetLanguages }, 
            repoPath: state.repoPath, 
            providerMode: state.providerMode,
            sourceLanguageName: "Origen"
          } 
        });
      }
    } catch (error: any) {
      console.error("Error en localización:", error);
    } finally {
      setState(prev => ({ ...prev, translating: false, progressPercent: 0 }));
    }
  };

  // Componente para modal de error
  const ErrorModal = ({ show, message, filename, onClose }: any) => {
    if (!show) return null;
    
    return (
      <div className="error-modal-overlay" onClick={onClose}>
        <div className="error-modal" onClick={e => e.stopPropagation()}>
          <div className="error-modal-icon">
            <AlertCircle size={32} />
          </div>
          <h3>Error</h3>
          <p>{message}</p>
          {filename && <div className="error-filename">{filename}</div>}
          <button onClick={onClose}>Entendido</button>
        </div>
      </div>
    );
  };

  // Componente para modal de confirmación de sobrescritura
  const OverwriteConfirmModal = ({ show, onConfirm, onCancel, fileName }: any) => {
    if (!show) return null;
    
    return (
      <div className="error-modal-overlay" onClick={onCancel}>
        <div className="error-modal" onClick={e => e.stopPropagation()}>
          <div className="error-modal-icon" style={{ borderColor: "#FFB800", background: "rgba(255, 184, 0, 0.1)" }}>
            <AlertCircle size={32} color="#FFB800" />
          </div>
          <h3>Sobrescribir archivo existente</h3>
          <p>Ya existe un archivo a localizar. ¿Deseas sobrescribirlo?</p>
          <div className="error-filename">{fileName}</div>
          <div style={{ display: "flex", gap: "12px", marginTop: "16px" }}>
            <button onClick={onConfirm} style={{ flex: 1, background: "linear-gradient(135deg, #B45AD3 0%, #9B4BC0 100%)" }}>
              Sí, sobrescribir
            </button>
            <button onClick={onCancel} style={{ flex: 1, background: "var(--color-neutral-medium)" }}>
              Cancelar
            </button>
          </div>
        </div>
      </div>
    );
  };

  if (state.loading) {
    return (
      <PageWithNavbar>
        <div className="landing-loading">
          <LoadingState message="Cargando proyecto..." fullPage />
        </div>
      </PageWithNavbar>
    );
  }

  return (
    <PageWithNavbar>
      {state.updatingGeneral && (
        <InlineBanner
          className="general-update-notification"
          message="Actualizando repositorio general..."
          loading
        />
      )}
      
      <ErrorModal 
        show={errorModal.show}
        message={errorModal.message}
        filename={errorModal.filename}
        onClose={() => setErrorModal({ show: false, message: "", filename: "" })}
      />

      <OverwriteConfirmModal
        show={state.showOverwriteConfirm}
        onConfirm={handleOverwriteConfirm}
        onCancel={handleOverwriteCancel}
        fileName={state.pendingFile?.name || ""}
      />

      <div className="landing-container" aria-label={LANDING_PANEL_TITLE}>
        <div className="landing-content">
          <div className="config-panel">
            {state.repoPath && (
              <div className="landing-tokens-today">
                <Coins size={18} />
                <span className="landing-tokens-today-label">
                  Tokens utilizados hoy (este proyecto)
                </span>
                <span className="landing-tokens-today-value">
                  {state.tokensToday.toLocaleString()}
                </span>
              </div>
            )}
            <h2 className="panel-title"><Layers size={20} /> Localizador <span className="panel-subtitle">Complete los campos</span></h2>
            <FileListSection
              title="CONTEXTOS"
              icon={BookOpen}
              files={state.contextFiles}
              show={state.showContexts}
              onToggleOpen={(showContexts) =>
                setState((prev) => ({ ...prev, showContexts }))
              }
              onToggleAll={() =>
                toggleAll(state.contextFiles, (contextFiles: ContextFile[]) =>
                  setState((prev) => ({ ...prev, contextFiles })),
                )
              }
              onToggleSelection={(index) =>
                toggleSelection(
                  state.contextFiles,
                  (contextFiles: ContextFile[]) =>
                    setState((prev) => ({ ...prev, contextFiles })),
                  index,
                )
              }
              onMoveItem={(index, direction) =>
                moveItem(
                  state.contextFiles,
                  (contextFiles: ContextFile[]) =>
                    setState((prev) => ({ ...prev, contextFiles })),
                  index,
                  direction,
                )
              }
            />
            <FileListSection
              title="GLOSARIOS"
              icon={FileText}
              files={state.glossaryFiles}
              show={state.showGlossaries}
              onToggleOpen={(showGlossaries) =>
                setState((prev) => ({ ...prev, showGlossaries }))
              }
              onToggleAll={() =>
                toggleAll(state.glossaryFiles, (glossaryFiles: ContextFile[]) =>
                  setState((prev) => ({ ...prev, glossaryFiles })),
                )
              }
              onToggleSelection={(index) =>
                toggleSelection(
                  state.glossaryFiles,
                  (glossaryFiles: ContextFile[]) =>
                    setState((prev) => ({ ...prev, glossaryFiles })),
                  index,
                )
              }
              onMoveItem={(index, direction) =>
                moveItem(
                  state.glossaryFiles,
                  (glossaryFiles: ContextFile[]) =>
                    setState((prev) => ({ ...prev, glossaryFiles })),
                  index,
                  direction,
                )
              }
            />
            <LanguageSelector selectedLanguages={state.targetLanguages} onToggleLanguage={toggleLanguage} onToggleRegion={toggleRegion} />
            <div className="config-section">
              <div className="section-header" onClick={() => setState(prev => ({ ...prev, showProviderConfig: !prev.showProviderConfig }))}>
                <h3>Proveedor de IA <span className="section-count">{state.providerMode === "openai" ? "OpenAI" : state.providerMode === "gemini" ? "Gemini" : "Sin seleccionar"}</span></h3>
                <div className="section-actions">
                  <button className="dropdown-toggle" onClick={(e) => { e.stopPropagation(); setState(prev => ({ ...prev, showProviderConfig: !prev.showProviderConfig })); }} title={state.showProviderConfig ? "Ocultar configuración" : "Mostrar configuración"}>
                    <ChevronDown size={16} className={state.showProviderConfig ? "open" : ""} />
                  </button>
                </div>
              </div>
              {state.showProviderConfig && (
                <div className="dropdown-content">
                  <div className="spellcheck-option">
                    <label className="spellcheck-label">
                      <input type="radio" checked={state.providerMode === "openai"} onChange={() => setState(prev => ({ ...prev, providerMode: "openai" }))} disabled={!state.hasPersonalOpenAI} />
                      <span>OpenAI</span>
                    </label>
                    {!state.hasPersonalOpenAI && state.providerMode === "openai" && <small className="spellcheck-note">No hay una key personal de OpenAI configurada.</small>}
                    {state.hasPersonalOpenAI && (
                      <div className="profile-model-section">
                        <label className="profile-input-label">Modelo personal de OpenAI</label>
                        <select className="profile-select" value={state.personalOpenaiModel} onChange={(e) => setState(prev => ({ ...prev, personalOpenaiModel: e.target.value }))}>
                          <option value="">Usar modelo configurado en el perfil</option>
                          {state.openaiModels.map((id) => <option key={id} value={id}>{id}</option>)}
                        </select>
                      </div>
                    )}
                  </div>
                  <div className="spellcheck-option" style={{ marginTop: 8 }}>
                    <label className="spellcheck-label">
                      <input type="radio" checked={state.providerMode === "gemini"} onChange={() => setState(prev => ({ ...prev, providerMode: "gemini" }))} disabled={!state.hasPersonalGemini} />
                      <span>Gemini</span>
                    </label>
                    {!state.hasPersonalGemini && state.providerMode === "gemini" && <small className="spellcheck-note">No hay una key personal de Gemini configurada.</small>}
                    {state.hasPersonalGemini && (
                      <div className="profile-model-section">
                        <label className="profile-input-label">Modelo personal de Gemini</label>
                        <select className="profile-select" value={state.personalGeminiModel} onChange={(e) => setState(prev => ({ ...prev, personalGeminiModel: e.target.value }))}>
                          <option value="">Usar modelo configurado en el perfil</option>
                          {state.geminiModels.map((id) => <option key={id} value={id}>{id}</option>)}
                        </select>
                      </div>
                    )}
                  </div>
                  <div className="spellcheck-option" style={{ marginTop: 8 }}>
                    <div className="profile-input-label" style={{ marginBottom: 6 }}>
                      Confianza (retraducción, más costo)
                    </div>
                    <label className="spellcheck-label" style={{ display: "flex", alignItems: "flex-start", gap: 8 }}>
                      <input
                        type="checkbox"
                        checked={state.confidenceTextSimilarity}
                        onChange={(e) =>
                          setState((prev) => ({
                            ...prev,
                            confidenceTextSimilarity: e.target.checked,
                          }))
                        }
                      />
                      <span>
                        Similitud de texto (léxica)
                        <span style={{ marginLeft: 6, display: "inline-flex", verticalAlign: "middle" }}>
                          <LandingFloatingHelp text="Compara el parecido entre el original y la retraducción (palabras y forma)." />
                        </span>
                      </span>
                    </label>
                    <label className="spellcheck-label" style={{ display: "flex", alignItems: "flex-start", gap: 8, marginTop: 6 }}>
                      <input
                        type="checkbox"
                        checked={state.confidenceEmbeddingSimilarity}
                        onChange={(e) =>
                          setState((prev) => ({
                            ...prev,
                            confidenceEmbeddingSimilarity: e.target.checked,
                          }))
                        }
                      />
                      <span>
                        Similitud por embeddings (significado)
                        <span style={{ marginLeft: 6, display: "inline-flex", verticalAlign: "middle" }}>
                          <LandingFloatingHelp text="Compara vectores del original y la retraducción; puede marcar bien una traducción aunque cambien las palabras. No requiere activar similitud de texto." />
                        </span>
                      </span>
                    </label>
                    {state.confidenceEmbeddingSimilarity && (
                      <div className="profile-model-section" style={{ marginTop: 8 }}>
                        <label className="profile-input-label">Modelo de embeddings</label>
                        <select
                          className="profile-select"
                          value={state.confidenceEmbeddingModel}
                          onChange={(e) =>
                            setState((prev) => ({
                              ...prev,
                              confidenceEmbeddingModel: e.target.value,
                            }))
                          }
                        >
                          <option value="">Seleccionar modelo</option>
                          {(state.providerMode === "openai"
                            ? state.openaiEmbeddingModels
                            : state.geminiEmbeddingModels
                          ).map((id) => (
                            <option key={id} value={id}>
                              {id}
                            </option>
                          ))}
                        </select>
                      </div>
                    )}
                  </div>
                  <div className="info-note" style={{ marginTop: 12 }}>
                    <AlertCircle size={16} />
                    <span>¿Querés usar tu propia API key? Configurala en tu perfil o{" "}
                      <button type="button" className="landing-link-button" onClick={() => navigate("/profile", { state: { from: "landing" } })}>clickeando aquí</button>.
                    </span>
                  </div>
                </div>
              )}
            </div>
            <div className="info-note"><AlertCircle size={16} /><span>Archivos con <Globe size={12} /> son globales. Los archivos se usarán en el orden de prioridad indicado</span></div>
          </div>
          <div className="work-panel">
            <div className="work-header">
              <h3>Subir archivo a localizar</h3>
              {state.selectedFile && (
                <div className="selected-file-info">
                  <FileSpreadsheet size={20} />
                  <div><strong>Archivo:</strong> <small>{state.selectedFile.name}</small></div>
                </div>
              )}
            </div>
            <div className="drop-area unified" onDragOver={(e) => { e.preventDefault(); e.currentTarget.classList.add("drag-over"); }} onDragLeave={(e) => { e.preventDefault(); e.currentTarget.classList.remove("drag-over"); }} onDrop={async (e) => { e.preventDefault(); e.currentTarget.classList.remove("drag-over"); const file = e.dataTransfer.files[0]; if (file) await handleFileUpload(file); }} onClick={() => document.getElementById("file-upload")?.click()}>
              <div className="drop-icon"><FileSpreadsheet size={48} /></div>
              <p className="drop-title">Arrastra o haz click</p>
              <p className="drop-description">Archivo a localizar (.csv o .xlsx)</p>
              <input id="file-upload" type="file" accept=".csv,.xlsx" onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) handleFileUpload(file);
                e.target.value = "";
              }} style={{ display: "none" }} />
            </div>
            <div className="spellcheck-option">
              <label className="spellcheck-label">
                <input 
                  type="checkbox" 
                  checked={state.spellCheck || state.spellCheckBeforeTranslate} 
                  onChange={(e) => {
                    const checked = e.target.checked;
                    setState(prev => ({ 
                      ...prev, 
                      spellCheck: checked,
                      spellCheckBeforeTranslate: checked 
                    }));
                  }} 
                />
                <span className="spellcheck-text">
                  <Sparkles size={16} className="spellcheck-icon" />
                  Revisar ortografía con IA
                </span>
              </label>
              <small className="spellcheck-note">
                Corrige automáticamente errores ortográficos y gramaticales antes de traducir
              </small>
            </div>
            <div className="action-section">
              {state.estimatingCost && (
                <div className="landing-token-estimate landing-token-estimate--loading">
                  <Binary size={22} className="landing-token-estimate-icon" aria-hidden />
                  <div className="landing-token-estimate-body">
                    <div className="landing-token-estimate-label">Estimación de tokens</div>
                    <div className="landing-token-estimate-value">
                      <span className="spinner-small" style={{ display: "inline-block", marginRight: 8 }} />
                      Calculando…
                    </div>
                  </div>
                </div>
              )}
              {!state.estimatingCost && state.estimatedTokens > 0 && (
                <div className="landing-token-estimate">
                  <Binary size={22} className="landing-token-estimate-icon" aria-hidden />
                  <div className="landing-token-estimate-body">
                    <div className="landing-token-estimate-label">Estimación de tokens (aprox.)</div>
                    <div className="landing-token-estimate-value">
                      {state.estimatedTokens.toLocaleString()} tokens
                    </div>
                    <div className="landing-token-estimate-hint">
                      Incluye traducción{state.spellCheck || state.spellCheckBeforeTranslate ? ", revisión ortográfica" : ""}, contextos y glosarios seleccionados.
                    </div>
                  </div>
                </div>
              )}
              <button className={`localize-btn ${state.selectedFile && state.targetLanguages.length > 0 && state.providerMode && ((state.providerMode === "openai" && state.hasPersonalOpenAI) || (state.providerMode === "gemini" && state.hasPersonalGemini)) && !(state.confidenceEmbeddingSimilarity && !state.confidenceEmbeddingModel) ? "active" : "disabled"}`} onClick={startLocalization} disabled={!state.selectedFile || !state.targetLanguages.length || !state.providerMode || (state.providerMode === "openai" && !state.hasPersonalOpenAI) || (state.providerMode === "gemini" && !state.hasPersonalGemini) || (state.confidenceEmbeddingSimilarity && !state.confidenceEmbeddingModel) || state.translating}>
                {state.translating ? (
                  <>
                    <div className="spinner-small" /> 
                    {state.spellCheck || state.spellCheckBeforeTranslate 
                      ? `Revisando... ${state.progressPercent}%` 
                      : `Procesando... ${state.progressPercent}%`}
                  </>
                ) : (
                  <>
                    <Download size={20} /> 
                    {state.selectedFile && state.targetLanguages.length > 0
                      ? `Iniciar Localización (${state.targetLanguages.length} idioma${state.targetLanguages.length > 1 ? "s" : ""})`
                      : "Iniciar Localización"}
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      </div>
    </PageWithNavbar>
  );
};

export default Landing;