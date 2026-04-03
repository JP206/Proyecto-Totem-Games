import { useEffect, useState } from "react";
import Navbar from "../components/Navbar";
import DesktopManager from "../utils/desktop";
import {
    Users,
    Plus,
    X,
    User,
    Mail,
    Trash2,
} from "lucide-react";
import "../styles/users.css";

export default function UsersPage() {
    const [users, setUsers] = useState<any[]>([]);
    const [selectedUser, setSelectedUser] = useState<any | null>(null);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [isInviteMode, setIsInviteMode] = useState(false);
    const [email, setEmail] = useState("");
    const [loading, setLoading] = useState(true);
    const [currentProject, setCurrentProject] = useState<any>(null);
    const [syncing, setSyncing] = useState(false);

    useEffect(() => {
        loadUsers();
    }, []);

    const loadUsers = async () => {
        try {
            setLoading(true);
            const desktop = DesktopManager.getInstance();

            const token = await desktop.getConfig("github_token");
            const project = await desktop.getConfig("current_project");

            const collaborators = await desktop.getOrgMembers(
                "Proyecto-Final-de-Grado",
                token
            );

            setUsers(collaborators);
            setCurrentProject(project);
        } catch (err) {
            console.error(err);
        } finally {
            setLoading(false);
        }
    };

    const waitForUserRemoval = async (
        username: string,
        token: string,
        attempts = 0
    ): Promise<boolean> => {
        const maxAttempts = 10;

        if (attempts >= maxAttempts) {
            setSyncing(false);
            return false;
        }

        try {
            const desktop = DesktopManager.getInstance();

            const collaborators = await desktop.getOrgMembers(
                "Proyecto-Final-de-Grado",
                token
            );

            const exists = collaborators.some(
                (user: any) => user.login === username
            );

            if (!exists) {
                setSyncing(false);
                await loadUsers();
                return true;
            }

            return new Promise((resolve) => {
                setTimeout(() => {
                    resolve(waitForUserRemoval(username, token, attempts + 1));
                }, 500);
            });
        } catch (error) {
            console.error("Error en waitForUserRemoval:", error);
            setSyncing(false);
            return false;
        }
    };

    const openUserModal = (user: any) => {
        setSelectedUser(user);
        setIsInviteMode(false);
        setIsModalOpen(true);
    };

    const openInviteModal = () => {
        setSelectedUser(null);
        setEmail("");
        setIsInviteMode(true);
        setIsModalOpen(true);
    };

    const inviteUser = async () => {
        try {
            const desktop = DesktopManager.getInstance();
            const token = await desktop.getConfig("github_token");

            await desktop.inviteToOrg("Proyecto-Final-de-Grado", token, email);

            setIsModalOpen(false);
            loadUsers();
        } catch (err) {
            console.error(err);
        }
    };

    const removeUser = async () => {
        try {
            const desktop = DesktopManager.getInstance();
            const token = await desktop.getConfig("github_token");

            if (!token || !selectedUser) return;

            setIsModalOpen(false);
            setSyncing(true);

            await desktop.removeUser(
                "Proyecto-Final-de-Grado",
                token,
                selectedUser.login
            );

            waitForUserRemoval(selectedUser.login, token).catch(console.error);
        } catch (err) {
            console.error(err);
            setSyncing(false);
        }
    };

    return (
        <>
            <Navbar />
            <div className="issues-container">
                <div className="issues-header">
                    <h2>
                        <Users size={24} />
                        Usuarios del Proyecto
                    </h2>

                    <div className="header-actions">
                        <button className="add-btn" onClick={openInviteModal}>
                            <Plus size={16} />
                            Nuevo Usuario
                        </button>
                    </div>
                </div>

                {syncing && (
                    <div className="syncing-overlay">
                        <div className="syncing-content">
                            <div className="spinner-large" />
                            <p>Sincronizando cambios con GitHub...</p>
                        </div>
                    </div>
                )}

                {loading ? (
                    <div className="loading-state">
                        <div className="spinner-large" />
                        <p>Cargando usuarios...</p>
                    </div>
                ) : (
                    <div className="issues-grid">
                        {users.map((user) => (
                            <div
                                key={user.login}
                                className="issue-card"
                                onClick={() => openUserModal(user)}
                            >
                                <h3 className="issue-title">{user.login}</h3>

                                <p className="issue-description">
                                    Usuario colaborador del repositorio
                                </p>

                                <div className="issue-footer">
                                    <span className="issue-assignee">
                                        <User size={12} />
                                        {user.type}
                                    </span>
                                </div>
                            </div>
                        ))}
                    </div>
                )}

                {isModalOpen && (
                    <div className="modal-overlay" onClick={() => setIsModalOpen(false)}>
                        <div className="modal" onClick={(e) => e.stopPropagation()}>
                            <div className="modal-header">
                                <h3>
                                    {isInviteMode ? (
                                        <>
                                            <Mail size={20} />
                                            Invitar Usuario
                                        </>
                                    ) : (
                                        <>
                                            <User size={20} />
                                            {selectedUser?.login}
                                        </>
                                    )}
                                </h3>

                                <button
                                    className="modal-close"
                                    onClick={() => setIsModalOpen(false)}
                                >
                                    <X size={18} />
                                </button>
                            </div>

                            {isInviteMode ? (
                                <>
                                    <div className="modal-field">
                                        <label>Email del usuario</label>
                                        <input
                                            type="email"
                                            placeholder="ejemplo@mail.com"
                                            value={email}
                                            onChange={(e) => setEmail(e.target.value)}
                                        />
                                    </div>

                                    <div className="modal-actions">
                                        <button
                                            className="save-btn"
                                            onClick={inviteUser}
                                            disabled={!email.trim()}
                                        >
                                            Invitar
                                        </button>

                                        <button
                                            className="cancel-btn"
                                            onClick={() => setIsModalOpen(false)}
                                        >
                                            Cancelar
                                        </button>
                                    </div>
                                </>
                            ) : (
                                <>
                                    <div className="modal-field">
                                        <label>Usuario</label>
                                        <input value={selectedUser?.login} disabled />
                                    </div>

                                    <div className="modal-actions">
                                        <button className="cancel-btn" onClick={removeUser}>
                                            <Trash2 size={16} />
                                            Eliminar usuario
                                        </button>

                                        <button
                                            className="cancel-btn"
                                            onClick={() => setIsModalOpen(false)}
                                        >
                                            Cerrar
                                        </button>
                                    </div>
                                </>
                            )}
                        </div>
                    </div>
                )}
            </div>
        </>
    );
}