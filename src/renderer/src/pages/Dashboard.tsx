// src/renderer/src/pages/Dashboard.tsx
import React, { useState, useEffect } from "react";
import DesktopManager from "../utils/desktop";
import "../styles/dashboard.css";
import { useNavigate } from "react-router-dom";

import {
  Folder,
  Monitor,
  MapPin,
  Download,
  RefreshCw,
  Lock,
  Star,
  GitBranch,
  Calendar,
  DownloadCloud,
  Github,
} from "lucide-react";

const Dashboard: React.FC = () => {
  const [githubRepos, setGithubRepos] = useState<any[]>([]);
  const [localRepos, setLocalRepos] = useState<any[]>([]);
  const [selectedFolder, setSelectedFolder] = useState<string>("");
  const [loading, setLoading] = useState({
    github: true,
    local: false,
  });
  const [user, setUser] = useState<any>(null);
  const navigate = useNavigate();

  useEffect(() => {
    loadUserData();
    fetchGithubRepos();
    loadSavedFolder();
  }, []);

  const loadUserData = async () => {
    try {
      const desktop = DesktopManager.getInstance();
      const userData = await desktop.getConfig("github_user");
      setUser(userData);
    } catch (error) {
      console.error("Error cargando usuario:", error);
    }
  };

  const loadSavedFolder = async () => {
    try {
      const desktop = DesktopManager.getInstance();
      const savedFolder = await desktop.getConfig("selected_folder");

      if (savedFolder) {
        setSelectedFolder(savedFolder);
        // Cargar repositorios de la carpeta guardada
        const files = await desktop.readFolder(savedFolder);
        const repos = files.filter((f: any) => f.isGitRepo);
        setLocalRepos(repos);
      }
    } catch (error) {
      console.error("Error cargando carpeta guardada:", error);
    }
  };

  const navigateToProject = (repoPath: string, repoName: string) => {
    navigate(`/project/${encodeURIComponent(repoName)}`, {
      state: { repoPath, repoName }
    });
  };

  const fetchGithubRepos = async () => {
    setLoading((prev) => ({ ...prev, github: true }));

    try {
      const desktop = DesktopManager.getInstance();
      const token = await desktop.getConfig("github_token");

      if (!token) {
        await desktop.showMessage("No estás autenticado", "Error", "error");
        return;
      }

      const response = await fetch("https://api.github.com/user/repos", {
        headers: {
          Authorization: `Bearer ${token}`,
          Accept: "application/vnd.github.v3+json",
          "User-Agent": "Proyecto-Totem-Games",
        },
      });

      if (response.ok) {
        const repos = await response.json();
        setGithubRepos(repos);
      } else {
        await desktop.showMessage(
          "Error al cargar repositorios",
          "GitHub Error",
          "error",
        );
      }
    } catch (error) {
      console.error("Error:", error);
    } finally {
      setLoading((prev) => ({ ...prev, github: false }));
    }
  };

  const selectLocalFolder = async () => {
    setLoading((prev) => ({ ...prev, local: true }));

    try {
      const desktop = DesktopManager.getInstance();
      const folder = await desktop.selectFolder();

      if (folder) {
        // Guardar la carpeta seleccionada
        await desktop.setConfig("selected_folder", folder);

        setSelectedFolder(folder);
        const files = await desktop.readFolder(folder);
        const repos = files.filter((f: any) => f.isGitRepo);
        setLocalRepos(repos);
      }
    } catch (error: any) {
      await DesktopManager.getInstance().showMessage(
        error.message,
        "Error",
        "error",
      );
    } finally {
      setLoading((prev) => ({ ...prev, local: false }));
    }
  };

  const cloneRepository = async (repo: any) => {
    if (!selectedFolder) {
      await DesktopManager.getInstance().showMessage(
        "Primero selecciona una carpeta local",
        "Selecciona carpeta",
        "warning",
      );
      return;
    }

    try {
      const desktop = DesktopManager.getInstance();
      const token = await desktop.getConfig("github_token");

      if (!token) {
        await desktop.showMessage("No estás autenticado", "Error", "error");
        return;
      }

      const destination = `${selectedFolder}/${repo.name}`;

      await desktop.cloneRepository({
        url: repo.clone_url,
        destination,
        token,
      });

      await desktop.showMessage(
        `Repositorio "${repo.name}" clonado exitosamente en:\n${destination}`,
        "Clonado exitoso",
      );

      const files = await desktop.readFolder(selectedFolder);
      const repos = files.filter((f: any) => f.isGitRepo);
      setLocalRepos(repos);
    } catch (error: any) {
      await DesktopManager.getInstance().showMessage(
        error,
        "Error al clonar",
        "error",
      );
    }
  };

  const gitPull = async (repoPath: string, repoName: string) => {
    try {
      const desktop = DesktopManager.getInstance();

      const output = await desktop.gitCommand({
        command: `git pull origin main`,
        cwd: repoPath,
      });

      await desktop.showMessage(
        `Repositorio "${repoName}" actualizado:\n${output}`,
        "Git Pull exitoso",
      );
    } catch (error: any) {
      await DesktopManager.getInstance().showMessage(
        error,
        "Error en Git Pull",
        "error",
      );
    }
  };

  return (
    <div className="dashboard">
      {/* Header */}
      <div className="dashboard-header">
        <div className="user-info">
          {user?.avatar_url && (
            <img
              src={user.avatar_url}
              alt={user.login}
              className="user-avatar"
            />
          )}
          <div className="user-details">
            <h3 className="user-name">{user?.name || user?.login}</h3>
            <p className="user-username">
              @{user?.login} • {githubRepos.length} repositorios
            </p>
          </div>
        </div>

        <button
          onClick={selectLocalFolder}
          className={`folder-btn ${loading.local ? "loading" : ""}`}
          disabled={loading.local}
        >
          {loading.local ? (
            <>
              <div className="spinner-small" />
              Cargando...
            </>
          ) : (
            <>
              <Folder size={16} />
              {selectedFolder ? "Cambiar Carpeta" : "Seleccionar Carpeta"}
            </>
          )}
        </button>
      </div>

      <div className="dashboard-columns">
        {/* Local repos */}
        <div className="column column-local">
          <div className="card">
            <h3 className="card-title">
              <Monitor size={18} />
              Repositorios Locales
              {selectedFolder && (
                <span className="badge badge-blue">{localRepos.length}</span>
              )}
            </h3>

            {selectedFolder ? (
              <div className="folder-path">
                <MapPin size={14} /> {selectedFolder}
              </div>
            ) : (
              <div className="empty-state">
                <div className="empty-icon">
                  <Folder size={48} />
                </div>
                <p>Selecciona una carpeta para ver tus repositorios locales</p>
              </div>
            )}

            {localRepos.length > 0 ? (
              <div className="repos-list">
                {localRepos.map((repo, index) => (
                  <div
                    key={index}
                    className="repo-card repo-card-local"
                    onClick={() => navigateToProject(repo.path, repo.name)}
                    style={{ cursor: 'pointer' }}
                  >
                    <div className="repo-card-content">
                      <div>
                        <div className="repo-name">{repo.name}</div>
                        <div className="repo-path">{repo.path}</div>
                      </div>

                      <button
                        onClick={(e) => {
                          e.stopPropagation(); // Evitar que el click en el botón navegue
                          gitPull(repo.path, repo.name);
                        }}
                        className="btn-pull"
                      >
                        <Download size={14} /> Pull
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            ) : selectedFolder ? (
              <div className="empty-repos">
                <p>No se encontraron repositorios Git en esta carpeta</p>
              </div>
            ) : null}
          </div>
        </div>

        {/* GitHub repos */}
        <div className="column column-github">
          <div className="card">
            <div className="card-header">
              <h3 className="card-title">
                <Github size={18} />
                Repositorios de GitHub
                <span className="badge badge-green">{githubRepos.length}</span>
              </h3>

              <button
                onClick={fetchGithubRepos}
                disabled={loading.github}
                className="btn-refresh"
              >
                <RefreshCw size={14} /> Actualizar
              </button>
            </div>

            {loading.github ? (
              <div className="loading-state">
                <div className="spinner-large" />
                <p>Cargando repositorios de GitHub...</p>
              </div>
            ) : (
              <div className="repos-grid">
                {githubRepos.map((repo) => (
                  <div key={repo.id} className="repo-card repo-card-github">
                    <div className="repo-card-content">
                      <div className="repo-info">
                        <div className="repo-header">
                          <h4 className="repo-title">
                            {repo.name}
                            {repo.private && (
                              <span className="private-badge">
                                <Lock size={12} /> Privado
                              </span>
                            )}
                          </h4>
                          <span className="language-badge">
                            {repo.language || "Code"}
                          </span>
                        </div>

                        {repo.description && (
                          <p className="repo-description">{repo.description}</p>
                        )}

                        <div className="repo-stats">
                          <span>
                            <Star size={12} /> {repo.stargazers_count}
                          </span>
                          <span>
                            <GitBranch size={12} /> {repo.forks_count}
                          </span>
                          <span>
                            <Calendar size={12} />{" "}
                            {new Date(repo.updated_at).toLocaleDateString()}
                          </span>
                        </div>
                      </div>

                      <button
                        onClick={() => cloneRepository(repo)}
                        disabled={!selectedFolder}
                        className={`btn-clone ${!selectedFolder ? "disabled" : ""
                          }`}
                      >
                        <DownloadCloud size={14} /> Clonar Local
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default Dashboard;
