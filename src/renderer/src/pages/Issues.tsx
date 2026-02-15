import { useEffect, useState } from "react";
import DesktopManager from "../utils/desktop";
import "../styles/issues.css";

export default function Issues() {
  const [issues, setIssues] = useState<any[]>([]);

  useEffect(() => {
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
          id: issue.id,
          title: issue.title,
          description: issue.body,
          date: new Date(issue.created_at).toLocaleDateString(),
          status: issue.state,
        }));

      setIssues(formattedIssues);
    };

    loadIssues();
  }, []);

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
            onClick={() => alert(`Abrir issue ${issue.id}`)}
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
    </main>
  );
}
