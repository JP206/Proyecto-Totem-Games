// src/renderer/src/pages/ContextsGlossaries.tsx
import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import DesktopManager from "../utils/desktop";
import Navbar from "../components/Navbar";
import {
  BookOpen,
  FileText,
  Plus,
  Search,
  AlertCircle,
  CheckCircle,
  X,
  Edit2,
  Trash2,
  Upload,
  Globe,
  Lock,
  AlertTriangle,
  Eye,
  Table,
  RefreshCw,
} from "lucide-react";
import "../styles/contextsGlossaries.css";

interface ContextGlossaryFile {
  name: string;
  path: string;
  content: string;
  type: "context" | "glossary";
  specificity: "general" | "specific";
  recommended?: boolean;
}

interface CsvRow {
  [key: string]: string;
}

const GENERAL_REPO = { name: "repo-general-totem-games", owner: "Proyecto-Final-de-Grado" };

const ContextsGlossaries: React.FC = () => {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState<"contexts" | "glossaries">("contexts");
  const [items, setItems] = useState<ContextGlossaryFile[]>([]);
  const [selectedItem, setSelectedItem] = useState<ContextGlossaryFile | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isViewModalOpen, setIsViewModalOpen] = useState(false);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [updatingGeneral, setUpdatingGeneral] = useState(false);
  const [notification, setNotification] = useState<{
    type: "success" | "error" | "warning";
    message: string;
  } | null>(null);
  const [currentProject, setCurrentProject] = useState<{
    repoPath: string;
    repoName: string;
    repoOwner: string;
  } | null>(null);
  const [generalRepoPath, setGeneralRepoPath] = useState("");

  // Form state
  const [editedTitle, setEditedTitle] = useState("");
  const [editedContent, setEditedContent] = useState("");
  const [editedRows, setEditedRows] = useState<CsvRow[]>([]);
  const [csvHeaders, setCsvHeaders] = useState<string[]>([]);
  const [hasChanges, setHasChanges] = useState(false);
  const [itemToDelete, setItemToDelete] = useState<ContextGlossaryFile | null>(null);
  const [viewItem, setViewItem] = useState<ContextGlossaryFile | null>(null);

  useEffect(() => {
    loadProjectAndData();
  }, []);

  const showNotification = (type: "success" | "error" | "warning", message: string) => {
    setNotification({ type, message });
    setTimeout(() => setNotification(null), 3000);
  };

  const loadProjectAndData = async () => {
    try {
      setLoading(true);
      const desktop = DesktopManager.getInstance();

      const token = await desktop.getConfig("github_token");
      if (!token) {
        showNotification("warning", "Debes iniciar sesión");
        setTimeout(() => navigate("/login"), 2000);
        return;
      }

      const project = await desktop.getConfig("current_project");
      if (!project?.repoName) {
        showNotification("error", "No hay proyecto seleccionado");
        setTimeout(() => navigate("/dashboard"), 2000);
        return;
      }

      setCurrentProject(project);
      const lastSep = Math.max(project.repoPath.lastIndexOf("/"), project.repoPath.lastIndexOf("\\"));
      const basePath = lastSep >= 0 ? project.repoPath.substring(0, lastSep) : project.repoPath;
      const generalPath = await ensureGeneralRepo(basePath);
      setGeneralRepoPath(generalPath);

      await loadData(project, generalPath);
    } catch (error: any) {
      showNotification("error", error.message);
      setTimeout(() => navigate("/dashboard"), 2000);
    } finally {
      setLoading(false);
    }
  };

  const ensureGeneralRepo = async (basePath: string): Promise<string> => {
    const desktop = DesktopManager.getInstance();
    const token = await desktop.getConfig("github_token");
    const generalPath = `${basePath}/${GENERAL_REPO.name}`;

    try {
      setUpdatingGeneral(true);
      const exists = await desktop.fileExists(generalPath);

      if (!exists) {
        await desktop.cloneRepository({
          url: `https://github.com/${GENERAL_REPO.owner}/${GENERAL_REPO.name}.git`,
          destination: generalPath,
          token,
        });
      }
      return generalPath;
    } catch (error) {
      console.error("Error con repo general:", error);
      return "";
    } finally {
      setUpdatingGeneral(false);
    }
  };

  const loadData = async (project: any, generalPath: string) => {
    try {
      const desktop = DesktopManager.getInstance();
      
      const [specificContexts, specificGlossaries, generalContexts, generalGlossaries] = await Promise.all([
        loadSpecificContexts(project.repoPath),
        loadSpecificGlossaries(project.repoPath),
        loadGeneralContexts(generalPath),
        loadGeneralGlossaries(generalPath),
      ]);

      setItems([...generalContexts, ...generalGlossaries, ...specificContexts, ...specificGlossaries]);
    } catch (error) {
      console.error("Error cargando datos:", error);
      showNotification("error", "Error al cargar los datos");
    } finally {
      setLoading(false);
    }
  };

  const loadSpecificContexts = async (repoPath: string): Promise<ContextGlossaryFile[]> => {
    try {
      const desktop = DesktopManager.getInstance();
      const contextsPath = `${repoPath}/Localizacion/contextos_especificos`;
      const exists = await desktop.fileExists(contextsPath).catch(() => false);
      if (!exists) return [];

      const files = await desktop.readFolder(contextsPath);
      const txtFiles = files.filter((f: any) => f.isFile && f.name.toLowerCase().endsWith(".txt"));

      const items: ContextGlossaryFile[] = [];
      for (const f of txtFiles) {
        const content = await desktop.readFile(f.path);
        items.push({
          name: f.name,
          path: f.path,
          content,
          type: "context",
          specificity: "specific",
          recommended: f.name.includes("recomendado") || f.name.includes("recommended"),
        });
      }
      return items;
    } catch {
      return [];
    }
  };

  const loadSpecificGlossaries = async (repoPath: string): Promise<ContextGlossaryFile[]> => {
    try {
      const desktop = DesktopManager.getInstance();
      const glossariesPath = `${repoPath}/Localizacion/glosarios_especificos`;
      const exists = await desktop.fileExists(glossariesPath).catch(() => false);
      if (!exists) return [];

      const files = await desktop.readFolder(glossariesPath);
      const csvFiles = files.filter((f: any) => f.isFile && f.name.toLowerCase().endsWith(".csv"));

      const items: ContextGlossaryFile[] = [];
      for (const f of csvFiles) {
        const content = await desktop.readFile(f.path);
        items.push({
          name: f.name,
          path: f.path,
          content,
          type: "glossary",
          specificity: "specific",
          recommended: f.name.includes("recomendado") || f.name.includes("recommended"),
        });
      }
      return items;
    } catch {
      return [];
    }
  };

  const loadGeneralContexts = async (generalPath: string): Promise<ContextGlossaryFile[]> => {
    if (!generalPath) return [];

    try {
      const desktop = DesktopManager.getInstance();
      const contextsPath = `${generalPath}/contextos_generales`;
      const exists = await desktop.fileExists(contextsPath).catch(() => false);
      if (!exists) return [];

      const files = await desktop.readFolder(contextsPath);
      const txtFiles = files.filter((f: any) => f.isFile && f.name.toLowerCase().endsWith(".txt"));

      const items: ContextGlossaryFile[] = [];
      for (const f of txtFiles) {
        const content = await desktop.readFile(f.path);
        items.push({
          name: f.name,
          path: f.path,
          content,
          type: "context",
          specificity: "general",
          recommended: f.name.includes("recomendado") || f.name.includes("recommended"),
        });
      }
      return items;
    } catch {
      return [];
    }
  };

  const loadGeneralGlossaries = async (generalPath: string): Promise<ContextGlossaryFile[]> => {
    if (!generalPath) return [];

    try {
      const desktop = DesktopManager.getInstance();
      const glossariesPath = `${generalPath}/glosarios_generales`;
      const exists = await desktop.fileExists(glossariesPath).catch(() => false);
      if (!exists) return [];

      const files = await desktop.readFolder(glossariesPath);
      const csvFiles = files.filter((f: any) => f.isFile && f.name.toLowerCase().endsWith(".csv"));

      const items: ContextGlossaryFile[] = [];
      for (const f of csvFiles) {
        const content = await desktop.readFile(f.path);
        items.push({
          name: f.name,
          path: f.path,
          content,
          type: "glossary",
          specificity: "general",
          recommended: f.name.includes("recomendado") || f.name.includes("recommended"),
        });
      }
      return items;
    } catch {
      return [];
    }
  };

  const parseCSV = (csvContent: string): { headers: string[], rows: CsvRow[] } => {
    const lines = csvContent.split('\n').filter(line => line.trim());
    if (lines.length === 0) return { headers: [], rows: [] };
    
    const headers = lines[0].split(',').map(h => h.trim());
    const rows = lines.slice(1).map(line => {
      const values = line.split(',').map(v => v.trim());
      const row: CsvRow = {};
      headers.forEach((header, index) => {
        row[header] = values[index] || '';
      });
      return row;
    });
    
    return { headers, rows };
  };

  const stringifyCSV = (headers: string[], rows: CsvRow[]): string => {
    const headerLine = headers.join(',');
    const rowLines = rows.map(row => 
      headers.map(header => row[header] || '').join(',')
    );
    return [headerLine, ...rowLines].join('\n');
  };

  const handleAddNew = () => {
    setSelectedItem(null);
    setEditedTitle("");
    setEditedContent("");
    setEditedRows([]);
    setCsvHeaders([]);
    setHasChanges(false);
    setIsModalOpen(true);
  };

  const handleView = (item: ContextGlossaryFile) => {
    setViewItem(item);
    if (item.type === "glossary") {
      const { headers, rows } = parseCSV(item.content);
      setCsvHeaders(headers);
      setEditedRows(rows);
    }
    setIsViewModalOpen(true);
  };

  const handleEdit = (item: ContextGlossaryFile) => {
    setSelectedItem(item);
    setEditedTitle(item.name.replace(/\.(txt|csv)$/, ""));
    setEditedContent(item.content);
    if (item.type === "glossary") {
      const { headers, rows } = parseCSV(item.content);
      setCsvHeaders(headers);
      setEditedRows(rows);
    }
    setHasChanges(false);
    setIsModalOpen(true);
  };

  const handleDelete = (item: ContextGlossaryFile) => {
    setItemToDelete(item);
    setIsDeleteModalOpen(true);
  };

  const confirmDelete = async () => {
    if (!itemToDelete || !currentProject) return;

    try {
      setSyncing(true);
      const desktop = DesktopManager.getInstance();
      
      await desktop.deleteFile(itemToDelete.path);
      
      await desktop.gitCommand({ 
        command: `git rm "${itemToDelete.path}"`, 
        cwd: currentProject.repoPath 
      }).catch(() => {});
      await desktop.gitCommand({ 
        command: `git commit -m "Delete ${itemToDelete.name}"`, 
        cwd: currentProject.repoPath 
      });
      await desktop.gitCommand({ 
        command: "git push origin main", 
        cwd: currentProject.repoPath 
      });
      
      await loadData(currentProject, generalRepoPath);
      
      showNotification("success", `"${itemToDelete.name}" eliminado correctamente`);
      setIsDeleteModalOpen(false);
      setItemToDelete(null);
    } catch (error: any) {
      showNotification("error", error.message);
    } finally {
      setSyncing(false);
    }
  };

  const handleRowChange = (rowIndex: number, value: string) => {
    const newRows = [...editedRows];
    newRows[rowIndex]["Palabra"] = value;
    setEditedRows(newRows);
    setHasChanges(true);
  };

  const handleAddRow = () => {
    setEditedRows([...editedRows, { Palabra: "" }]);
    setHasChanges(true);
  };

  const handleDeleteRow = (rowIndex: number) => {
    setEditedRows(editedRows.filter((_, i) => i !== rowIndex));
    setHasChanges(true);
  };

  const handleContentChange = (value: string) => {
    setEditedContent(value);
    setHasChanges(true);
  };

  const saveItem = async () => {
    if (!editedTitle.trim() || !currentProject) return;
    if (activeTab === "contexts" && !editedContent.trim()) return;

    try {
      setSyncing(true);
      const desktop = DesktopManager.getInstance();
      
      let contentToSave = editedContent;
      if (activeTab === "glossaries") {
        const headers = ["Palabra"];
        const rows = editedRows.map(row => ({ Palabra: row.Palabra || "" }));
        contentToSave = stringifyCSV(headers, rows);
      }

      const extension = activeTab === "contexts" ? ".txt" : ".csv";
      const targetFolder = activeTab === "contexts"
        ? `${currentProject.repoPath}/Localizacion/contextos_especificos`
        : `${currentProject.repoPath}/Localizacion/glosarios_especificos`;

      const folderExists = await desktop.fileExists(targetFolder).catch(() => false);
      if (!folderExists) {
        await desktop.createFolder(targetFolder);
      }

      const newPath = `${targetFolder}/${editedTitle}${extension}`;
      const normalizePath = (path: string) => path.replace(/\\/g, '/');
      
      if (selectedItem) {
        const oldPath = selectedItem.path;
        const isSamePath = normalizePath(oldPath) === normalizePath(newPath);
        
        if (!isSamePath) {
          await desktop.writeFile(newPath, contentToSave);
          await desktop.deleteFile(oldPath);
          
          await desktop.gitCommand({ command: `git add "${newPath}"`, cwd: currentProject.repoPath });
          await desktop.gitCommand({ command: `git rm "${oldPath}"`, cwd: currentProject.repoPath }).catch(() => {});
          await desktop.gitCommand({ command: `git commit -m "Rename ${selectedItem.name} to ${editedTitle}${extension}"`, cwd: currentProject.repoPath });
          await desktop.gitCommand({ command: "git push origin main", cwd: currentProject.repoPath });
        } else {
          await desktop.writeFile(oldPath, contentToSave);
          
          await desktop.gitCommand({ command: `git add "${oldPath}"`, cwd: currentProject.repoPath });
          await desktop.gitCommand({ command: `git commit -m "Update ${editedTitle}${extension}"`, cwd: currentProject.repoPath });
          await desktop.gitCommand({ command: "git push origin main", cwd: currentProject.repoPath });
        }
      } else {
        await desktop.writeFile(newPath, contentToSave);
        
        await desktop.gitCommand({ command: `git add "${newPath}"`, cwd: currentProject.repoPath });
        await desktop.gitCommand({ command: `git commit -m "Add ${editedTitle}${extension}"`, cwd: currentProject.repoPath });
        await desktop.gitCommand({ command: "git push origin main", cwd: currentProject.repoPath });
      }
      
      await new Promise(resolve => setTimeout(resolve, 1000));
      await loadData(currentProject, generalRepoPath);

      setIsModalOpen(false);
      setSelectedItem(null);
      setEditedTitle("");
      setEditedContent("");
      setEditedRows([]);
      setCsvHeaders([]);
      setHasChanges(false);
      showNotification("success", `"${editedTitle}${extension}" guardado correctamente`);
      
    } catch (error: any) {
      console.error("Error al guardar:", error);
      showNotification("error", error.message);
    } finally {
      setSyncing(false);
    }
  };

  const refreshData = async () => {
    if (!currentProject) return;
    
    try {
      setLoading(true);
      const desktop = DesktopManager.getInstance();
      
      await desktop.gitCommand({ command: "git pull origin main", cwd: currentProject.repoPath }).catch(() => {});
      
      if (generalRepoPath) {
        await desktop.gitCommand({ command: "git pull origin main", cwd: generalRepoPath }).catch(() => {});
      }
      
      await loadData(currentProject, generalRepoPath);
      showNotification("success", "Datos actualizados correctamente");
    } catch (error) {
      showNotification("error", "Error al actualizar datos");
    } finally {
      setLoading(false);
    }
  };

  const filteredItems = items.filter(
    (item) =>
      item.type === (activeTab === "contexts" ? "context" : "glossary") &&
      (item.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        item.content.toLowerCase().includes(searchTerm.toLowerCase()))
  );

  const generalItems = filteredItems.filter(item => item.specificity === "general");
  const specificItems = filteredItems.filter(item => item.specificity === "specific");

  const renderGeneralSection = () => (
    <div className="items-section">
      <h3 className="section-title">
        <Globe size={18} />
        Generales (compartidos)
      </h3>
      <div className="items-grid">
        {generalItems.length > 0 ? (
          generalItems.map((item) => (
            <div key={item.path} className={`item-card general`} onClick={() => handleView(item)}>
              <h4 className="item-title">{item.name.replace(/\.(txt|csv)$/, "")}</h4>
              <p className="item-content">
                {item.type === "context" 
                  ? item.content.substring(0, 150) + (item.content.length > 150 ? "..." : "")
                  : `${item.type === "glossary" ? "Glosario" : ""}`
                }
              </p>
              <div className="item-footer">
                <span className="item-specificity">
                  <Globe size={12} /> General
                </span>
                {item.recommended && (
                  <span className="recommended-badge">✨ recomendado</span>
                )}
              </div>
              <div className="item-readonly-badge">
                <Eye size={10} /> Solo lectura
              </div>
            </div>
          ))
        ) : (
          <div className="empty-items">
            <Globe size={48} />
            <p>No hay {activeTab === "contexts" ? "contextos" : "glosarios"} generales</p>
          </div>
        )}
      </div>
    </div>
  );

  const renderSpecificSection = () => (
    <div className="items-section">
      <h3 className="section-title">
        <Lock size={18} />
        Específicos del proyecto
      </h3>
      <div className="items-grid">
        {specificItems.length > 0 ? (
          specificItems.map((item) => (
            <div key={item.path} className={`item-card specific`}>
              <div className="item-actions">
                <button 
                  className="item-action-btn edit" 
                  onClick={(e) => {
                    e.stopPropagation();
                    handleEdit(item);
                  }}
                  title="Editar"
                >
                  <Edit2 size={14} />
                </button>
                <button 
                  className="item-action-btn delete" 
                  onClick={(e) => {
                    e.stopPropagation();
                    handleDelete(item);
                  }}
                  title="Eliminar"
                >
                  <Trash2 size={14} />
                </button>
              </div>
              <div onClick={() => handleView(item)}>
                <h4 className="item-title">{item.name.replace(/\.(txt|csv)$/, "")}</h4>
                <p className="item-content">
                  {item.type === "context" 
                    ? item.content.substring(0, 150) + (item.content.length > 150 ? "..." : "")
                    : `${item.type === "glossary" ? "Glosario" : ""}`
                  }
                </p>
                <div className="item-footer">
                  <span className="item-specificity">
                    <Lock size={12} /> Específico
                  </span>
                  {item.recommended && (
                    <span className="recommended-badge">✨ recomendado</span>
                  )}
                </div>
              </div>
            </div>
          ))
        ) : (
          <div className="empty-items">
            <Lock size={48} />
            <p>No hay {activeTab === "contexts" ? "contextos" : "glosarios"} específicos</p>
            <button className="add-small-btn" onClick={handleAddNew}>
              <Plus size={14} /> Crear nuevo
            </button>
          </div>
        )}
      </div>
    </div>
  );

  const renderTableView = (rows: CsvRow[], isEditing: boolean = false) => (
    <div className="table-container">
      <table className="csv-table">
        <thead>
          <tr>
            <th>Palabra / Frase</th>
            {isEditing && <th className="actions-header">Acciones</th>}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, rowIndex) => (
            <tr key={rowIndex}>
              <td>
                <input
                  type="text"
                  value={row.Palabra || ''}
                  onChange={(e) => handleRowChange(rowIndex, e.target.value)}
                  className="table-input"
                  placeholder="Escribe una palabra o frase..."
                />
              </td>
              {isEditing && (
                <td className="actions-cell">
                  <button
                    className="table-delete-btn"
                    onClick={() => handleDeleteRow(rowIndex)}
                    title="Eliminar fila"
                  >
                    <Trash2 size={14} />
                  </button>
                </td>
              )}
            </tr>
          ))}
        </tbody>
      </table>
      {isEditing && (
        <button className="add-row-btn" onClick={handleAddRow}>
          <Plus size={14} /> Añadir palabra
        </button>
      )}
    </div>
  );

  if (loading) {
    return (
      <>
        <Navbar />
        <div className="contexts-container">
          <div className="loading-state">
            <div className="spinner-large" />
            <p>Cargando...</p>
          </div>
        </div>
      </>
    );
  }

  return (
    <>
      <Navbar />
      <div className="contexts-container">
        {syncing && (
          <div className="syncing-overlay">
            <div className="syncing-content">
              <div className="spinner-large" />
              <p>Sincronizando con GitHub...</p>
            </div>
          </div>
        )}

        {updatingGeneral && (
          <div className="general-update-notification">
            <div className="spinner-small" />
            <span>Actualizando repositorio general...</span>
          </div>
        )}

        {notification && (
          <div className={`notification ${notification.type}`}>
            {notification.type === "success" && <CheckCircle size={18} />}
            {notification.type === "error" && <AlertCircle size={18} />}
            {notification.type === "warning" && <AlertTriangle size={18} />}
            <span>{notification.message}</span>
          </div>
        )}

        <div className="contexts-header">
          <h2>
            <BookOpen size={24} />
            Contextos y Glosarios
          </h2>
          <div className="header-actions">
            <button className="refresh-btn" onClick={refreshData} disabled={syncing}>
              <RefreshCw size={16} />
              Actualizar
            </button>
            <button className="add-btn" onClick={handleAddNew} disabled={syncing}>
              <Plus size={16} />
              NUEVO ESPECÍFICO
            </button>
          </div>
        </div>

        <div className="contexts-tabs">
          <button 
            className={`contexts-tab ${activeTab === "contexts" ? "active" : ""}`}
            onClick={() => setActiveTab("contexts")}
          >
            <FileText size={16} />
            CONTEXTOS
          </button>
          <button 
            className={`contexts-tab ${activeTab === "glossaries" ? "active" : ""}`}
            onClick={() => setActiveTab("glossaries")}
          >
            <Table size={16} />
            GLOSARIOS
          </button>
        </div>

        <div className="search-container">
          <Search size={16} className="search-icon" />
          <input 
            type="text" 
            placeholder="Buscar..." 
            className="search-input"
            value={searchTerm} 
            onChange={(e) => setSearchTerm(e.target.value)} 
          />
        </div>

        {renderGeneralSection()}
        {renderSpecificSection()}
      </div>

      {/* Modal de visualización */}
      {isViewModalOpen && viewItem && (
        <div className="modal-overlay" onClick={() => setIsViewModalOpen(false)}>
          <div className="modal large" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3>
                <Eye size={20} />
                {viewItem.type === "context" ? "Contexto" : "Glosario"} {viewItem.specificity === "general" ? "General" : "Específico"}
              </h3>
              <div className="modal-header-actions">
                {viewItem.specificity === "specific" && (
                  <>
                    <button className="modal-action-btn" onClick={() => {
                      setIsViewModalOpen(false);
                      handleEdit(viewItem);
                    }} title="Editar">
                      <Edit2 size={16} />
                    </button>
                    <button className="modal-action-btn delete" onClick={() => {
                      setIsViewModalOpen(false);
                      handleDelete(viewItem);
                    }} title="Eliminar">
                      <Trash2 size={16} />
                    </button>
                  </>
                )}
                <button className="modal-close" onClick={() => setIsViewModalOpen(false)}>
                  <X size={18} />
                </button>
              </div>
            </div>
            <div className="modal-content">
              <div className="modal-field">
                <label>Título</label>
                <div className="view-field">{viewItem.name.replace(/\.(txt|csv)$/, "")}</div>
              </div>
              <div className="modal-field">
                <label>Contenido</label>
                {viewItem.type === "context" ? (
                  <div className="view-field content">{viewItem.content}</div>
                ) : (
                  renderTableView(editedRows, false)
                )}
              </div>
            </div>
            <div className="modal-actions">
              <button className="cancel-btn" onClick={() => setIsViewModalOpen(false)}>
                Cerrar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal de edición/creación */}
      {isModalOpen && (
        <div className="modal-overlay" onClick={() => setIsModalOpen(false)}>
          <div className="modal large" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3>
                {selectedItem ? <><Edit2 size={20} /> Editar</> : <><Plus size={20} /> Nuevo</>}
              </h3>
              <button className="modal-close" onClick={() => setIsModalOpen(false)}>
                <X size={18} />
              </button>
            </div>
            <div className="modal-content">
              <div className="modal-field">
                <label>Título</label>
                <input 
                  type="text" 
                  value={editedTitle} 
                  onChange={(e) => setEditedTitle(e.target.value)} 
                  placeholder={`Título del ${activeTab === "contexts" ? "contexto" : "glosario"}`}
                />
              </div>
              <div className="modal-field">
                <label>Contenido</label>
                {activeTab === "contexts" ? (
                  <textarea 
                    value={editedContent} 
                    onChange={(e) => handleContentChange(e.target.value)} 
                    rows={10}
                    placeholder="Describe el contexto..."
                  />
                ) : (
                  renderTableView(editedRows, true)
                )}
              </div>
            </div>
            <div className="modal-actions">
              <button 
                className="save-btn" 
                onClick={saveItem} 
                disabled={
                  !editedTitle.trim() || 
                  (activeTab === "contexts" ? !editedContent.trim() : false) ||
                  !hasChanges
                }
              >
                <Upload size={14} /> {selectedItem ? "Actualizar" : "Crear"}
              </button>
              <button className="cancel-btn" onClick={() => setIsModalOpen(false)}>
                Cancelar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal de eliminación */}
      {isDeleteModalOpen && itemToDelete && (
        <div className="modal-overlay" onClick={() => setIsDeleteModalOpen(false)}>
          <div className="modal small" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3>
                <AlertTriangle size={20} className="warning-icon" />
                ¿Eliminar?
              </h3>
              <button className="modal-close" onClick={() => setIsDeleteModalOpen(false)}>
                <X size={18} />
              </button>
            </div>
            <div className="modal-content">
              <p>Se eliminará: <strong>"{itemToDelete.name.replace(/\.(txt|csv)$/, "")}"</strong></p>
              <p className="warning-text">Esta acción no se puede deshacer.</p>
            </div>
            <div className="modal-actions">
              <button className="delete-btn" onClick={confirmDelete}>
                <Trash2 size={14} /> Eliminar
              </button>
              <button className="cancel-btn" onClick={() => setIsDeleteModalOpen(false)}>
                Cancelar
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export default ContextsGlossaries;