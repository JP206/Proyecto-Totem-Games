// src/renderer/src/pages/Issues.tsx
import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import DesktopManager from "../utils/desktop";
import Navbar from "../components/Navbar";
import { IssueData } from "../utils/electron";
import { 
  Flag, 
  Plus, 
  Filter, 
  X, 
  Calendar,
  CheckCircle,
  AlertCircle 
} from "lucide-react";
import "../styles/issues.css";

export default function Issues() {
  const navigate = useNavigate();
  const [issues, setIssues] = useState<any[]>([]);
  const [selectedIssue, setSelectedIssue] = useState<any | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editedTitle, setEditedTitle] = useState("");
  const [editedDescription, setEditedDescription] = useState("");
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<"all" | "open" | "closed">("all");
  const [currentProject, setCurrentProject] = useState<{ 
    repoPath: string; 
    repoName: string;
    repoOwner: string;
  } | null>(null);

  useEffect(() => {
    loadProjectAndIssues();
  }, []);

  const loadProjectAndIssues = async () => {
    try {
      setLoading(true);
      const desktop = DesktopManager.getInstance();
      
      const token = await desktop.getConfig("github_token");
      if (!token) {
        await desktop.showMessage(
          "Debes iniciar sesión para acceder a esta sección",
          "Acceso denegado",
          "warning"
        );
        navigate('/login');
        return;
      }

      const project = await desktop.getConfig("current_project");
      if (!project?.repoName || !project?.repoOwner) {
        await desktop.showMessage(
          "No hay un proyecto seleccionado",
          "Error",
          "error"
        );
        navigate('/dashboard');
        return;
      }

      setCurrentProject(project);
      await loadIssues(project, token);
      
    } catch (error: any) {
      const desktop = DesktopManager.getInstance();
      await desktop.showMessage(
        error.message || "Error al cargar el proyecto",
        "Error",
        "error"
      );
      navigate('/dashboard');
    }
  };

  const loadIssues = async (project: { repoName: string; repoOwner: string }, token: string) => {
    try {
      setLoading(true);
      const desktop = DesktopManager.getInstance();

      const data = await desktop.getIssues(
        {
          repoName: project.repoName,
          repoOwner: project.repoOwner,
          token,
        },
        "bug"
      );

      const formattedIssues = data
        .filter((issue: any) => !issue.pull_request)
        .map((issue: any) => ({
          id: issue.number,
          title: issue.title,
          description: issue.body,
          date: new Date(issue.created_at).toLocaleDateString(),
          status: issue.state,
        }));

      setIssues(formattedIssues);
    } catch (error: any) {
      const desktop = DesktopManager.getInstance();
      await desktop.showMessage(
        error.message || "Error al cargar los issues",
        "Error",
        "error"
      );
    } finally {
      setLoading(false);
    }
  };

  const markAsResolved = async () => {
    try {
      const desktop = DesktopManager.getInstance();
      const token = await desktop.getConfig("github_token");
      if (!token || !currentProject) return;

      await desktop.markIssueAsResolved(selectedIssue.id, {
        repoName: currentProject.repoName,
        repoOwner: currentProject.repoOwner,
        token,
      });

      await desktop.showMessage(
        `Issue #${selectedIssue.id} marcado como resuelto`,
        "Éxito",
        "info"
      );

      await loadIssues(currentProject, token);
      setIsModalOpen(false);
      setSelectedIssue(null);
    } catch (error: any) {
      const desktop = DesktopManager.getInstance();
      await desktop.showMessage(
        error.message || "Error al marcar issue como resuelto",
        "Error",
        "error"
      );
    }
  };

  const editIssue = async () => {
    try {
      const desktop = DesktopManager.getInstance();
      const token = await desktop.getConfig("github_token");
      if (!token || !currentProject) return;

      let response;

      if (!selectedIssue) {
        let issueData: IssueData = {
          title: editedTitle,
          description: editedDescription,
          id: null,
          assignees: null,
          labels: ["bug"]
        };

        response = await desktop.createIssue(issueData, {
          repoName: currentProject.repoName,
          repoOwner: currentProject.repoOwner,
          token
        });

        if (response) {
          await desktop.showMessage(
            "Issue creado exitosamente",
            "Éxito",
            "info"
          );
        }
      } else {
        let issueData: IssueData = {
          title: editedTitle,
          description: editedDescription,
          id: selectedIssue.id,
          assignees: null,
          labels: null
        };

        response = await desktop.editIssue(issueData, {
          repoName: currentProject.repoName,
          repoOwner: currentProject.repoOwner,
          token
        });

        if (response) {
          await desktop.showMessage(
            `Issue #${selectedIssue.id} actualizado`,
            "Éxito",
            "info"
          );
        }
      }

      if (response) {
        await loadIssues(currentProject, token);
        setIsModalOpen(false);
        setSelectedIssue(null);
        setEditedTitle("");
        setEditedDescription("");
      }
    } catch (error: any) {
      const desktop = DesktopManager.getInstance();
      await desktop.showMessage(
        error.message || "Error al guardar el issue",
        "Error",
        "error"
      );
    }
  };

  const openNewIssueModal = () => {
    setSelectedIssue(null);
    setEditedTitle("");
    setEditedDescription("");
    setIsModalOpen(true);
  };

  const openEditIssueModal = (issue: any) => {
    setSelectedIssue(issue);
    setEditedTitle(issue.title);
    setEditedDescription(issue.description);
    setIsModalOpen(true);
  };

  const filteredIssues = issues.filter(issue => {
    if (filter === "all") return true;
    return issue.status === filter;
  });

  if (loading && !currentProject) {
    return (
      <>
        <Navbar />
        <div className="issues-container">
          <div className="loading-state">
            <div className="spinner-large" />
            <p>Cargando proyecto...</p>
          </div>
        </div>
      </>
    );
  }

  return (
    <>
      <Navbar />
      <div className="issues-container">
        <div className="issues-header">
          <h2>
            <Flag size={24} />
            Issues del Proyecto
          </h2>
          <div className="header-actions">
            <button 
              className="filter-btn"
              onClick={() => setFilter(filter === "all" ? "open" : filter === "open" ? "closed" : "all")}
            >
              <Filter size={16} />
              {filter === "all" ? "Todos" : filter === "open" ? "Abiertos" : "Cerrados"}
            </button>
            <button className="add-btn" onClick={openNewIssueModal}>
              <Plus size={16} />
              Nuevo Issue
            </button>
          </div>
        </div>

        {loading ? (
          <div className="loading-state">
            <div className="spinner-large" />
            <p>Cargando issues...</p>
          </div>
        ) : (
          <div className="issues-table">
            <div className="table-header">
              <span>Issue</span>
              <span>Descripción</span>
              <span>Fecha</span>
              <span>Estado</span>
            </div>

            <div className="table-body">
              {filteredIssues.length > 0 ? (
                filteredIssues.map(issue => (
                  <div
                    key={issue.id}
                    className="issue-row"
                    onClick={() => openEditIssueModal(issue)}
                  >
                    <span className="issue-title">#{issue.id} - {issue.title}</span>
                    <span className="issue-description">
                      {issue.description?.substring(0, 100)}
                      {issue.description?.length > 100 ? '...' : ''}
                    </span>
                    <span className="issue-date">
                      <Calendar size={14} />
                      {issue.date}
                    </span>
                    <span className={`issue-status ${issue.status}`}>
                      {issue.status === 'open' ? (
                        <><AlertCircle size={12} /> Abierto</>
                      ) : (
                        <><CheckCircle size={12} /> Cerrado</>
                      )}
                    </span>
                  </div>
                ))
              ) : (
                <div className="empty-state">
                  <Flag size={48} />
                  <p>No hay issues disponibles para este proyecto</p>
                  <button className="add-btn" onClick={openNewIssueModal}>
                    <Plus size={16} />
                    Crear primer issue
                  </button>
                </div>
              )}
            </div>
          </div>
        )}

        {isModalOpen && (
          <div className="modal-overlay" onClick={() => setIsModalOpen(false)}>
            <div className="modal" onClick={e => e.stopPropagation()}>
              <div className="modal-header">
                <h3>
                  <Flag size={20} />
                  {selectedIssue ? `Editar Issue #${selectedIssue.id}` : "Nuevo Issue"}
                </h3>
                <button className="modal-close" onClick={() => setIsModalOpen(false)}>
                  <X size={18} />
                </button>
              </div>

              <div className="modal-field">
                <label>Título</label>
                <input
                  type="text"
                  placeholder="Título del issue"
                  value={editedTitle}
                  onChange={e => setEditedTitle(e.target.value)}
                />
              </div>

              <div className="modal-field">
                <label>Descripción</label>
                <textarea
                  placeholder="Describe el issue detalladamente..."
                  value={editedDescription}
                  onChange={e => setEditedDescription(e.target.value)}
                  rows={8}
                />
              </div>

              {selectedIssue && (
                <div className="modal-field">
                  <label>Estado actual</label>
                  <div className={`status-badge ${selectedIssue.status}`}>
                    {selectedIssue.status === 'open' ? (
                      <><AlertCircle size={12} /> Abierto</>
                    ) : (
                      <><CheckCircle size={12} /> Cerrado</>
                    )}
                  </div>
                </div>
              )}

              <div className="modal-actions">
                <button
                  className="save-btn"
                  onClick={editIssue}
                  disabled={!editedTitle.trim()}
                >
                  Guardar Cambios
                </button>

                {selectedIssue && selectedIssue.status !== "closed" && (
                  <button
                    className="resolve-btn"
                    onClick={markAsResolved}
                  >
                    Marcar como Resuelto
                  </button>
                )}

                <button className="cancel-btn" onClick={() => setIsModalOpen(false)}>
                  Cancelar
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </>
  );
}