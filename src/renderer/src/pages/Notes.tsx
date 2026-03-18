// src/renderer/src/pages/Notes.tsx
import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import DesktopManager from "../utils/desktop";
import Navbar from "../components/Navbar";
import { IssueData } from "../utils/electron";
import { FileText, Plus, Calendar, X, Trash2, AlertCircle, User, Search } from "lucide-react";
import "../styles/notes.css";

export default function Notes() {
  const navigate = useNavigate();
  const [notes, setNotes] = useState<any[]>([]);
  const [filteredNotes, setFilteredNotes] = useState<any[]>([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedNote, setSelectedNote] = useState<any | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editedTitle, setEditedTitle] = useState("");
  const [editedDescription, setEditedDescription] = useState("");
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [currentUser, setCurrentUser] = useState<string>("");
  const [currentProject, setCurrentProject] = useState<{
    repoPath: string;
    repoName: string;
    repoOwner: string;
  } | null>(null);

  const MAX_TITLE_LENGTH = 50;

  useEffect(() => {
    loadProjectAndNotes();
  }, []);

  // Efecto para filtrar notas cuando cambia el término de búsqueda o las notas
  useEffect(() => {
    if (searchTerm.trim() === "") {
      setFilteredNotes(notes);
    } else {
      const term = searchTerm.toLowerCase();
      const filtered = notes.filter(note => 
        note.title.toLowerCase().includes(term) || 
        note.author.toLowerCase().includes(term)
      );
      setFilteredNotes(filtered);
    }
  }, [searchTerm, notes]);

  const loadProjectAndNotes = async () => {
    try {
      setLoading(true);
      const desktop = DesktopManager.getInstance();

      const token = await desktop.getConfig("github_token");
      if (!token) {
        setTimeout(() => navigate("/login"), 2000);
        return;
      }

      const user = await desktop.getConfig("github_user");
      setCurrentUser(user?.login || "Desconocido");

      const project = await desktop.getConfig("current_project");
      if (!project?.repoName || !project?.repoOwner) {
        setTimeout(() => navigate("/dashboard"), 2000);
        return;
      }

      setCurrentProject(project);
      await loadNotes(project, token, false);
    } catch (error: any) {
      setTimeout(() => navigate("/dashboard"), 2000);
    } finally {
      setLoading(false);
    }
  };

  const loadNotes = async (
    project: { repoName: string; repoOwner: string },
    token: string,
    showSyncing: boolean = true
  ) => {
    try {
      if (showSyncing) setSyncing(true);
      
      const desktop = DesktopManager.getInstance();

      const data = await desktop.getIssues(
        {
          repoName: project.repoName,
          repoOwner: project.repoOwner,
          token,
        },
        "documentation",
      );

      const formattedNotes = data
        .filter((issue: any) => !issue.pull_request && issue.state === "open")
        .map((issue: any) => ({
          id: issue.number,
          title: issue.title,
          description: issue.body,
          date: new Date(issue.created_at).toLocaleDateString(),
          author: issue.user?.login || "Desconocido",
        }));

      setNotes(formattedNotes);
      setFilteredNotes(formattedNotes);
      return formattedNotes;
    } catch (error: any) {
      console.error("Error cargando notas:", error);
      return [];
    } finally {
      if (showSyncing) setSyncing(false);
    }
  };

  const waitForNote = async (
    project: { repoName: string; repoOwner: string },
    token: string,
    title: string,
    author: string,
    attempts = 0
  ): Promise<boolean> => {
    const maxAttempts = 10;

    if (attempts >= maxAttempts) {
      setSyncing(false);
      return false;
    }

    try {
      const freshNotes = await loadNotes(project, token, false);
      const noteExists = freshNotes.some(
        (n) => n.title === title && n.author === author
      );

      if (noteExists) {
        setSyncing(false);
        return true;
      }

      return new Promise((resolve) => {
        setTimeout(() => {
          resolve(waitForNote(project, token, title, author, attempts + 1));
        }, 500);
      });
    } catch (error) {
      console.error("Error en waitForNote:", error);
      setSyncing(false);
      return false;
    }
  };

  const editNote = async () => {
    try {
      const desktop = DesktopManager.getInstance();
      const token = await desktop.getConfig("github_token");
      if (!token || !currentProject) return;

      if (!selectedNote) {
        const issueData: IssueData = {
          title: editedTitle,
          description: editedDescription,
          id: null,
          assignees: null,
          labels: ["documentation"],
        };

        await desktop.createIssue(issueData, {
          repoName: currentProject.repoName,
          repoOwner: currentProject.repoOwner,
          token,
        });

        setIsModalOpen(false);
        setSelectedNote(null);
        setEditedTitle("");
        setEditedDescription("");
        setSyncing(true);

        waitForNote(currentProject, token, editedTitle, currentUser || "Tú").catch(console.error);
        
      } else {
        const issueData: IssueData = {
          title: editedTitle,
          description: editedDescription,
          id: selectedNote.id,
          assignees: null,
          labels: null,
        };

        await desktop.editIssue(issueData, {
          repoName: currentProject.repoName,
          repoOwner: currentProject.repoOwner,
          token,
        });

        setNotes(prev => prev.map(note => 
          note.id === selectedNote.id 
            ? { ...note, title: editedTitle, description: editedDescription }
            : note
        ));
        
        setIsModalOpen(false);
        setSelectedNote(null);
        setEditedTitle("");
        setEditedDescription("");
      }
    } catch (error: any) {
      console.error("Error al guardar la nota:", error);
      setSyncing(false);
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

      setNotes(prev => prev.filter(note => note.id !== selectedNote.id));
      setShowDeleteConfirm(false);
      setIsModalOpen(false);
      setSelectedNote(null);
      
    } catch (error: any) {
      console.error("Error al archivar la nota:", error);
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

  const handleTitleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newTitle = e.target.value;
    if (newTitle.length <= MAX_TITLE_LENGTH) {
      setEditedTitle(newTitle);
    }
  };

  if (loading) {
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
        {syncing && (
          <div className="syncing-overlay">
            <div className="syncing-content">
              <div className="spinner-large" />
              <p>Sincronizando nota con GitHub...</p>
            </div>
          </div>
        )}

        <div className="notes-header">
          <div className="notes-header-left">
            <h2>
              <FileText size={24} />
              Notas del Proyecto
            </h2>
          </div>
          
          <div className="notes-header-right">
            <div className="search-container">
              <Search size={16} className="search-icon" />
              <input
                type="text"
                placeholder="Buscar por título o autor..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="search-input"
              />
              {searchTerm && (
                <button 
                  className="search-clear"
                  onClick={() => setSearchTerm("")}
                >
                  ×
                </button>
              )}
            </div>
            
            <button
              className="add-note-btn"
              onClick={openNewNoteModal}
              disabled={syncing}
            >
              <Plus size={16} />
              Nueva Nota
            </button>
          </div>
        </div>

        {searchTerm && (
          <div className="search-results-info">
            {filteredNotes.length === 0 ? (
              <p>No se encontraron notas para "<strong>{searchTerm}</strong>"</p>
            ) : (
              <p>Se encontraron {filteredNotes.length} nota(s) para "<strong>{searchTerm}</strong>"</p>
            )}
          </div>
        )}

        <div className="notes-grid">
          {filteredNotes.length > 0 ? (
            filteredNotes.map((note) => (
              <div
                key={note.id}
                className={`note-card ${selectedNote?.id === note.id ? "selected" : ""}`}
                onClick={() => openEditNoteModal(note)}
              >
                <h3 className="note-title">{note.title}</h3>
                <p className="note-description">
                  {note.description || "Sin descripción"}
                </p>
                <div className="note-footer">
                  <span className="note-author">
                    <User size={12} />
                    {note.author}
                  </span>
                  <span className="note-date">
                    <Calendar size={12} />
                    {note.date}
                  </span>
                </div>
              </div>
            ))
          ) : (
            <div className="empty-notes">
              <FileText size={48} />
              {searchTerm ? (
                <>
                  <p>No hay notas que coincidan con "<strong>{searchTerm}</strong>"</p>
                  <button 
                    className="add-note-btn" 
                    onClick={() => setSearchTerm("")}
                  >
                    Limpiar búsqueda
                  </button>
                </>
              ) : (
                <>
                  <p>No hay notas para este proyecto</p>
                  <button className="add-note-btn" onClick={openNewNoteModal} disabled={syncing}>
                    <Plus size={16} />
                    Crear primera nota
                  </button>
                </>
              )}
            </div>
          )}
        </div>

        {isModalOpen && (
          <div className="modal-overlay" onClick={() => setIsModalOpen(false)}>
            <div className="modal" onClick={(e) => e.stopPropagation()}>
              <div className="modal-header">
                <h3>
                  <FileText size={20} />
                  {selectedNote ? "Editar Nota" : "Nueva Nota"}
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
                  placeholder="Título de la nota"
                  value={editedTitle}
                  onChange={handleTitleChange}
                  maxLength={MAX_TITLE_LENGTH}
                />
                <div className="character-counter">
                  {editedTitle.length}/{MAX_TITLE_LENGTH}
                </div>
              </div>

              <div className="modal-field">
                <label>Contenido</label>
                <textarea
                  placeholder="Escribe el contenido de tu nota aquí..."
                  value={editedDescription}
                  onChange={(e) => setEditedDescription(e.target.value)}
                  rows={10}
                />
              </div>

              <div className="modal-actions">
                <button
                  className="save-btn"
                  onClick={editNote}
                  disabled={!editedTitle.trim() || syncing}
                >
                  Guardar Nota
                </button>

                {selectedNote && (
                  <button
                    className="delete-btn"
                    onClick={() => setShowDeleteConfirm(true)}
                    disabled={syncing}
                  >
                    <Trash2 size={16} />
                    Archivar
                  </button>
                )}

                <button
                  className="cancel-btn"
                  onClick={() => setIsModalOpen(false)}
                  disabled={syncing}
                >
                  Cancelar
                </button>
              </div>

              {showDeleteConfirm && (
                <div className="confirm-overlay">
                  <div className="confirm-box">
                    <AlertCircle size={32} color="var(--color-error)" />
                    <p>¿Archivar esta nota?</p>
                    <p className="confirm-note">
                      La nota se archivará y dejará de mostrarse
                    </p>
                    <div className="confirm-actions">
                      <button className="confirm-delete" onClick={deleteNote} disabled={syncing}>
                        Archivar
                      </button>
                      <button
                        className="confirm-cancel"
                        onClick={() => setShowDeleteConfirm(false)}
                        disabled={syncing}
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