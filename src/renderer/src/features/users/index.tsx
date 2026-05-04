// src/renderer/src/pages/Users.tsx
import { useEffect, useState } from "react";
import DesktopManager from "../../utils/desktop";
import Button from "../../components/Button/Button";
import ConfirmDialog from "../../components/ConfirmDialog/ConfirmDialog";
import EmptyState from "../../components/EmptyState/EmptyState";
import EntityCard from "../../components/EntityCard/EntityCard";
import LoadingState from "../../components/LoadingState/LoadingState";
import Modal from "../../components/Modal/Modal";
import PageHeader from "../../components/PageHeader/PageHeader";
import SyncingOverlay from "../../components/SyncingOverlay/SyncingOverlay";
import Toast from "../../components/Toast/Toast";
import { useNotification } from "../../hooks/useNotification";
import { useSessionGuards } from "../../hooks/useSessionGuards";
import { pollUntil } from "../../utils/poll";
import {
    Users,
    Plus,
    User,
    Mail,
    Trash2,
    ArrowLeft,
    Shield,
    Loader2,
} from "lucide-react";
import "./users.css";

export default function UsersPage() {
    const { navigate } = useSessionGuards();
    const { notification, showNotification } = useNotification();
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
        } catch (err: any) {
            console.error(err);
            showNotification("error", err.message || "Error al cargar usuarios");
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
            showNotification("success", "Invitación enviada");
            loadUsers();
        } catch (err: any) {
            console.error(err);
            showNotification("error", err.message || "Error al invitar usuario");
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
            showNotification("success", "Usuario eliminado");
        } catch (err: any) {
            console.error(err);
            setSyncing(false);
            setIsDeleteConfirmOpen(false);
            showNotification("error", err.message || "Error al eliminar usuario");
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
            showNotification("success", "Rol actualizado");
        } else {
            console.error("Error cambiando rol:", result.error);
            showNotification("error", result.error || "Error cambiando rol");
        }
        
        setChangingRole(false);
    };

    const waitForUserRemoval = async (
        username: string,
        token: string
    ): Promise<boolean> => {
        try {
            const desktop = DesktopManager.getInstance();
            const { success } = await pollUntil({
                attempts: 10,
                delayMs: 500,
                task: async () =>
                    desktop.getOrgMembers("Proyecto-Final-de-Grado", token),
                until: async (collaborators) =>
                    !collaborators.some((user: any) => user.login === username),
            });

            if (success) {
                setSyncing(false);
                await loadUsers();
                return true;
            }
            setSyncing(false);
            return false;
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
            <Toast notification={notification} />
            <div className="users-header-bar">
                <Button
                    variant="secondary"
                    leftIcon={<ArrowLeft size={18} />}
                    onClick={handleBack}
                >
                    Volver
                </Button>
            </div>

            <div className="users-content">
                <PageHeader
                    title="Usuarios de la Organización"
                    icon={<Users size={24} />}
                    actions={
                        <Button
                            variant="success"
                            leftIcon={<Plus size={16} />}
                            onClick={openInviteModal}
                        >
                            Nuevo Usuario
                        </Button>
                    }
                />

                <SyncingOverlay
                    visible={syncing}
                    message="Sincronizando cambios con GitHub..."
                />

                {loading ? (
                    <div className="users-loading-wrap">
                        <LoadingState message="Cargando usuarios..." />
                    </div>
                ) : (
                    <div className="users-grid">
                        {users.length > 0 ? users.map((user) => (
                            <EntityCard
                                key={user.login}
                                className="user-card"
                                onClick={() => openUserModal(user)}
                                title={user.login}
                                badge={
                                    <span className={`user-role-badge ${user.role === "administrador" ? "admin" : "member"}`}>
                                        <Shield size={12} />
                                        {user.role === "administrador" ? "Administrador" : "Desarrollador"}
                                    </span>
                                }
                                description="Usuario colaborador de la organización"
                                meta={
                                    <span className="user-type">
                                        <User size={12} />
                                        {user.type || "User"}
                                    </span>
                                }
                            />
                        )) : (
                            <EmptyState
                                className="users-empty"
                                icon={<Users size={48} />}
                                title="No hay usuarios en la organización"
                                action={
                                    <Button
                                        variant="success"
                                        leftIcon={<Plus size={16} />}
                                        onClick={openInviteModal}
                                    >
                                        Invitar primer usuario
                                    </Button>
                                }
                            />
                        )}
                    </div>
                )}

                {/* Modal de usuario / invitación */}
                <Modal
                    open={isModalOpen}
                    onClose={() => setIsModalOpen(false)}
                    title={
                        isInviteMode ? (
                            <>
                                <Mail size={20} />
                                Invitar Usuario
                            </>
                        ) : (
                            <>
                                <User size={20} />
                                {selectedUser?.login}
                            </>
                        )
                    }
                    contentClassName="users-modal-shell"
                    footer={
                        isInviteMode ? (
                            <>
                                <Button
                                    variant="success"
                                    onClick={inviteUser}
                                    disabled={!email.trim()}
                                >
                                    Invitar
                                </Button>
                                <Button
                                    variant="secondary"
                                    onClick={() => setIsModalOpen(false)}
                                >
                                    Cancelar
                                </Button>
                            </>
                        ) : (
                            <>
                                <Button
                                    variant="danger"
                                    leftIcon={<Trash2 size={16} />}
                                    onClick={openDeleteConfirm}
                                >
                                    Eliminar usuario
                                </Button>
                                <Button
                                    variant="secondary"
                                    onClick={() => setIsModalOpen(false)}
                                >
                                    Cerrar
                                </Button>
                            </>
                        )
                    }
                >
                    {isInviteMode ? (
                        <div className="users-modal-field">
                            <label>Email del usuario</label>
                            <input
                                type="email"
                                placeholder="ejemplo@mail.com"
                                value={email}
                                onChange={(e) => setEmail(e.target.value)}
                            />
                        </div>
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
                                        <Button
                                            variant={
                                                selectedUserRole === "desarrollador"
                                                    ? "primary"
                                                    : "secondary"
                                            }
                                            leftIcon={
                                                changingRole ? (
                                                    <Loader2
                                                        size={16}
                                                        className="spinner-small"
                                                    />
                                                ) : (
                                                    <Shield size={16} />
                                                )
                                            }
                                            onClick={() => changeUserRole("desarrollador")}
                                            disabled={
                                                changingRole ||
                                                selectedUserRole === "desarrollador"
                                            }
                                        >
                                            Desarrollador
                                        </Button>
                                        <Button
                                            variant={
                                                selectedUserRole === "administrador"
                                                    ? "primary"
                                                    : "secondary"
                                            }
                                            leftIcon={
                                                changingRole ? (
                                                    <Loader2
                                                        size={16}
                                                        className="spinner-small"
                                                    />
                                                ) : (
                                                    <Shield size={16} />
                                                )
                                            }
                                            onClick={() => changeUserRole("administrador")}
                                            disabled={
                                                changingRole ||
                                                selectedUserRole === "administrador"
                                            }
                                        >
                                            Administrador
                                        </Button>
                                    </div>
                                    <p className="users-role-hint">
                                        {selectedUserRole === "administrador"
                                            ? "Este usuario puede gestionar la organización y sus miembros"
                                            : "Este usuario solo puede acceder a los repositorios"}
                                    </p>
                                </div>
                            )}
                        </>
                    )}
                </Modal>

                {/* Modal de confirmación de eliminación */}
                <ConfirmDialog
                    open={isDeleteConfirmOpen}
                    title="Confirmar eliminación"
                    message={
                        <>
                            ¿Estás seguro de que deseas eliminar a{" "}
                            <strong>{selectedUser?.login}</strong> de la organización?
                            <br />
                            <br />
                            Este usuario perderá acceso a todos los repositorios de la
                            organización. Esta acción no se puede deshacer.
                        </>
                    }
                    confirmLabel={deleting ? "Eliminando..." : "Eliminar"}
                    cancelLabel="Cancelar"
                    onConfirm={confirmDeleteUser}
                    onCancel={() => setIsDeleteConfirmOpen(false)}
                    destructive
                    busy={deleting}
                />
            </div>
        </div>
    );
}