import { useEffect, useState } from "react";
import DesktopManager from "../utils/desktop";
import { IssueData } from "../utils/electron";
import "../styles/notes.css";

export default function Notes() {
    const [notes, setNotes] = useState<any[]>([]);
    const [selectedNote, setSelectedNote] = useState<any | null>(null);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editedTitle, setEditedTitle] = useState("");
    const [editedDescription, setEditedDescription] = useState("");
    const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

    // Load notes when first entering screen
    useEffect(() => {
        loadNotes();
    }, []);

    const loadNotes = async () => {
        const desktop = DesktopManager.getInstance();
        const token = await desktop.getConfig("github_token");
        if (!token) return;

        const data = await desktop.getIssues(
            {
                repoName: "juego-totem-games",
                repoOwner: "biancaluzz",
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
    };

    const editNote = async () => {
        const desktop = DesktopManager.getInstance();
        const token = await desktop.getConfig("github_token");
        if (!token) return;

        let response;

        if (!selectedNote) {
            // Create note issue
            let issueData: IssueData = {
                title: editedTitle,
                description: editedDescription,
                id: null,
                assignees: null,
                labels: ["documentation"]
            }

            response = await desktop.createIssue(issueData, {
                repoName: "juego-totem-games",
                repoOwner: "biancaluzz",
                token
            }
            )
        }
        else {
            // Edit existing issue
            let issueData: IssueData = {
                title: editedTitle,
                description: editedDescription,
                id: selectedNote.id,
                assignees: null,
                labels: null
            }

            response = await desktop.editIssue(issueData, {
                repoName: "juego-totem-games",
                repoOwner: "biancaluzz",
                token
            }
            )
        }

        if (response) {
            await loadNotes();
            setIsModalOpen(false);
        }
    }

    const deleteNote = async () => {
        const desktop = DesktopManager.getInstance();
        const token = await desktop.getConfig("github_token");
        if (!token) return;

        // Doesn't actually delete, marks as resolved instead
        await desktop.markIssueAsResolved(selectedNote.id, {
            repoName: "juego-totem-games",
            repoOwner: "biancaluzz",
            token,
        });

        await loadNotes();
        setIsModalOpen(false)
    };

    return (
        <div className="notes-container">

            {/* PANEL IZQUIERDO */}
            <div className="notes-list">
                <div className="notes-header">
                    <h2>Notas</h2>
                    <button className="add"
                        onClick={() => {
                            setSelectedNote(null);
                            setEditedTitle("");
                            setEditedDescription("");
                            setIsModalOpen(true);
                        }}>Añadir</button>
                </div>

                {notes.map(note => (
                    <div
                        key={note.id}
                        className="note-item"
                        onClick={() => {
                            setSelectedNote(note);
                            setEditedTitle(note.title);
                            setEditedDescription(note.description);
                            setIsModalOpen(true);
                        }}
                    >
                        {note.title}
                    </div>
                ))}
            </div>

            {/* MODAL */}
            {isModalOpen && (
                <div className="modal-overlay">
                    <div className="modal">

                        <div className="modal-header">
                            <button
                                className="back-button"
                                onClick={() => setIsModalOpen(false)}
                            >
                                Cerrar
                            </button>

                            <input
                                className="modal-title"
                                placeholder="Título"
                                value={editedTitle}
                                onChange={e => setEditedTitle(e.target.value)}
                            />

                            <button
                                className="delete-button"
                                onClick={() => setShowDeleteConfirm(true)}
                            >
                                🗑
                            </button>
                        </div>

                        <textarea
                            className="modal-content"
                            placeholder="Descripción"
                            value={editedDescription}
                            onChange={e => setEditedDescription(e.target.value)}
                        />

                        <div className="modal-actions">
                            <button className="save-button" onClick={editNote}>
                                Guardar
                            </button>
                        </div>

                        {/* POPUP CONFIRM DELETE */}
                        {showDeleteConfirm && (
                            <div className="confirm-overlay">
                                <div className="confirm-box">
                                    <p>¿Desea borrar la nota?</p>
                                    <div className="confirm-actions">
                                        <button
                                            className="delete-confirm"
                                            onClick={async () => {
                                                await deleteNote();
                                                setShowDeleteConfirm(false);
                                                setIsModalOpen(false)
                                            }}>
                                            Borrar
                                        </button>
                                        <button
                                            className="cancel-confirm"
                                            onClick={() => {
                                                setShowDeleteConfirm(false);
                                                setIsModalOpen(false)
                                            }}
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
    );
}
