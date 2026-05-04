import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import DesktopManager from "../../utils/desktop";
import { Folder, Plus, Trash, ArrowLeft } from "lucide-react";
import { useNotification } from "../../hooks/useNotification";
import Button from "../../components/Button/Button";
import EmptyState from "../../components/EmptyState/EmptyState";
import EntityCard from "../../components/EntityCard/EntityCard";
import PageHeader from "../../components/PageHeader/PageHeader";
import Toast from "../../components/Toast/Toast";
import SyncingOverlay from "../../components/SyncingOverlay/SyncingOverlay";
import LoadingState from "../../components/LoadingState/LoadingState";
import Modal from "../../components/Modal/Modal";
import "./projects.css";

export default function Projects() {
  const navigate = useNavigate();

  const [projects, setProjects] = useState<any[]>([]);
  const [selectedProject, setSelectedProject] = useState<any | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);

  const [editedTitle, setEditedTitle] = useState("");
  const [editedDescription, setEditedDescription] = useState("");

  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);

  const { notification, showNotification } = useNotification();

  useEffect(() => {
    loadProjects();
  }, []);

  const loadProjects = async () => {
    try {
      setLoading(true);

      const desktop = DesktopManager.getInstance();
      const token = await desktop.getConfig("github_token");

      const data = await desktop.getOrgRepos("Proyecto-Final-de-Grado", token);

      setProjects(data);
    } catch (error: any) {
      showNotification("error", error.message || "Error al cargar proyectos");
    } finally {
      setLoading(false);
    }
  };

  const saveProject = async () => {
    try {
      const desktop = DesktopManager.getInstance();
      const token = await desktop.getConfig("github_token");

      setSyncing(true);

      if (selectedProject) {
        await desktop.editRepo(
          {
            repoOwner: selectedProject.owner.login,
            repoName: selectedProject.name,
            token,
          },
          {
            name: editedTitle,
            description: editedDescription,
          },
        );

        showNotification("success", "Proyecto actualizado");
      } else {
        await desktop.createOrgRepo(
          "Proyecto-Final-de-Grado",
          "template",
          token,
          editedTitle,
          editedDescription,
        );

        showNotification("success", "Proyecto creado");
      }

      await loadProjects();

      setIsModalOpen(false);
      setSelectedProject(null);
      setEditedTitle("");
      setEditedDescription("");
    } catch (error: any) {
      showNotification("error", error.message || "Error al guardar");
    } finally {
      setSyncing(false);
    }
  };

  const deleteProject = async () => {
    try {
      if (!selectedProject) return;

      const desktop = DesktopManager.getInstance();
      const token = await desktop.getConfig("github_token");

      setSyncing(true);

      await desktop.deleteRepo({
        repoOwner: selectedProject.owner.login,
        repoName: selectedProject.name,
        token,
      });

      showNotification("success", "Proyecto eliminado");

      await loadProjects();

      setIsModalOpen(false);
      setSelectedProject(null);
    } catch (error: any) {
      showNotification("error", error.message || "Error al borrar");
    } finally {
      setSyncing(false);
    }
  };

  const openNewModal = () => {
    setSelectedProject(null);
    setEditedTitle("");
    setEditedDescription("");
    setIsModalOpen(true);
  };

  const openEditModal = (project: any) => {
    setSelectedProject(project);
    setEditedTitle(project.name);
    setEditedDescription(project.description || "");
    setIsModalOpen(true);
  };

  const handleBack = () => {
    navigate("/dashboard");
  };

  const modalTitle = (
    <>
      <Folder size={20} />
      {selectedProject ? "Editar Proyecto" : "Nuevo Proyecto"}
    </>
  );

  const modalFooter = (
    <>
      <Button variant="success" onClick={saveProject} disabled={!editedTitle.trim()}>
        Guardar
      </Button>
      {selectedProject && (
        <>
          <Button variant="danger" leftIcon={<Trash size={16} />} onClick={deleteProject}>
            Borrar
          </Button>
          <Button variant="secondary" onClick={() => setIsModalOpen(false)}>
            Cancelar
          </Button>
        </>
      )}
    </>
  );

  return (
    <div className="projects-container">
      <Toast notification={notification} />

      <div className="projects-header-bar">
        <Button variant="secondary" leftIcon={<ArrowLeft size={18} />} onClick={handleBack}>
          Volver
        </Button>
      </div>

      <div className="projects-content">
        <SyncingOverlay visible={syncing} />

        <PageHeader
          title="Proyectos"
          icon={<Folder size={24} />}
          actions={
            <Button
              variant="success"
              leftIcon={<Plus size={16} />}
              onClick={openNewModal}
            >
              Nuevo Proyecto
            </Button>
          }
        />

        {loading ? (
          <div className="projects-loading-wrap">
            <LoadingState message="Cargando proyectos..." />
          </div>
        ) : (
          <div className="projects-grid">
            {projects.length > 0 ? (
              projects.map((project) => (
                <EntityCard
                  key={project.id}
                  className="projects-card"
                  onClick={() => openEditModal(project)}
                  title={project.name}
                  description={project.description || "Sin descripción"}
                />
              ))
            ) : (
              <EmptyState
                className="projects-empty"
                icon={<Folder size={48} />}
                title="No hay proyectos"
                action={
                  <Button
                    variant="success"
                    leftIcon={<Plus size={16} />}
                    onClick={openNewModal}
                  >
                    Crear proyecto
                  </Button>
                }
              />
            )}
          </div>
        )}

        <Modal
          open={isModalOpen}
          onClose={() => setIsModalOpen(false)}
          title={modalTitle}
          footer={modalFooter}
          contentClassName="projects-modal-shell"
        >
          <div className="projects-modal-field">
            <label htmlFor="project-title-input">Título</label>
            <input
              id="project-title-input"
              value={editedTitle}
              onChange={(e) => setEditedTitle(e.target.value)}
            />
          </div>

          <div className="projects-modal-field">
            <label htmlFor="project-desc-input">Descripción</label>
            <textarea
              id="project-desc-input"
              value={editedDescription}
              onChange={(e) => setEditedDescription(e.target.value)}
            />
          </div>
        </Modal>
      </div>
    </div>
  );
}
