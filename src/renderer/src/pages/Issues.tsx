import { useEffect, useState } from "react";
import DesktopManager from "../utils/desktop";
import "../styles/issues.css";

export default function Issues() {
  const [issues, setIssues] = useState<any[]>([]);
  const [selectedIssue, setSelectedIssue] = useState<any | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);


  useEffect(() => {
    loadIssues();
  }, []);

  const loadIssues = async () => {
      const desktop = DesktopManager.getInstance();
      const token = await desktop.getConfig("github_token");
      if (!token) return;

      const data = await desktop.getIssues({
        repoName: "juego-totem-games",
        repoOwner: "biancaluzz",
        token,
      });

      const formattedIssues = data
        .filter((issue: any) => !issue.pull_request)
        .map((issue: any) => ({
          id: issue.number,
          title: issue.title,
          description: issue.body,
          date: new Date(issue.created_at).toLocaleDateString(),
          status: issue.state,
        }));

      setIssues(formattedIssues);
    };

  const markAsResolved = async (issueId: number) => {
    const desktop = DesktopManager.getInstance();
    const token = await desktop.getConfig("github_token");
    if (!token) return;

    await desktop.markIssueAsResolved(issueId, {
      repoName: "juego-totem-games",
      repoOwner: "biancaluzz",
      token,
    });

    loadIssues();
    setIsModalOpen(false)
  }

  return (
    <main className="content">
      <div className="header">
        <button>Filtro</button>
        <button className="add">Añadir</button>
      </div>

      {/* HEADER DE TABLA */}
      <div className="table-header">
        <span>Issue</span>
        <span>Descripción</span>
        <span>Fecha</span>
        <span>Estado</span>
      </div>

      {/* FILAS */}
      <div className="table-body">
        {issues.map(issue => (
          <div
            key={issue.id}
            className="row"
            onClick={() => {
              setSelectedIssue(issue);
              setIsModalOpen(true);
            }}
          >
            <span className="title">{issue.title}</span>
            <span className="description">{issue.description}</span>
            <span>{issue.date}</span>
            <span className={`status ${issue.status}`}>
              {issue.status}
            </span>
          </div>
        ))}
      </div>
      
      {isModalOpen && selectedIssue && (
        <div className="modal-overlay" onClick={() => setIsModalOpen(false)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h3>Issue #{selectedIssue.id}</h3>
              <span className={`status ${selectedIssue.status}`}>
                {selectedIssue.status}
              </span>
            </div>

            <div className="modal-body">
              <p><strong>Descripción</strong></p>
              <p>{selectedIssue.description || "Sin descripción"}</p>
            </div>

            <div className="modal-actions">
              <button className="resolve" onClick={() => markAsResolved(selectedIssue.id)}>Marcar como resuelto</button>
              <button onClick={() => setIsModalOpen(false)}>Cerrar</button>
            </div>
          </div>
        </div>
      )}

    </main>
  );
}
