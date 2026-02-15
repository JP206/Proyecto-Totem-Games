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
  Calendar,
  DownloadCloud,
  Github,
  CheckCircle,
  AlertCircle,
  Clock,
  Search,
  LogOut,
  Shield,
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
  const [showProfilePopup, setShowProfilePopup] = useState(false);
  const [localSearch, setLocalSearch] = useState("");
  const [githubSearch, setGithubSearch] = useState("");
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
        const repos = await Promise.all(
          files
            .filter((f: any) => f.isGitRepo)
            .map(async (repo: any) => {
              const status = await getRepoStatus(repo.path);
              return { ...repo, status };
            })
        );
        setLocalRepos(repos);
      }
    } catch (error) {
      console.error("Error cargando carpeta guardada:", error);
    }
  };

  const getRepoStatus = async (repoPath: string) => {
    try {
      const desktop = DesktopManager.getInstance();
      
      // Obtener fecha del último pull
      const logResult = await desktop.gitCommand({
        command: "git log -1 --format=%cd --date=iso",
        cwd: repoPath,
      }).catch(() => null);

      // Verificar si está actualizado con el remoto
      const fetchResult = await desktop.gitCommand({
        command: "git fetch origin",
        cwd: repoPath,
      }).catch(() => null);

      const statusResult = await desktop.gitCommand({
        command: "git status -uno",
        cwd: repoPath,
      }).catch(() => null);

      let status = "unknown";
      if (statusResult) {
        if (statusResult.includes("Your branch is up to date")) {
          status = "up-to-date";
        } else if (statusResult.includes("Your branch is behind")) {
          status = "behind";
        } else if (statusResult.includes("Your branch is ahead")) {
          status = "ahead";
        } else if (statusResult.includes("Changes not staged")) {
          status = "modified";
        }
      }

      return {
        lastPullDate: logResult ? new Date(logResult.trim()) : null,
        status: status,
      };
    } catch (error) {
      console.error("Error obteniendo estado del repositorio:", error);
      return {
        lastPullDate: null,
        status: "unknown",
      };
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "up-to-date":
        return {
          text: "Al día",
          icon: <CheckCircle size={12} />,
          className: "status-badge-up-to-date",
        };
      case "behind":
        return {
          text: "Cambios pendientes",
          icon: <Download size={12} />,
          className: "status-badge-behind",
        };
      case "ahead":
        return {
          text: "Adelantado",
          icon: <AlertCircle size={12} />,
          className: "status-badge-ahead",
        };
      case "modified":
        return {
          text: "Modificado",
          icon: <AlertCircle size={12} />,
          className: "status-badge-modified",
        };
      default:
        return {
          text: "Desconocido",
          icon: <Clock size={12} />,
          className: "status-badge-unknown",
        };
    }
  };

  const filteredLocalRepos = localRepos.filter((repo) =>
    repo.name.toLowerCase().includes(localSearch.toLowerCase()) ||
    (repo.description && repo.description.toLowerCase().includes(localSearch.toLowerCase()))
  );

  const filteredGithubRepos = githubRepos.filter((repo) =>
    repo.name.toLowerCase().includes(githubSearch.toLowerCase()) ||
    (repo.description && repo.description.toLowerCase().includes(githubSearch.toLowerCase()))
  );

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
        const repos = await Promise.all(
          files
            .filter((f: any) => f.isGitRepo)
            .map(async (repo: any) => {
              const status = await getRepoStatus(repo.path);
              return { ...repo, status };
            })
        );
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
      const repos = await Promise.all(
        files
          .filter((f: any) => f.isGitRepo)
          .map(async (repoItem: any) => {
            const status = await getRepoStatus(repoItem.path);
            return { ...repoItem, status };
          })
      );
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

      // Actualizar estado del repositorio
      const updatedRepos = localRepos.map(repo => {
        if (repo.path === repoPath) {
          return {
            ...repo,
            status: {
              ...repo.status,
              status: "up-to-date",
              lastPullDate: new Date(),
            }
          };
        }
        return repo;
      });
      setLocalRepos(updatedRepos);
    } catch (error: any) {
      await DesktopManager.getInstance().showMessage(
        error,
        "Error en Git Pull",
        "error",
      );
    }
  };

  const handleLogout = async () => {
    try {
      const desktop = DesktopManager.getInstance();
      
      // Eliminar información del usuario
      try {
        await desktop.setConfig("github_token", null);
        await desktop.setConfig("github_user", null);
      } catch (error) {
        console.error("Error eliminando configuración:", error);
      }
      
      // Redirigir al login
      navigate("/");
    } catch (error) {
      console.error("Error cerrando sesión:", error);
    }
  };

  const ProfilePopup = () => {
    if (!user) return null;

    return (
      <div className="profile-popup-overlay" onClick={() => setShowProfilePopup(false)}>
        <div className="profile-popup" onClick={(e) => e.stopPropagation()}>
          <div className="profile-popup-header">
            {user?.avatar_url && (
              <img
                src={user.avatar_url}
                alt={user.login}
                className="profile-popup-avatar"
              />
            )}
            <div className="profile-popup-info">
              <h3 className="profile-popup-name">{user?.name || user?.login}</h3>
              <p className="profile-popup-username">@{user?.login}</p>
              <div className="profile-popup-role">
                <Shield size={14} />
                <span>Desarrollador</span>
              </div>
            </div>
          </div>
          
          <div className="profile-popup-actions">
            <button
              onClick={handleLogout}
              className="profile-popup-logout"
            >
              <LogOut size={16} />
              Cerrar Sesión
            </button>
          </div>
          
          <button
            className="profile-popup-close"
            onClick={() => setShowProfilePopup(false)}
          >
            ×
          </button>
        </div>
      </div>
    );
  };

  return (
    <div className="dashboard">
      {/* Header */}
      <div className="dashboard-header">
        <div 
          className="user-info" 
          onClick={() => setShowProfilePopup(true)} 
          style={{ cursor: 'pointer' }}
        >
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
            <div className="card-header">
            <h3 className="card-title">
              <Monitor size={18} />
              Repositorios Locales
              {selectedFolder && (
                <span className="badge badge-blue">{localRepos.length}</span>
              )}
            </h3>
          </div>
            {selectedFolder ? (
              <>
                <div className="folder-path">
                  <MapPin size={14} /> {selectedFolder}
                </div>
                
                <div className="search-container">
                  <Search size={16} className="search-icon" />
                  <input
                    type="text"
                    placeholder="Buscar repositorio local..."
                    className="search-input"
                    value={localSearch}
                    onChange={(e) => setLocalSearch(e.target.value)}
                  />
                </div>

                {filteredLocalRepos.length > 0 ? (
                  <div className="repos-list">
                    {filteredLocalRepos.map((repo, index) => {
                      const statusBadge = getStatusBadge(repo.status?.status);
                      return (
                        <div
                          key={index}
                          className="repo-card repo-card-local"
                          onClick={() => navigateToProject(repo.path, repo.name)}
                          style={{ cursor: 'pointer' }}
                        >
                          <div className="repo-card-content">
                            <div className="repo-info">
                              {/* Título */}
                              <div className="repo-name">{repo.name}</div>
                              
                              {/* Descripción */}
                              {repo.description && (
                                <p className="repo-description">{repo.description}</p>
                              )}
                              
                              {/* Fecha del último pull y estado */}
                              <div className="repo-stats">
                                <span className="repo-date">
                                  <Calendar size={12} />
                                  Último pull: {new Date(repo.status.lastPullDate).toLocaleDateString()}
                                </span>
                                
                                <div className={`status-badge ${statusBadge.className}`}>
                                  {statusBadge.icon}
                                  <span>{statusBadge.text}</span>
                                </div>
                              </div>
                            </div>

                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                gitPull(repo.path, repo.name);
                              }}
                              className="btn-pull"
                              disabled={repo.status?.status === "up-to-date"}
                            >
                              <Download size={14} /> Pull
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <div className="empty-repos">
                    {localSearch ? (
                      <p>No se encontraron repositorios con "{localSearch}"</p>
                    ) : (
                      <p>No se encontraron repositorios Git en esta carpeta</p>
                    )}
                  </div>
                )}
              </>
            ) : (
              <div className="empty-state">
                <div className="empty-icon">
                  <Folder size={48} />
                </div>
                <p>Selecciona una carpeta para ver tus repositorios locales</p>
              </div>
            )}
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

            <div className="search-container">
              <Search size={16} className="search-icon" />
              <input
                type="text"
                placeholder="Buscar repositorio de GitHub..."
                className="search-input"
                value={githubSearch}
                onChange={(e) => setGithubSearch(e.target.value)}
              />
            </div>

            {loading.github ? (
              <div className="loading-state">
                <div className="spinner-large" />
                <p>Cargando repositorios de GitHub...</p>
              </div>
            ) : (
              <div className="repos-list">
                {filteredGithubRepos.map((repo) => (
                  <div key={repo.id} className="repo-card repo-card-github">
                    <div className="repo-card-content">
                      <div className="repo-info">
                        {/* Título */}
                        <div className="repo-name">{repo.name}</div>

                        {/* Descripción */}
                        {repo.description && (
                          <p className="repo-description">{repo.description}</p>
                        )}

                        {/* Fecha de último cambio del repo */}
                        <div className="repo-stats">
                          <span className="repo-date">
                            <Calendar size={12} />{" "}
                            Actualizado: {new Date(repo.updated_at).toLocaleDateString()}
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
            
            {!loading.github && filteredGithubRepos.length === 0 && (
              <div className="empty-repos">
                {githubSearch ? (
                  <p>No se encontraron repositorios con "{githubSearch}"</p>
                ) : (
                  <p>No hay repositorios de GitHub disponibles</p>
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      {showProfilePopup && <ProfilePopup />}
    </div>
  );
};

export default Dashboard;
