import { useEffect, useState } from "react";
import DesktopManager from "../utils/desktop";
import { IssueData } from "../utils/electron";
import "../styles/issues.css";

export default function Issues() {
  const [issues, setIssues] = useState<any[]>([]);
  const [selectedIssue, setSelectedIssue] = useState<any | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editedTitle, setEditedTitle] = useState("");
  const [editedDescription, setEditedDescription] = useState("");

  // Load issues when first entering screen
  useEffect(() => {
    loadIssues();
  }, []);

  const loadIssues = async () => {
    const desktop = DesktopManager.getInstance();
    const token = await desktop.getConfig("github_token");
    if (!token) return;

    const data = await desktop.getIssues(
      {
        repoName: "juego-totem-games",
        repoOwner: "biancaluzz",
        token,
      },
      "bug"
    );

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

  const markAsResolved = async () => {
    const desktop = DesktopManager.getInstance();
    const token = await desktop.getConfig("github_token");
    if (!token) return;

    await desktop.markIssueAsResolved(selectedIssue.issueId, {
      repoName: "juego-totem-games",
      repoOwner: "biancaluzz",
      token,
    });

    await loadIssues();
    setIsModalOpen(false)
  }

  const editIssue = async () => {
    const desktop = DesktopManager.getInstance();
    const token = await desktop.getConfig("github_token");
    if (!token) return;

    let response;

    if (!selectedIssue) {
      // Create issue
      let issueData: IssueData = {
        title: editedTitle,
        description: editedDescription,
        id: null,
        assignees: null,
        labels: ["bug"]
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
        id: selectedIssue.id,
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
      await loadIssues();
      setIsModalOpen(false);
    }
  }

  return (
    <main className="content">
      <div className="header">
        <button>Filtro</button>
        <button className="add"
          onClick={() => {
            setSelectedIssue(null);
            setEditedTitle("");
            setEditedDescription("");
            setIsModalOpen(true);
          }}>Añadir</button>
      </div>

      <div className="table-header">
        <span>Issue</span>
        <span>Descripción</span>
        <span>Fecha</span>
        <span>Estado</span>
      </div>

      <div className="table-body">
        {issues.map(issue => (
          <div
            key={issue.id}
            className="row"
            onClick={() => {
              setSelectedIssue(issue);
              setEditedTitle(issue.title);
              setEditedDescription(issue.description);
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

      {isModalOpen && (
        <div className="modal-overlay" onClick={() => setIsModalOpen(false)}>
          <div className="modal" onClick={e => e.stopPropagation()}>

            <div className="modal-header">
              <input
                className="modal-title"
                value={editedTitle}
                onChange={e => setEditedTitle(e.target.value)}
              />

              {selectedIssue && (
                <span className={`status ${selectedIssue.status}`}>
                  {selectedIssue.status}
                </span>
              )}
            </div>

            <div className="modal-body">
              <p><strong>Descripción</strong></p>

              <textarea
                className="modal-description"
                value={editedDescription}
                onChange={e => setEditedDescription(e.target.value)}
                rows={6}
              />
            </div>

            <div className="modal-actions">
              <button
                className="save"
                onClick={() => { editIssue() }}
              >
                Guardar
              </button>

              {selectedIssue && selectedIssue.status !== "closed" && (
                <button
                  className="resolve"
                  onClick={() => markAsResolved()}
                >
                  Marcar como resuelto
                </button>
              )}

              <button onClick={() => setIsModalOpen(false)}>Cerrar</button>
            </div>
          </div>
        </div>
      )}

    </main>
  );
}
