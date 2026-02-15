import { useEffect, useState } from "react";
import DesktopManager from "../utils/desktop";
import "../styles/changeHistory.css";

export default function ChangeHistory() {
    const [changes, setChanges] = useState<any[]>([]);
    const [selectedUrl, setSelectedUrl] = useState<string | null>(null);

    const repoOwner = "biancaluzz";
    const repoName = "juego-totem-games";

    useEffect(() => {
        loadChanges();
    }, []);

    const loadChanges = async () => {
        const desktop = DesktopManager.getInstance();
        const token = await desktop.getConfig("github_token");
        if (!token) return;

        const data = await desktop.getChanges({
            repoName,
            repoOwner,
            token,
        });

        data.sort((a, b) =>
            new Date(b.commit.author.date).getTime() - new Date(a.commit.author.date).getTime()
        );

        data.map ((change: any) => {
            change.commit.author.date = new Date(change.commit.author.date).toLocaleString();
            return change;
        });

        setChanges(data);
    };

    const openDiff = (index: number) => {
        const current = changes[index];
        const previous = changes[index + 1];

        if (!previous) return; // Si es el último commit, no hay anterior

        const head = current.sha;
        const base = previous.sha;

        const compareUrl = `https://github.com/${repoOwner}/${repoName}/compare/${base}...${head}`;

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
