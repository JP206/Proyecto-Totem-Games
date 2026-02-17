// src/renderer/src/pages/Notes.tsx
import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import DesktopManager from "../utils/desktop";
import Navbar from "../components/Navbar";
import { IssueData } from "../utils/electron";
import { 
  FileText, 
  Plus, 
  Calendar, 
  X,
  Trash2,
  AlertCircle 
} from "lucide-react";
import "../styles/notes.css";

export default function Notes() {
  const navigate = useNavigate();
  const [notes, setNotes] = useState<any[]>([]);
  const [selectedNote, setSelectedNote] = useState<any | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editedTitle, setEditedTitle] = useState("");
  const [editedDescription, setEditedDescription] = useState("");
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [loading, setLoading] = useState(true);
  const [currentProject, setCurrentProject] = useState<{ 
    repoPath: string; 
    repoName: string;
    repoOwner: string;
  } | null>(null);

  useEffect(() => {
    loadProjectAndNotes();
  }, []);

  const loadProjectAndNotes = async () => {
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
      await loadNotes(project, token);
      
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

  const loadNotes = async (project: { repoName: string; repoOwner: string }, token: string) => {
    try {
      setLoading(true);
      const desktop = DesktopManager.getInstance();

      const data = await desktop.getIssues(
        {
          repoName: project.repoName,
          repoOwner: project.repoOwner,
          token,
        },
        "documentation"
      );

      const formattedNotes = data
        .filter((issue: any) => !issue.pull_request)
        .map((issue: any) => ({
          id: issue.number,
          title: issue.title,
          description: issue.body,
          date: new Date(issue.created_at).toLocaleDateString(),
          status: issue.state,
        }));

      setNotes(formattedNotes);
    } catch (error: any) {
      const desktop = DesktopManager.getInstance();
      await desktop.showMessage(
        error.message || "Error al cargar las notas",
        "Error",
        "error"
      );
    } finally {
      setLoading(false);
    }
  };

  const editNote = async () => {
    try {
      const desktop = DesktopManager.getInstance();
      const token = await desktop.getConfig("github_token");
      if (!token || !currentProject) return;

      let response;

      if (!selectedNote) {
        let issueData: IssueData = {
          title: editedTitle,
          description: editedDescription,
          id: null,
          assignees: null,
          labels: ["documentation"]
        };

        response = await desktop.createIssue(issueData, {
          repoName: currentProject.repoName,
          repoOwner: currentProject.repoOwner,
          token
        });

        if (response) {
          await desktop.showMessage(
            "Nota creada exitosamente",
            "Éxito",
            "info"
          );
        }
      } else {
        let issueData: IssueData = {
          title: editedTitle,
          description: editedDescription,
          id: selectedNote.id,
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
            `Nota #${selectedNote.id} actualizada`,
            "Éxito",
            "info"
          );
        }
      }

      if (response) {
        await loadNotes(currentProject, token);
        setIsModalOpen(false);
        setSelectedNote(null);
        setEditedTitle("");
        setEditedDescription("");
      }
    } catch (error: any) {
      const desktop = DesktopManager.getInstance();
      await desktop.showMessage(
        error.message || "Error al guardar la nota",
        "Error",
        "error"
      );
    }
  };

  const deleteNote = async () => {
    try {
      const desktop = DesktopManager.getInstance();
      const token = await desktop.getConfig("github_token");
      if (!token || !currentProject) return;

      await desktop.markIssueAsResolved(selectedNote.id, {
        repoName: currentProject.repoName,
        repoOwner: currentProject.repoOwner,
        token,
      });

      await desktop.showMessage(
        `Nota #${selectedNote.id} archivada`,
        "Éxito",
        "info"
      );

      await loadNotes(currentProject, token);
      setShowDeleteConfirm(false);
      setIsModalOpen(false);
      setSelectedNote(null);
    } catch (error: any) {
      const desktop = DesktopManager.getInstance();
      await desktop.showMessage(
        error.message || "Error al archivar la nota",
        "Error",
        "error"
      );
    }
  };

  const openNewNoteModal = () => {
    setSelectedNote(null);
    setEditedTitle("");
    setEditedDescription("");
    setIsModalOpen(true);
  };

  const openEditNoteModal = (note: any) => {
    setSelectedNote(note);
    setEditedTitle(note.title);
    setEditedDescription(note.description);
    setIsModalOpen(true);
  };

  if (loading && !currentProject) {
    return (
      <>
        <Navbar />
        <div className="notes-page">
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
      <div className="notes-page">
        <div className="notes-header">
          <h2>
            <FileText size={24} />
            Notas del Proyecto
          </h2>
          <button 
            className="add-note-btn" 
            onClick={openNewNoteModal}
            disabled={loading}
          >
            <Plus size={16} />
            Nueva Nota
          </button>
        </div>

        {loading ? (
          <div className="loading-state">
            <div className="spinner-large" />
            <p>Cargando notas...</p>
          </div>
        ) : (
          <div className="notes-grid">
            {notes.length > 0 ? (
              notes.map(note => (
                <div
                  key={note.id}
                  className={`note-card ${selectedNote?.id === note.id ? 'selected' : ''}`}
                  onClick={() => openEditNoteModal(note)}
                >
                  <h3 className="note-title">{note.title}</h3>
                  <p className="note-description">
                    {note.description || "Sin descripción"}
                  </p>
                  <div className="note-footer">
                    <span className="note-date">
                      <Calendar size={12} />
                      {note.date}
                    </span>
                    {note.status === 'closed' && (
                      <span className="note-status-badge">Archivada</span>
                    )}
                  </div>
                </div>
              ))
            ) : (
              <div className="empty-notes">
                <FileText size={48} />
                <p>No hay notas para este proyecto</p>
                <button className="add-note-btn" onClick={openNewNoteModal}>
                  <Plus size={16} />
                  Crear primera nota
                </button>
              </div>
            )}
          </div>
        )}

        {isModalOpen && (
          <div className="modal-overlay" onClick={() => setIsModalOpen(false)}>
            <div className="modal" onClick={e => e.stopPropagation()}>
              <div className="modal-header">
                <h3>
                  <FileText size={20} />
                  {selectedNote ? "Editar Nota" : "Nueva Nota"}
                </h3>
                <button className="modal-close" onClick={() => setIsModalOpen(false)}>
                  <X size={18} />
                </button>
              </div>

              <div className="modal-field">
                <label>Título</label>
                <input
                  type="text"
                  placeholder="Título de la nota"
                  value={editedTitle}
                  onChange={e => setEditedTitle(e.target.value)}
                />
              </div>

              <div className="modal-field">
                <label>Contenido</label>
                <textarea
                  placeholder="Escribe el contenido de tu nota aquí..."
                  value={editedDescription}
                  onChange={e => setEditedDescription(e.target.value)}
                  rows={10}
                />
              </div>

              <div className="modal-actions">
                <button
                  className="save-btn"
                  onClick={editNote}
                  disabled={!editedTitle.trim()}
                >
                  Guardar Nota
                </button>

                {selectedNote && selectedNote.status !== "closed" && (
                  <button
                    className="delete-btn"
                    onClick={() => setShowDeleteConfirm(true)}
                  >
                    <Trash2 size={16} />
                    Archivar
                  </button>
                )}

                <button className="cancel-btn" onClick={() => setIsModalOpen(false)}>
                  Cancelar
                </button>
              </div>

              {showDeleteConfirm && (
                <div className="confirm-overlay">
                  <div className="confirm-box">
                    <AlertCircle size={32} color="var(--color-error)" />
                    <p>¿Archivar esta nota?</p>
                    <p className="confirm-note">Las notas archivadas se pueden recuperar desde GitHub</p>
                    <div className="confirm-actions">
                      <button
                        className="confirm-delete"
                        onClick={deleteNote}
                      >
                        Archivar
                      </button>
                      <button
                        className="confirm-cancel"
                        onClick={() => setShowDeleteConfirm(false)}
                      >
                        Cancelar
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </>
  );
}