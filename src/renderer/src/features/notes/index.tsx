// src/renderer/src/pages/Notes.tsx
import { useEffect, useState } from "react";
import DesktopManager from "../../utils/desktop";
import Button from "../../components/Button/Button";
import ConfirmDialog from "../../components/ConfirmDialog/ConfirmDialog";
import EmptyState from "../../components/EmptyState/EmptyState";
import EntityCard from "../../components/EntityCard/EntityCard";
import PageWithNavbar from "../../components/PageWithNavbar/PageWithNavbar";
import LoadingState from "../../components/LoadingState/LoadingState";
import Modal from "../../components/Modal/Modal";
import PageHeader from "../../components/PageHeader/PageHeader";
import SearchField from "../../components/SearchField/SearchField";
import SyncingOverlay from "../../components/SyncingOverlay/SyncingOverlay";
import Toast from "../../components/Toast/Toast";
import { useNotification } from "../../hooks/useNotification";
import { useSessionGuards } from "../../hooks/useSessionGuards";
import { IssueData } from "../../utils/electron";
import { pollUntil } from "../../utils/poll";
import { FileText, Plus, Calendar, Trash2, User } from "lucide-react";
import "./notes.css";

export default function Notes() {
  const { ensureGithubToken, ensureCurrentProject } = useSessionGuards();
  const { notification, showNotification } = useNotification();
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

      if (!(await ensureGithubToken(showNotification))) {
        return;
      }
      const token = await desktop.getConfig("github_token");

      const user = await desktop.getConfig("github_user");
      setCurrentUser(user?.login || "Desconocido");

      const project = await ensureCurrentProject(showNotification);
      if (!project) {
        return;
      }

      setCurrentProject(project);
      await loadNotes(project, token, false);
    } catch (error: any) {
      showNotification("error", error.message || "Error al cargar las notas");
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
      showNotification("error", error.message || "Error cargando notas");
      return [];
    } finally {
      if (showSyncing) setSyncing(false);
    }
  };

  const waitForNote = async (
    project: { repoName: string; repoOwner: string },
    token: string,
    title: string,
    author: string
  ): Promise<boolean> => {
    try {
      const { success } = await pollUntil({
        attempts: 10,
        delayMs: 500,
        task: async () => loadNotes(project, token, false),
        until: async (freshNotes) =>
          freshNotes.some((n) => n.title === title && n.author === author),
      });

      if (success) {
        setSyncing(false);
        return true;
      }
      setSyncing(false);
      return false;
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

        showNotification("success", "Nota creada");

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

        showNotification("success", "Nota actualizada");

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
      showNotification("error", error.message || "Error al guardar la nota");
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
      showNotification("success", "Nota archivada");
      
    } catch (error: any) {
      console.error("Error al archivar la nota:", error);
      showNotification("error", error.message || "Error al archivar la nota");
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
      <PageWithNavbar>
        <div className="notes-page">
          <LoadingState message="Cargando proyecto..." fullPage />
        </div>
      </PageWithNavbar>
    );
  }

  return (
    <PageWithNavbar>
      <Toast notification={notification} />
      <div className="notes-page">
        <SyncingOverlay
          visible={syncing}
          message="Sincronizando nota con GitHub..."
        />

        <PageHeader
          title="Notas del Proyecto"
          icon={<FileText size={24} />}
          actions={
            <div className="notes-header-actions">
              <div className="notes-search-wrap">
                <SearchField
                  value={searchTerm}
                  onChange={setSearchTerm}
                  placeholder="Buscar por título o autor..."
                />
              </div>
              <Button
                variant="success"
                leftIcon={<Plus size={16} />}
                onClick={openNewNoteModal}
                disabled={syncing}
              >
                Nueva Nota
              </Button>
            </div>
          }
        />

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
              <EntityCard
                key={note.id}
                className={`note-card ${selectedNote?.id === note.id ? "selected" : ""}`}
                onClick={() => openEditNoteModal(note)}
                selected={selectedNote?.id === note.id}
                title={note.title}
                description={note.description || "Sin descripción"}
                meta={
                  <>
                    <span className="note-author">
                      <User size={12} />
                      {note.author}
                    </span>
                    <span className="note-date">
                      <Calendar size={12} />
                      {note.date}
                    </span>
                  </>
                }
              />
            ))
          ) : (
            <EmptyState
              className="empty-notes"
              icon={<FileText size={48} />}
              title={
                searchTerm
                  ? `No hay notas que coincidan con "${searchTerm}"`
                  : "No hay notas para este proyecto"
              }
              action={
                searchTerm ? (
                  <Button variant="secondary" onClick={() => setSearchTerm("")}>
                    Limpiar búsqueda
                  </Button>
                ) : (
                  <Button
                    variant="success"
                    leftIcon={<Plus size={16} />}
                    onClick={openNewNoteModal}
                    disabled={syncing}
                  >
                    Crear primera nota
                  </Button>
                )
              }
            />
          )}
        </div>

        <Modal
          open={isModalOpen}
          onClose={() => setIsModalOpen(false)}
          title={
            <>
              <FileText size={20} />
              {selectedNote ? "Editar Nota" : "Nueva Nota"}
            </>
          }
          contentClassName="notes-modal-shell"
          footer={
            <>
              <Button
                variant="success"
                onClick={editNote}
                disabled={!editedTitle.trim() || syncing}
              >
                Guardar nota
              </Button>
              {selectedNote ? (
                <Button
                  variant="danger"
                  leftIcon={<Trash2 size={16} />}
                  onClick={() => setShowDeleteConfirm(true)}
                  disabled={syncing}
                >
                  Archivar
                </Button>
              ) : null}
              <Button
                variant="secondary"
                onClick={() => setIsModalOpen(false)}
                disabled={syncing}
              >
                Cancelar
              </Button>
            </>
          }
        >
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
        </Modal>

        <ConfirmDialog
          open={showDeleteConfirm}
          title="¿Archivar esta nota?"
          message="La nota se archivará y dejará de mostrarse."
          confirmLabel="Archivar"
          onConfirm={deleteNote}
          onCancel={() => setShowDeleteConfirm(false)}
          destructive
          busy={syncing}
        />
      </div>
    </PageWithNavbar>
  );
}