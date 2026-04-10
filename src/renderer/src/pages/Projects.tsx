// src/renderer/src/pages/Projects.tsx
import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import DesktopManager from "../utils/desktop";
import { Folder, Plus, X, Trash, AlertCircle, CheckCircle, ArrowLeft } from "lucide-react";
import "../styles/projects.css";

export default function Projects() {
    const navigate = useNavigate();

    const [projects, setProjects] = useState<any[]>([]);
    const [selectedProject, setSelectedProject] = useState<any | null>(null);
    const [isModalOpen, setIsModalOpen] = useState(false);

    const [editedTitle, setEditedTitle] = useState("");
    const [editedDescription, setEditedDescription] = useState("");

    const [loading, setLoading] = useState(true);
    const [syncing, setSyncing] = useState(false);

    const [notification, setNotification] = useState<{
        type: "success" | "error" | "warning";
        message: string;
    } | null>(null);

    useEffect(() => {
        loadProjects();
    }, []);

    const showNotification = (
        type: "success" | "error" | "warning",
        message: string
    ) => {
        setNotification({ type, message });
        setTimeout(() => setNotification(null), 3000);
    };

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
                    }
                );

                showNotification("success", "Proyecto actualizado");
            } else {
                await desktop.createOrgRepo(
                    "Proyecto-Final-de-Grado",
                    "template",
                    token,
                    editedTitle,
                    editedDescription
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

    return (
        <div className="projects-container">
            <div className="projects-header-bar">
                <button
                    type="button"
                    className="projects-back-btn"
                    onClick={handleBack}
                >
                    <ArrowLeft size={18} />
                    <span>Volver</span>
                </button>
            </div>

            <div className="projects-content">
                {notification && (
                    <div className={`projects-notification ${notification.type}`}>
                        {notification.type === "success" && <CheckCircle size={18} />}
                        {notification.type === "error" && <AlertCircle size={18} />}
                        <span>{notification.message}</span>
                    </div>
                )}

                {syncing && (
                    <div className="projects-syncing-overlay">
                        <div className="projects-syncing-content">
                            <div className="spinner-large" />
                            <p>Guardando cambios...</p>
                        </div>
                    </div>
                )}

                <div className="projects-header">
                    <h2>
                        <Folder size={24} />
                        Proyectos
                    </h2>

                    <div className="projects-header-actions">
                        <button className="projects-add-btn" onClick={openNewModal}>
                            <Plus size={16} />
                            Nuevo Proyecto
                        </button>
                    </div>
                </div>

                {loading ? (
                    <div className="projects-loading-state">
                        <div className="spinner-large" />
                        <p>Cargando proyectos...</p>
                    </div>
                ) : (
                    <div className="projects-grid">
                        {projects.length > 0 ? (
                            projects.map((project) => (
                                <div
                                    key={project.id}
                                    className="projects-card"
                                    onClick={() => openEditModal(project)}
                                >
                                    <h3 className="projects-title">{project.name}</h3>
                                    <p className="projects-description">
                                        {project.description || "Sin descripción"}
                                    </p>
                                </div>
                            ))
                        ) : (
                            <div className="projects-empty">
                                <Folder size={48} />
                                <p>No hay proyectos</p>
                                <button className="projects-add-btn" onClick={openNewModal}>
                                    <Plus size={16} />
                                    Crear proyecto
                                </button>
                            </div>
                        )}
                    </div>
                )}

                {isModalOpen && (
                    <div
                        className="projects-modal-overlay"
                        onClick={() => setIsModalOpen(false)}
                    >
                        <div
                            className="projects-modal"
                            onClick={(e) => e.stopPropagation()}
                        >
                            <div className="projects-modal-header">
                                <h3>
                                    <Folder size={20} />
                                    {selectedProject
                                        ? "Editar Proyecto"
                                        : "Nuevo Proyecto"}
                                </h3>

                                <button
                                    className="projects-modal-close"
                                    onClick={() => setIsModalOpen(false)}
                                >
                                    <X size={18} />
                                </button>
                            </div>

                            <div className="projects-modal-field">
                                <label>Título</label>
                                <input
                                    value={editedTitle}
                                    onChange={(e) => setEditedTitle(e.target.value)}
                                />
                            </div>

                            <div className="projects-modal-field">
                                <label>Descripción</label>
                                <textarea
                                    value={editedDescription}
                                    onChange={(e) =>
                                        setEditedDescription(e.target.value)
                                    }
                                />
                            </div>

                            <div className="projects-modal-actions">
                                <button
                                    className="projects-save-btn"
                                    onClick={saveProject}
                                    disabled={!editedTitle.trim()}
                                >
                                    Guardar
                                </button>

                                {selectedProject && (
                                    <>
                                        <button
                                            className="projects-delete-btn"
                                            onClick={deleteProject}
                                        >
                                            <Trash size={16} />
                                            Borrar
                                        </button>

                                        <button
                                            className="projects-cancel-btn"
                                            onClick={() => setIsModalOpen(false)}
                                        >
                                            Cancelar
                                        </button>
                                    </>
                                )}
                            </div>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}