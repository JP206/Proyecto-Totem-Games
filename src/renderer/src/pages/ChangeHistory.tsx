// src/renderer/src/pages/ChangeHistory.tsx
import { useEffect, useState } from "react";
import DesktopManager from "../utils/desktop";
import Navbar from "../components/Navbar";
import { Calendar, User, GitCommit, ExternalLink, Search } from "lucide-react";
import "../styles/changeHistory.css";

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
        <>  
            <Navbar />

            <main className="content">
                <div className="header">
                    <h2>
                        <GitCommit size={24} />
                        Historial de Cambios
                        {currentProject && (
                            <span className="project-badge">{currentProject.repoName}</span>
                        )}
                    </h2>
                    
                    <div className="search-container">
                        <Search size={16} className="search-icon" />
                        <input
                            type="text"
                            placeholder="Buscar por commit, autor o fecha..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className="search-input"
                        />
                        {searchTerm && (
                            <button 
                                className="clear-search"
                                onClick={() => setSearchTerm("")}
                            >
                                ×
                            </button>
                        )}
                    </div>
                </div>

                {loading ? (
                    <div className="loading-container">
                        <div className="spinner-large" />
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
                            <div className="empty-state">
                                <GitCommit size={48} />
                                <p>No se encontraron resultados para "{searchTerm}"</p>
                            </div>
                        )}
                    </>
                )}

                {/* MODAL WEBVIEW */}
                {selectedUrl && (
                    <div className="diff-modal-overlay" onClick={() => setSelectedUrl(null)}>
                        <div className="diff-modal" onClick={(e) => e.stopPropagation()}>
                            <button
                                className="close-btn"
                                onClick={() => setSelectedUrl(null)}
                            >
                                <ExternalLink size={16} />
                                Cerrar Vista de Cambios
                            </button>

                            <webview
                                src={selectedUrl}
                                style={{ width: "100%", height: "100%" }}
                            />
                        </div>
                    </div>
                )}
            </main>
        </>
    );
}