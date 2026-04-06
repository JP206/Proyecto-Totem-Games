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
  const [userFilter, setUserFilter] = useState<string>("all");
  const [typeFilter, setTypeFilter] = useState<"all" | "bug" | "enhancement">("all");
  const [statusFilter, setStatusFilter] = useState<"all" | "open" | "closed">("all");
  const [syncing, setSyncing] = useState(false);
  const [currentUser, setCurrentUser] = useState<string>("");
  const [editedAssignee, setEditedAssignee] = useState("");
  const [collaborators, setCollaborators] = useState<any[]>([]);
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

      const collaborators = await desktop.getCollaborators({
        repoName: project.repoName,
        repoOwner: project.repoOwner,
        token,
      });
      setCollaborators(collaborators);

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

      const dataIssues = await desktop.getIssuesVariable(
        {
          repoName: project.repoName,
          repoOwner: project.repoOwner,
          token,
        },
        {
          state: "all",
          labels: "bug",
        }
      );

      const dataReports = await desktop.getIssuesVariable(
        {
          repoName: project.repoName,
          repoOwner: project.repoOwner,
          token,
        },
        {
          state: "all",
          labels: "enhancement",
        }
      );

      const data = [...dataIssues, ...dataReports];

      const formattedIssues = data
        .filter((issue: any) => !issue.pull_request)
        .map((issue: any) => ({
          id: issue.number,
          title: issue.title,
          description: issue.body,
          date: new Date(issue.created_at).toLocaleDateString(),
          status: issue.state,
          assignee: issue.assignee?.login || "",
          type: issue.labels?.[0]?.name || "bug",
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

      const dataIssues = await desktop.getIssuesVariable(
        {
          repoName: project.repoName,
          repoOwner: project.repoOwner,
          token,
        },
        {
          state: "all",
          labels: "bug",
        }
      );

      const dataReports = await desktop.getIssuesVariable(
        {
          repoName: project.repoName,
          repoOwner: project.repoOwner,
          token,
        },
        {
          state: "all",
          labels: "enhancement",
        }
      );

      const data = [...dataIssues, ...dataReports];

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
    const matchesUser =
      userFilter === "all" ||
      (userFilter === "unassigned" && !issue.assignee) ||
      issue.assignee === userFilter;

    const matchesType =
      typeFilter === "all" || issue.type === typeFilter;

    const matchesStatus =
      statusFilter === "all" || issue.status === statusFilter;

    return matchesUser && matchesType && matchesStatus;
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
            <div className="filters-container">
              {/* Usuario */}
              <select
                className="filter-select"
                value={userFilter}
                onChange={(e) => setUserFilter(e.target.value)}
              >
                <option value="all">Todos los usuarios</option>
                <option value="unassigned">Sin asignar</option>

                {collaborators.map((c) => (
                  <option key={c.login} value={c.login}>
                    {c.login}
                  </option>
                ))}
              </select>

              {/* Tipo */}
              <select
                className="filter-select"
                value={typeFilter}
                onChange={(e) => setTypeFilter(e.target.value as any)}
              >
                <option value="all">Todos los tipos</option>
                <option value="bug">Issue</option>
                <option value="enhancement">Reporte</option>
              </select>

              {/* Estado */}
              <select
                className="filter-select"
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value as any)}
              >
                <option value="all">Todos los estados</option>
                <option value="open">Abiertos</option>
                <option value="closed">Cerrados</option>
              </select>
            </div>
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
                  className={`issue-card ${selectedIssue?.id === issue.id ? "selected" : ""
                    }`}
                  onClick={() => openEditIssueModal(issue)}
                >
                  <div className="issue-card-header">
                    <span className={`issue-type-badge ${issue.type}`}>
                      {issue.type === "enhancement" ? "📊 Reporte" : "🐞 Issue"}
                    </span>
                  </div>

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
      </div>
    </>
  );
}