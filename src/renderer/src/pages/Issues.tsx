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
  AlertCircle,
  User,
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
  const [syncing, setSyncing] = useState(false);
  const [currentUser, setCurrentUser] = useState<string>("");
  const [editedAssignee, setEditedAssignee] = useState("");
  const [contributors, setContributors] = useState<any[]>([]);
  const [notification, setNotification] = useState<{
    type: "success" | "error" | "warning";
    message: string;
  } | null>(null);
  const [currentProject, setCurrentProject] = useState<{
    repoPath: string;
    repoName: string;
    repoOwner: string;
  } | null>(null);

  let user: any = "Desconocido";

  useEffect(() => {
    loadProjectAndIssues();
  }, []);

  const showNotification = (type: "success" | "error" | "warning", message: string) => {
    setNotification({ type, message });
    setTimeout(() => setNotification(null), 3000);
  };

  const loadProjectAndIssues = async () => {
    try {
      setLoading(true);
      const desktop = DesktopManager.getInstance();

      const token = await desktop.getConfig("github_token");
      if (!token) {
        showNotification("warning", "Debes iniciar sesión para acceder a esta sección");
        setTimeout(() => navigate("/login"), 2000);
        return;
      }

      user = await desktop.getConfig("github_user");
      setCurrentUser(user?.login || "Desconocido");

      const project = await desktop.getConfig("current_project");
      if (!project?.repoName || !project?.repoOwner) {
        showNotification("error", "No hay un proyecto seleccionado");
        setTimeout(() => navigate("/dashboard"), 2000);
        return;
      }

      const contributors = await desktop.getContributors({
        repoName: project.repoName,
        repoOwner: project.repoOwner,
        token,
      });
      setContributors(contributors);

      setCurrentProject(project);
      await loadIssues(project, token);
    } catch (error: any) {
      showNotification("error", error.message || "Error al cargar el proyecto");
      setTimeout(() => navigate("/dashboard"), 2000);
    }
  };

  const loadIssues = async (
    project: { repoName: string; repoOwner: string },
    token: string,
  ) => {
    try {
      setLoading(true);
      const desktop = DesktopManager.getInstance();

      const user = await desktop.getConfig("github_user");
      setCurrentUser(user?.login || "Desconocido");

      // 3 requests because GitHub doesn't allow to filter all these at the same time
      const dataAssignedToSelf = await desktop.getIssuesVariable(
        {
          repoName: project.repoName,
          repoOwner: project.repoOwner,
          token,
        },
        {
          assignee: user.login,
          state: "open",
          labels: "bug",
        }
      );

      const dataNoAssignees = await desktop.getIssuesVariable(
        {
          repoName: project.repoName,
          repoOwner: project.repoOwner,
          token,
        },
        {
          assignee: "none",
          state: "open",
          labels: "bug",
        }
      );

      const dataClosed = await desktop.getIssuesVariable(
        {
          repoName: project.repoName,
          repoOwner: project.repoOwner,
          token,
        },
        {
          assignee: "*",
          state: "closed",
          labels: "bug",
        }
      );

      const data = [...dataAssignedToSelf, ...dataNoAssignees, ...dataClosed];

      const formattedIssues = data
        .filter((issue: any) => !issue.pull_request)
        .map((issue: any) => ({
          id: issue.number,
          title: issue.title,
          description: issue.body,
          date: new Date(issue.created_at).toLocaleDateString(),
          status: issue.state,
          assignee: issue.assignee?.login || "",
        }));

      setIssues(formattedIssues);
    } catch (error: any) {
      showNotification("error", error.message || "Error al cargar los issues");
    } finally {
      setLoading(false);
    }
  };

  const waitForIssue = async (
    project: { repoName: string; repoOwner: string },
    token: string,
    title: string,
    attempts = 0
  ): Promise<boolean> => {
    const maxAttempts = 10;

    if (attempts >= maxAttempts) {
      setSyncing(false);
      return false;
    }

    try {
      const desktop = DesktopManager.getInstance();

      const dataAssignedToSelf = await desktop.getIssuesVariable(
        {
          repoName: project.repoName,
          repoOwner: project.repoOwner,
          token,
        },
        {
          assignee: user.login,
          state: "open",
          labels: "bug",
        }
      );

      const dataNoAssignees = await desktop.getIssuesVariable(
        {
          repoName: project.repoName,
          repoOwner: project.repoOwner,
          token,
        },
        {
          assignee: "none",
          state: "open",
          labels: "bug",
        }
      );

      const dataClosed = await desktop.getIssuesVariable(
        {
          repoName: project.repoName,
          repoOwner: project.repoOwner,
          token,
        },
        {
          assignee: "*",
          state: "closed",
          labels: "bug",
        }
      );

      const data = [...dataAssignedToSelf, ...dataNoAssignees, ...dataClosed];

      const exists = data.some((issue: any) => issue.title === title);

      if (exists) {
        setSyncing(false);
        await loadIssues(project, token);
        return true;
      }

      return new Promise((resolve) => {
        setTimeout(() => {
          resolve(waitForIssue(project, token, title, attempts + 1));
        }, 500);
      });
    } catch (error) {
      console.error("Error en waitForIssue:", error);
      setSyncing(false);
      return false;
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

      showNotification("success", `Issue #${selectedIssue.id} marcado como resuelto`);

      await loadIssues(currentProject, token);
      setIsModalOpen(false);
      setSelectedIssue(null);
    } catch (error: any) {
      showNotification("error", error.message || "Error al marcar issue como resuelto");
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
          assignees: editedAssignee ? [editedAssignee] : null,
          labels: ["bug"],
        };

        response = await desktop.createIssue(issueData, {
          repoName: currentProject.repoName,
          repoOwner: currentProject.repoOwner,
          token,
        });

        if (response) {
          showNotification("success", "Issue creado exitosamente");
        }

        setIsModalOpen(false);
        setSelectedIssue(null);
        setEditedTitle("");
        setEditedDescription("");
        setSyncing(true);

        waitForIssue(currentProject, token, editedTitle).catch(console.error);
      } else {
        let issueData: IssueData = {
          title: editedTitle,
          description: editedDescription,
          id: selectedIssue.id,
          assignees: [editedAssignee],
          labels: null,
        };

        response = await desktop.editIssue(issueData, {
          repoName: currentProject.repoName,
          repoOwner: currentProject.repoOwner,
          token,
        });

        if (response) {
          showNotification("success", `Issue #${selectedIssue.id} actualizado`);
        }
      }

      setIsModalOpen(false);
      setSelectedIssue(null);
      setEditedTitle("");
      setEditedDescription("");
      setSyncing(true);

      waitForIssue(currentProject, token, editedTitle).catch(console.error);
    } catch (error: any) {
      showNotification("error", error.message || "Error al guardar el issue");
    }
  };

  const openNewIssueModal = () => {
    setSelectedIssue(null);
    setEditedTitle("");
    setEditedDescription("");
    setEditedAssignee("");
    setIsModalOpen(true);
  };

  const openEditIssueModal = (issue: any) => {
    setSelectedIssue(issue);
    setEditedTitle(issue.title);
    setEditedDescription(issue.description);
    setEditedAssignee(issue.assignee || "");
    setIsModalOpen(true);
  };

  const filteredIssues = issues.filter((issue) => {
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
        {notification && (
          <div className={`notification ${notification.type}`}>
            {notification.type === "success" && <CheckCircle size={18} />}
            {notification.type === "error" && <AlertCircle size={18} />}
            {notification.type === "warning" && <AlertCircle size={18} />}
            <span>{notification.message}</span>
          </div>
        )}

        {syncing && (
          <div className="syncing-overlay">
            <div className="syncing-content">
              <div className="spinner-large" />
              <p>Sincronizando issue con GitHub...</p>
            </div>
          </div>
        )}

        <div className="issues-header">
          <h2>
            <Flag size={24} />
            Issues del Proyecto
          </h2>
          <div className="header-actions">
            <button
              className="filter-btn"
              onClick={() =>
                setFilter(
                  filter === "all"
                    ? "open"
                    : filter === "open"
                      ? "closed"
                      : "all",
                )
              }
            >
              <Filter size={16} />
              {filter === "all"
                ? "Todos"
                : filter === "open"
                  ? "Abiertos"
                  : "Cerrados"}
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
          <div className="issues-grid">
            {filteredIssues.length > 0 ? (
              filteredIssues.map((issue) => (
                <div
                  key={issue.id}
                  className={`issue-card ${selectedIssue?.id === issue.id ? "selected" : ""}`}
                  onClick={() => openEditIssueModal(issue)}
                >
                  <h3 className="issue-title">
                    #{issue.id} - {issue.title}
                  </h3>

                  <p className="issue-description">
                    {issue.description || "Sin descripción"}
                  </p>

                  <div className="issue-footer">
                    <span className="issue-date">
                      <Calendar size={12} />
                      {issue.date}
                    </span>

                    <span className="issue-assignee">
                      <User size={12} />
                      {issue.assignee}
                    </span>

                    <span className={`issue-status ${issue.status}`}>
                      {issue.status === "open" ? (
                        <>
                          <AlertCircle size={12} /> Abierto
                        </>
                      ) : (
                        <>
                          <CheckCircle size={12} /> Cerrado
                        </>
                      )}
                    </span>
                  </div>
                </div>
              ))
            ) : (
              <div className="empty-issues">
                <Flag size={48} />
                <p>No hay issues disponibles</p>
                <button className="add-btn" onClick={openNewIssueModal}>
                  <Plus size={16} />
                  Crear primer issue
                </button>
              </div>
            )}
          </div>
        )}

        {isModalOpen && (
          <div className="modal-overlay" onClick={() => setIsModalOpen(false)}>
            <div className="modal" onClick={(e) => e.stopPropagation()}>
              <div className="modal-header">
                <h3>
                  <Flag size={20} />
                  {selectedIssue
                    ? `Editar Issue #${selectedIssue.id}`
                    : "Nuevo Issue"}
                </h3>
                <button
                  className="modal-close"
                  onClick={() => setIsModalOpen(false)}
                >
                  <X size={18} />
                </button>
              </div>

              <div className="modal-field">
                <label>Título</label>
                <input
                  type="text"
                  placeholder="Título del issue"
                  value={editedTitle}
                  onChange={(e) => setEditedTitle(e.target.value)}
                />
              </div>

              <div className="modal-field">
                <label>Descripción</label>
                <textarea
                  placeholder="Describe el issue detalladamente..."
                  value={editedDescription}
                  onChange={(e) => setEditedDescription(e.target.value)}
                  rows={8}
                />
              </div>

              {!selectedIssue && (
                <div className="modal-field">
                  <label>Asignado a:</label>
                  <select
                    value={editedAssignee}
                    onChange={(e) => setEditedAssignee(e.target.value)}
                  >
                    <option value="">Sin asignar</option>

                    {contributors.map((contributor) => (
                      <option key={contributor.login} value={contributor.login}>
                        {contributor.login}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              {selectedIssue && (
                <div className="modal-row">
                  <div className="modal-field">
                    <label>Estado actual</label>
                    <div className={`status-badge ${selectedIssue.status}`}>
                      {selectedIssue.status === "open" ? (
                        <>
                          <AlertCircle size={12} /> Abierto
                        </>
                      ) : (
                        <>
                          <CheckCircle size={12} /> Cerrado
                        </>
                      )}
                    </div>
                  </div>

                  <div className="modal-field">
                    <label>Asignado a:</label>
                    <select
                      value={editedAssignee}
                      onChange={(e) => setEditedAssignee(e.target.value)}
                    >
                      <option value="">Sin asignar</option>

                      {contributors.map((contributor) => (
                        <option key={contributor.login} value={contributor.login}>
                          {contributor.login}
                        </option>
                      ))}
                    </select>
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
                  <button className="resolve-btn" onClick={markAsResolved}>
                    Marcar como Resuelto
                  </button>
                )}

                <button
                  className="cancel-btn"
                  onClick={() => setIsModalOpen(false)}
                >
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
