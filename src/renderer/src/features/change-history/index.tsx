// src/renderer/src/pages/ChangeHistory.tsx
import { useEffect, useState } from "react";
import DesktopManager from "../../utils/desktop";
import Button from "../../components/Button/Button";
import EmptyState from "../../components/EmptyState/EmptyState";
import LoadingState from "../../components/LoadingState/LoadingState";
import PageWithNavbar from "../../components/PageWithNavbar/PageWithNavbar";
import PageHeader from "../../components/PageHeader/PageHeader";
import SearchField from "../../components/SearchField/SearchField";
import { Calendar, User, GitCommit, ExternalLink } from "lucide-react";
import "./changeHistory.css";

export default function ChangeHistory() {
    const [changes, setChanges] = useState<any[]>([]);
    const [filteredChanges, setFilteredChanges] = useState<any[]>([]);
    const [selectedUrl, setSelectedUrl] = useState<string | null>(null);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState("");

    const desktop = DesktopManager.getInstance();
    const [currentProject, setCurrentProject] = useState<{
        repoName: string;
        repoOwner: string;
    } | null>(null);

    useEffect(() => {
        loadProjectAndChanges();
    }, []);

    useEffect(() => {
        filterChanges();
    }, [searchTerm, changes]);

    const loadProjectAndChanges = async () => {
        setLoading(true);
        try {
            const token = await desktop.getConfig("github_token");
            if (!token) return;

            const project = await desktop.getConfig("current_project");
            if (!project?.repoName || !project?.repoOwner) return;

            setCurrentProject({ repoName: project.repoName, repoOwner: project.repoOwner });

            const data = await desktop.getChanges({
                repoName: project.repoName,
                repoOwner: project.repoOwner,
                token,
            });

            setChanges(data);
            setFilteredChanges(data);
        } catch (error) {
            console.error("Error cargando cambios:", error);
        } finally {
            setLoading(false);
        }
    };

    const filterChanges = () => {
        if (!searchTerm.trim()) {
            setFilteredChanges(changes);
            return;
        }

        const term = searchTerm.toLowerCase();
        const filtered = changes.filter(change => {
            const message = change.commit.message.toLowerCase();
            const author = change.commit.author.name.toLowerCase();
            const date = new Date(change.commit.author.date).toLocaleDateString().toLowerCase();
            
            return message.includes(term) || author.includes(term) || date.includes(term);
        });

        setFilteredChanges(filtered);
    };

    const openDiff = async (index: number) => {
        if (!currentProject || !filteredChanges.length) return;
        
        try {
            const token = await desktop.getConfig("github_token");
            if (!token) return;

            const originalChange = changes.find(c => c.sha === filteredChanges[index].sha);
            if (!originalChange) return;

            const compareUrl = await desktop.getDiff(
                changes[0].sha,
                originalChange.sha,
                {
                    repoName: currentProject.repoName,
                    repoOwner: currentProject.repoOwner,
                    token,
                }
            );

            setSelectedUrl(compareUrl);
        } catch (error) {
            console.error("Error al abrir la comparación:", error);
        }
    };

    const formatDate = (dateString: string) => {
        const date = new Date(dateString);
        return `${date.getDate()}/${date.getMonth() + 1}/${date.getFullYear()}`;
    };

    return (
        <PageWithNavbar mainClassName="change-history-main">
            <main className="content">
                <PageHeader
                    title="Historial de Cambios"
                    icon={<GitCommit size={24} />}
                    badge={
                        currentProject ? (
                            <span className="project-badge">{currentProject.repoName}</span>
                        ) : null
                    }
                    actions={
                        <div className="change-history-search-wrap">
                            <SearchField
                                value={searchTerm}
                                onChange={setSearchTerm}
                                placeholder="Buscar por commit, autor o fecha..."
                            />
                        </div>
                    }
                />

                {loading ? (
                    <div className="loading-container">
                        <LoadingState message="" />
                    </div>
                ) : (
                    <>
                        <div className="table-header">
                            <span>Commit</span>
                            <span>Fecha</span>
                            <span>Autor</span>
                        </div>

                        {filteredChanges.length > 0 ? (
                            <div className="table-body">
                                {filteredChanges.map((change, index) => (
                                    <div
                                        key={change.sha}
                                        className="row"
                                        onClick={() => openDiff(index)}
                                    >
                                        <span className="title" title={change.commit.message}>
                                            {change.commit.message}
                                        </span>
                                        <span className="date">
                                            <Calendar size={12} />
                                            {formatDate(change.commit.author.date)}
                                        </span>
                                        <span className="author">
                                            <User size={12} />
                                            {change.commit.author.name}
                                        </span>
                                    </div>
                                ))}
                            </div>
                        ) : (
                            <EmptyState
                                className="empty-state"
                                icon={<GitCommit size={48} />}
                                title={`No se encontraron resultados para "${searchTerm}"`}
                            />
                        )}
                    </>
                )}

                {/* MODAL WEBVIEW */}
                {selectedUrl && (
                    <div className="diff-modal-overlay" onClick={() => setSelectedUrl(null)}>
                        <div className="diff-modal" onClick={(e) => e.stopPropagation()}>
                            <Button
                                className="close-btn"
                                variant="secondary"
                                leftIcon={<ExternalLink size={16} />}
                                onClick={() => setSelectedUrl(null)}
                            >
                                Cerrar Vista de Cambios
                            </Button>

                            <webview
                                src={selectedUrl}
                                style={{ width: "100%", height: "100%" }}
                            />
                        </div>
                    </div>
                )}
            </main>
        </PageWithNavbar>
    );
}
