import { useEffect, useState } from "react";
import DesktopManager from "../utils/desktop";
import "../styles/changeHistory.css";

export default function ChangeHistory() {
    const [changes, setChanges] = useState<any[]>([]);
    const [selectedUrl, setSelectedUrl] = useState<string | null>(null);

    const repoOwner = "biancaluzz";
    const repoName = "juego-totem-games";
    const desktop = DesktopManager.getInstance();

    useEffect(() => {
        loadChanges();
    }, []);

    const loadChanges = async () => {
        const token = await desktop.getConfig("github_token");
        if (!token) return;

        const data = await desktop.getChanges({
            repoName,
            repoOwner,
            token,
        });

        setChanges(data);
    };

    const openDiff = async (index: number) => {
        const token = await desktop.getConfig("github_token");
        if (!token) return;

        const compareUrl = await desktop.getDiff(
            changes[0].sha,
            changes[index].sha,
            {
                repoName,
                repoOwner,
                token,
            }
        );

        setSelectedUrl(compareUrl);
    };

    return (
        <main className="content">
            <div className="header">
                <button>Filtro</button>
            </div>

            <div className="table-header">
                <span>Commit</span>
                <span>Fecha</span>
                <span>Autor</span>
            </div>

            <div className="table-body">
                {changes.map((change, index) => (
                    <div
                        key={change.sha}
                        className="row"
                        onClick={() => openDiff(index)}
                    >
                        <span className="title">{change.commit.message}</span>
                        <span>{change.commit.author.date}</span>
                        <span className="author">{change.commit.author.name}</span>
                    </div>
                ))}
            </div>

            {/* MODAL WEBVIEW */}
            {selectedUrl && (
                <div className="diff-modal-overlay">
                    <div className="diff-modal">
                        <button
                            className="close-btn"
                            onClick={() => setSelectedUrl(null)}
                        >
                            Cerrar
                        </button>

                        <webview
                            src={selectedUrl}
                            style={{ width: "100%", height: "100%" }}
                        />
                    </div>
                </div>
            )}
        </main>
    );
}
