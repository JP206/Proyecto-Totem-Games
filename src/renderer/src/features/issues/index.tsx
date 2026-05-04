import { useEffect, useState } from "react";
import DesktopManager from "../../utils/desktop";
import Button from "../../components/Button/Button";
import EmptyState from "../../components/EmptyState/EmptyState";
import EntityCard from "../../components/EntityCard/EntityCard";
import FilterBar from "../../components/FilterBar/FilterBar";
import FilterSelect from "../../components/FilterSelect/FilterSelect";
import PageWithNavbar from "../../components/PageWithNavbar/PageWithNavbar";
import Toast from "../../components/Toast/Toast";
import SyncingOverlay from "../../components/SyncingOverlay/SyncingOverlay";
import LoadingState from "../../components/LoadingState/LoadingState";
import Modal from "../../components/Modal/Modal";
import PageHeader from "../../components/PageHeader/PageHeader";
import { useNotification } from "../../hooks/useNotification";
import { useSessionGuards } from "../../hooks/useSessionGuards";
import { pollUntil } from "../../utils/poll";
import { IssueData } from "../../utils/electron";
import {
  Flag,
  Plus,
  Calendar,
  CheckCircle,
  AlertCircle,
  User,
} from "lucide-react";
import "./issues.css";

export default function Issues() {
  const { navigate, ensureGithubToken, ensureCurrentProject } =
    useSessionGuards();
  const { notification, showNotification } = useNotification();
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
  const [editedAssignee, setEditedAssignee] = useState("");
  const [collaborators, setCollaborators] = useState<any[]>([]);
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

      if (!(await ensureGithubToken(showNotification))) {
        setLoading(false);
        return;
      }

      const token = await desktop.getConfig("github_token");
      const project = await ensureCurrentProject(showNotification);
      if (!project) {
        setLoading(false);
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
      setLoading(false);
    }
  };

  const loadIssues = async (
    project: { repoName: string; repoOwner: string },
    token: string,
  ) => {
    try {
      setLoading(true);
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
    title: string
  ): Promise<boolean> => {
    try {
      const desktop = DesktopManager.getInstance();
      const { success } = await pollUntil({
        attempts: 10,
        delayMs: 500,
        task: async () => {
          const dataIssues = await desktop.getIssuesVariable(
            {
              repoName: project.repoName,
              repoOwner: project.repoOwner,
              token,
            },
            {
              state: "all",
              labels: "bug",
            },
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
            },
          );
          return [...dataIssues, ...dataReports];
        },
        until: async (data) => data.some((issue: any) => issue.title === title),
      });

      if (success) {
        setSyncing(false);
        await loadIssues(project, token);
        return true;
      }
      setSyncing(false);
      return false;
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
      <PageWithNavbar>
        <div className="issues-container">
          <LoadingState message="Cargando proyecto..." fullPage />
        </div>
      </PageWithNavbar>
    );
  }
  return (
    <PageWithNavbar>
      <Toast notification={notification} />

      <div className="issues-container">
        <SyncingOverlay
          visible={syncing}
          message="Sincronizando issue con GitHub..."
        />

        <Modal
          open={isModalOpen}
          onClose={() => setIsModalOpen(false)}
          title={
            <>
              <Flag size={18} />
              {selectedIssue ? "Editar Issue" : "Nuevo Issue"}
            </>
          }
          contentClassName="issues-modal-shell"
          footer={
            <>
              <Button variant="secondary" onClick={() => setIsModalOpen(false)}>
                Cancelar
              </Button>
              <Button variant="success" onClick={editIssue} disabled={!editedTitle}>
                Guardar
              </Button>
              {selectedIssue && selectedIssue.status === "open" && (
                <Button variant="primary" onClick={markAsResolved}>
                  Marcar como resuelto
                </Button>
              )}
            </>
          }
        >
          <div className="modal-field">
            <label htmlFor="issue-title">Título</label>
            <input
              id="issue-title"
              type="text"
              value={editedTitle}
              onChange={(e) => setEditedTitle(e.target.value)}
              placeholder="Título del issue"
            />
          </div>

          <div className="modal-field">
            <label htmlFor="issue-desc">Descripción</label>
            <textarea
              id="issue-desc"
              value={editedDescription}
              onChange={(e) => setEditedDescription(e.target.value)}
              placeholder="Descripción del issue"
            />
          </div>

          <div className="modal-field">
            <label htmlFor="issue-assignee">Asignar a</label>
            <select
              id="issue-assignee"
              value={editedAssignee}
              onChange={(e) => setEditedAssignee(e.target.value)}
            >
              <option value="">Sin asignar</option>
              {collaborators.map((c) => (
                <option key={c.login} value={c.login}>
                  {c.login}
                </option>
              ))}
            </select>
          </div>
        </Modal>

        <PageHeader
          title="Issues del Proyecto"
          icon={<Flag size={24} />}
          actions={
            <div className="issues-header-content">
              <FilterBar className="issues-filter-bar">
                <FilterSelect
                  label="Usuario"
                  value={userFilter}
                  onChange={setUserFilter}
                  options={[
                    { value: "all", label: "Todos los usuarios" },
                    { value: "unassigned", label: "Sin asignar" },
                    ...collaborators.map((c) => ({
                      value: c.login,
                      label: c.login,
                    })),
                  ]}
                />
                <FilterSelect
                  label="Tipo"
                  value={typeFilter}
                  onChange={(value) =>
                    setTypeFilter(value as "all" | "bug" | "enhancement")
                  }
                  options={[
                    { value: "all", label: "Todos los tipos" },
                    { value: "bug", label: "Issue" },
                    { value: "enhancement", label: "Reporte" },
                  ]}
                />
                <FilterSelect
                  label="Estado"
                  value={statusFilter}
                  onChange={(value) =>
                    setStatusFilter(value as "all" | "open" | "closed")
                  }
                  options={[
                    { value: "all", label: "Todos los estados" },
                    { value: "open", label: "Abiertos" },
                    { value: "closed", label: "Cerrados" },
                  ]}
                />
              </FilterBar>
              <Button
                variant="success"
                leftIcon={<Plus size={16} />}
                onClick={openNewIssueModal}
              >
                Nuevo Issue
              </Button>
            </div>
          }
        />

        {loading ? (
          <div className="issues-loading-wrap">
            <LoadingState message="Cargando issues..." />
          </div>
        ) : (
          <div className="issues-grid">
            {filteredIssues.length > 0 ? (
              filteredIssues.map((issue) => (
                <EntityCard
                  key={issue.id}
                  className={`issue-card ${selectedIssue?.id === issue.id ? "selected" : ""
                    }`}
                  onClick={() => openEditIssueModal(issue)}
                  selected={selectedIssue?.id === issue.id}
                  badge={
                    <span className={`issue-type-badge ${issue.type}`}>
                      {issue.type === "enhancement" ? "📊 Reporte" : "🐞 Issue"}
                    </span>
                  }
                  title={`#${issue.id} - ${issue.title}`}
                  description={issue.description || "Sin descripción"}
                  meta={
                    <>
                      <span className="issue-date">
                        <Calendar size={12} />
                        {issue.date}
                      </span>
                      <span className="issue-assignee">
                        <User size={12} />
                        {issue.assignee || "Sin asignar"}
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
                    </>
                  }
                />
              ))
            ) : (
              <EmptyState
                className="empty-issues"
                icon={<Flag size={48} />}
                title="No hay issues disponibles"
                action={
                  <Button
                    variant="success"
                    leftIcon={<Plus size={16} />}
                    onClick={openNewIssueModal}
                  >
                    Crear primer issue
                  </Button>
                }
              />
            )}
          </div>
        )}
      </div>
    </PageWithNavbar>
  );
}