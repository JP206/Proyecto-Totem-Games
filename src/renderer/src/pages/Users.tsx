// src/renderer/src/pages/Users.tsx
import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import DesktopManager from "../utils/desktop";
import {
    Users,
    Plus,
    X,
    User,
    Mail,
    Trash2,
    ArrowLeft,
    Shield,
    Loader2,
    AlertTriangle,
} from "lucide-react";
import "../styles/users.css";

export default function UsersPage() {
    const [users, setUsers] = useState<any[]>([]);
    const [selectedUser, setSelectedUser] = useState<any | null>(null);
    const [selectedUserRole, setSelectedUserRole] = useState<string>("");
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [isInviteMode, setIsInviteMode] = useState(false);
    const [isDeleteConfirmOpen, setIsDeleteConfirmOpen] = useState(false);
    const [email, setEmail] = useState("");
    const [loading, setLoading] = useState(true);
    const [syncing, setSyncing] = useState(false);
    const [changingRole, setChangingRole] = useState(false);
    const [deleting, setDeleting] = useState(false);
    const [currentUserRole, setCurrentUserRole] = useState<string>("");
    const navigate = useNavigate();

    useEffect(() => {
        loadUsers();
        loadCurrentUserRole();
    }, []);

    const loadCurrentUserRole = async () => {
        const desktop = DesktopManager.getInstance();
        const token = await desktop.getConfig("github_token");
        const userData = await desktop.getConfig("github_user");
        
        if (token && userData?.login) {
            const roleResult = await desktop.verifyUserRole(token, userData.login);
            setCurrentUserRole(roleResult.role);
        }
    };

    const loadUsers = async () => {
        try {
            setLoading(true);
            const desktop = DesktopManager.getInstance();
            const token = await desktop.getConfig("github_token");
            const members = await desktop.getOrgMembers("Proyecto-Final-de-Grado", token);
            setUsers(members);
        } catch (err) {
            console.error(err);
        } finally {
            setLoading(false);
        }
    };

    const openUserModal = async (user: any) => {
        setSelectedUser(user);
        setIsInviteMode(false);
        setSelectedUserRole(user.role || "desarrollador");
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

    const openDeleteConfirm = () => {
        setIsModalOpen(false);
        setIsDeleteConfirmOpen(true);
    };

    const confirmDeleteUser = async () => {
        if (!selectedUser) return;

        setDeleting(true);
        const desktop = DesktopManager.getInstance();
        const token = await desktop.getConfig("github_token");

        try {
            if (!token) return;

            await desktop.removeUser(
                "Proyecto-Final-de-Grado",
                token,
                selectedUser.login
            );

            setIsDeleteConfirmOpen(false);
            setSelectedUser(null);
            setSyncing(true);
            await waitForUserRemoval(selectedUser.login, token);
        } catch (err) {
            console.error(err);
            setSyncing(false);
            setIsDeleteConfirmOpen(false);
        } finally {
            setDeleting(false);
        }
    };

    const changeUserRole = async (newRole: "administrador" | "desarrollador") => {
        if (!selectedUser) return;
        
        setChangingRole(true);
        const desktop = DesktopManager.getInstance();
        const token = await desktop.getConfig("github_token");
        
        const result = await desktop.setUserRole(
            "Proyecto-Final-de-Grado",
            token,
            selectedUser.login,
            newRole
        );
        
        if (result.success) {
            setSelectedUserRole(newRole);
            await loadUsers();
        } else {
            console.error("Error cambiando rol:", result.error);
        }
        
        setChangingRole(false);
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

    const handleBack = () => {
        navigate("/dashboard");
    };

    const isCurrentUserAdmin = currentUserRole === "administrador";

    return (
        <div className="users-container">
            <div className="users-header-bar">
                <button
                    type="button"
                    className="users-back-btn"
                    onClick={handleBack}
                >
                    <ArrowLeft size={18} />
                    <span>Volver</span>
                </button>
            </div>

            <div className="users-content">
                <div className="users-header">
                    <h2>
                        <Users size={24} />
                        Usuarios de la Organización
                    </h2>

                    <div className="users-header-actions">
                        <button className="users-add-btn" onClick={openInviteModal}>
                            <Plus size={16} />
                            Nuevo Usuario
                        </button>
                    </div>
                </div>

                {syncing && (
                    <div className="users-syncing-overlay">
                        <div className="users-syncing-content">
                            <div className="spinner-large" />
                            <p>Sincronizando cambios con GitHub...</p>
                        </div>
                    </div>
                )}

                {loading ? (
                    <div className="users-loading-state">
                        <div className="spinner-large" />
                        <p>Cargando usuarios...</p>
                    </div>
                ) : (
                    <div className="users-grid">
                        {users.map((user) => (
                            <div
                                key={user.login}
                                className="user-card"
                                onClick={() => openUserModal(user)}
                            >
                                <div className="user-card-header">
                                    <h3 className="user-title">{user.login}</h3>
                                    <span className={`user-role-badge ${user.role === "administrador" ? "admin" : "member"}`}>
                                        {user.role === "administrador" ? (
                                            <><Shield size={12} /> Administrador</>
                                        ) : (
                                            <><Shield size={12} /> Desarrollador</>
                                        )}
                                    </span>
                                </div>
                                <p className="user-description">
                                    Usuario colaborador de la organización
                                </p>
                                <div className="user-footer">
                                    <span className="user-type">
                                        <User size={12} />
                                        {user.type || "User"}
                                    </span>
                                </div>
                            </div>
                        ))}
                    </div>
                )}

                {/* Modal de usuario / invitación */}
                {isModalOpen && (
                    <div className="users-modal-overlay" onClick={() => setIsModalOpen(false)}>
                        <div className="users-modal" onClick={(e) => e.stopPropagation()}>
                            <div className="users-modal-header">
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
                                    className="users-modal-close"
                                    onClick={() => setIsModalOpen(false)}
                                >
                                    <X size={18} />
                                </button>
                            </div>

                            {isInviteMode ? (
                                <>
                                    <div className="users-modal-field">
                                        <label>Email del usuario</label>
                                        <input
                                            type="email"
                                            placeholder="ejemplo@mail.com"
                                            value={email}
                                            onChange={(e) => setEmail(e.target.value)}
                                        />
                                    </div>
                                    <div className="users-modal-actions">
                                        <button
                                            className="users-save-btn"
                                            onClick={inviteUser}
                                            disabled={!email.trim()}
                                        >
                                            Invitar
                                        </button>
                                        <button
                                            className="users-cancel-btn"
                                            onClick={() => setIsModalOpen(false)}
                                        >
                                            Cancelar
                                        </button>
                                    </div>
                                </>
                            ) : (
                                <>
                                    <div className="users-modal-field">
                                        <label>Usuario</label>
                                        <input value={selectedUser?.login} disabled />
                                    </div>

                                    {isCurrentUserAdmin && (
                                        <div className="users-modal-field">
                                            <label>Rol en la organización</label>
                                            <div className="users-role-selector">
                                                <button
                                                    type="button"
                                                    className={`users-role-btn member ${selectedUserRole === "desarrollador" ? "active" : ""}`}
                                                    onClick={() => changeUserRole("desarrollador")}
                                                    disabled={changingRole || selectedUserRole === "desarrollador"}
                                                >
                                                    {changingRole ? (
                                                        <Loader2 size={16} className="spinner-small" />
                                                    ) : (
                                                        <Shield size={16} />
                                                    )}
                                                    Desarrollador
                                                </button>
                                                <button
                                                    type="button"
                                                    className={`users-role-btn admin ${selectedUserRole === "administrador" ? "active" : ""}`}
                                                    onClick={() => changeUserRole("administrador")}
                                                    disabled={changingRole || selectedUserRole === "administrador"}
                                                >
                                                    {changingRole ? (
                                                        <Loader2 size={16} className="spinner-small" />
                                                    ) : (
                                                        <Shield size={16} />
                                                    )}
                                                    Administrador
                                                </button>
                                            </div>
                                            <p className="users-role-hint">
                                                {selectedUserRole === "administrador" 
                                                    ? "Este usuario puede gestionar la organización y sus miembros" 
                                                    : "Este usuario solo puede acceder a los repositorios"}
                                            </p>
                                        </div>
                                    )}

                                    <div className="users-modal-actions">
                                        <button className="users-delete-btn" onClick={openDeleteConfirm}>
                                            <Trash2 size={16} />
                                            Eliminar usuario
                                        </button>
                                        <button
                                            className="users-cancel-btn"
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

                {/* Modal de confirmación de eliminación */}
                {isDeleteConfirmOpen && (
                    <div className="users-modal-overlay" onClick={() => setIsDeleteConfirmOpen(false)}>
                        <div className="users-modal users-confirm-modal" onClick={(e) => e.stopPropagation()}>
                            <div className="users-modal-header users-confirm-header">
                                <div className="users-confirm-icon">
                                    <AlertTriangle size={32} />
                                </div>
                                <h3>Confirmar eliminación</h3>
                                <button
                                    className="users-modal-close"
                                    onClick={() => setIsDeleteConfirmOpen(false)}
                                >
                                    <X size={18} />
                                </button>
                            </div>

                            <div className="users-confirm-content">
                                <p>
                                    ¿Estás seguro de que deseas eliminar a <strong>{selectedUser?.login}</strong> de la organización?
                                </p>
                                <p className="users-confirm-warning">
                                    Este usuario perderá acceso a todos los repositorios de la organización.
                                    Esta acción no se puede deshacer.
                                </p>
                            </div>

                            <div className="users-modal-actions users-confirm-actions">
                                <button
                                    className="users-confirm-delete-btn"
                                    onClick={confirmDeleteUser}
                                    disabled={deleting}
                                >
                                    {deleting ? (
                                        <>
                                            <Loader2 size={16} className="spinner-small" />
                                            Eliminando...
                                        </>
                                    ) : (
                                        <>
                                            <Trash2 size={16} />
                                            Eliminar
                                        </>
                                    )}
                                </button>
                                <button
                                    className="users-cancel-btn"
                                    onClick={() => setIsDeleteConfirmOpen(false)}
                                    disabled={deleting}
                                >
                                    Cancelar
                                </button>
                            </div>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}