// src/renderer/src/pages/Dashboard.tsx
import React, { useState, useEffect } from "react";
import DesktopManager from "../utils/desktop";
import "../styles/dashboard.css";
import { useNavigate } from "react-router-dom";
import {
  Folder, Monitor, MapPin, Download, RefreshCw, Calendar,
  DownloadCloud, Github, CheckCircle, AlertCircle, Clock,
  Search, LogOut, Shield, Trash2, AlertTriangle, RefreshCwOff
} from "lucide-react";

const Dashboard: React.FC = () => {
  const [githubRepos, setGithubRepos] = useState<any[]>([]);
  const [localRepos, setLocalRepos] = useState<any[]>([]);
  const [selectedFolder, setSelectedFolder] = useState("");
  const [loading, setLoading] = useState({ github: false, local: false, deleting: false });
  const [loadingLocal, setLoadingLocal] = useState(false);
  const [globalLoading, setGlobalLoading] = useState(false);
  const [user, setUser] = useState<any>(null);
  const [showProfile, setShowProfile] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [showPullModal, setShowPullModal] = useState(false);
  const [repoToPull, setRepoToPull] = useState<{ path: string; name: string } | null>(null);
  const [repoToDelete, setRepoToDelete] = useState<{ path: string; name: string } | null>(null);
  const [search, setSearch] = useState({ local: "", github: "" });
  const navigate = useNavigate();

  useEffect(() => {
    loadUser();
    fetchGithub();
    loadFolder();
  }, []);

  const loadUser = async () => {
    setUser(await DesktopManager.getInstance().getConfig("github_user"));
  };

  const loadFolder = async () => {
    const saved = await DesktopManager.getInstance().getConfig("selected_folder");
    if (saved) {
      setSelectedFolder(saved);
      loadLocalRepos(saved);
    }
  };

  const loadLocalRepos = async (folder: string) => {
    setLoadingLocal(true);
    try {
      const desktop = DesktopManager.getInstance();
      const files = await desktop.readFolder(folder);
      const repos = await Promise.all(
        files.filter((f: any) => f.isGitRepo).map(async (repo: any) => {
          await desktop.gitCommand({ command: "git fetch origin", cwd: repo.path }).catch(() => null);
          const log = await desktop.gitCommand({ command: "git log -1 --format=%cd --date=iso", cwd: repo.path }).catch(() => null);
          const branchStatus = await desktop.gitCommand({ command: "git status -b --porcelain", cwd: repo.path }).catch(() => null);
          const localChanges = await desktop.gitCommand({ command: "git status --porcelain", cwd: repo.path }).catch(() => "");
          
          let state = "unknown";
          if (localChanges && localChanges.trim().length > 0) {
            state = "modified";
          } else if (branchStatus) {
            if (branchStatus.includes("behind")) state = "behind";
            else if (branchStatus.includes("ahead")) state = "ahead";
            else state = "up-to-date";
          }
          
          return { ...repo, status: { lastPull: log ? new Date(log.trim()) : null, status: state } };
        })
      );
      setLocalRepos(repos);
    } finally {
      setLoadingLocal(false);
    }
  };

  const fetchGithub = async () => {
    // setLoading(d => ({ ...d, github: true }));
    // const token = await DesktopManager.getInstance().getConfig("github_token");
    // if (token) {
    //   const res = await fetch("https://api.github.com/user/repos", {
    //     headers: { Authorization: `Bearer ${token}`, Accept: "application/vnd.github.v3+json" }
    //   });
    //   if (res.ok) setGithubRepos(await res.json());
    // }
    // setLoading(d => ({ ...d, github: false }));
    setLoading(d => ({ ...d, github: true }));
    const desktop = DesktopManager.getInstance();
    const token = await desktop.getConfig("github_token");
    if (token) {
      const res = await desktop.getOrgRepos("Proyecto-Final-de-Grado", token);
      if (res) setGithubRepos(res);
    }
    setLoading(d => ({ ...d, github: false }));
  };

  const refreshAll = async () => {
    setGlobalLoading(true);
    const token = await DesktopManager.getInstance().getConfig("github_token");
    if (token) {
      try {
        const res = await fetch("https://api.github.com/user/repos", {
          headers: { Authorization: `Bearer ${token}`, Accept: "application/vnd.github.v3+json" }
        });
        if (res.ok) setGithubRepos(await res.json());
      } catch (error) {
        console.error("Error actualizando GitHub:", error);
      }
    }
    if (selectedFolder) await loadLocalRepos(selectedFolder);
    setGlobalLoading(false);
  };

  const selectFolder = async () => {
    setLoading(d => ({ ...d, local: true }));
    const folder = await DesktopManager.getInstance().selectFolder();
    if (folder) {
      await DesktopManager.getInstance().setConfig("selected_folder", folder);
      setSelectedFolder(folder);
      await loadLocalRepos(folder);
    }
    setLoading(d => ({ ...d, local: false }));
  };

  const cloneRepo = async (repo: any) => {
    if (!selectedFolder || isRepoCloned(repo.name)) return;
    const token = await DesktopManager.getInstance().getConfig("github_token");
    await DesktopManager.getInstance().cloneRepository({
      url: repo.clone_url, destination: `${selectedFolder}/${repo.name}`, token
    });
    await loadLocalRepos(selectedFolder);
  };

  const confirmPull = async () => {
    if (!repoToPull) return;
    setShowPullModal(false);
    setGlobalLoading(true);
    
    try {
      const token = await DesktopManager.getInstance().getConfig("github_token");
      const githubRepo = githubRepos.find(r => r.name === repoToPull.name);
      
      if (!githubRepo || !token) return;

      const lastSeparator = Math.max(repoToPull.path.lastIndexOf("\\"), repoToPull.path.lastIndexOf("/"));
      const parentFolder = repoToPull.path.substring(0, lastSeparator);
      const destination = `${parentFolder}\\${repoToPull.name}`;
      
      await DesktopManager.getInstance().deleteFolder(repoToPull.path);
      await new Promise(resolve => setTimeout(resolve, 500));
      
      await DesktopManager.getInstance().cloneRepository({
        url: githubRepo.clone_url,
        destination: destination,
        token,
      });
      
      await new Promise(resolve => setTimeout(resolve, 500));
      
      if (selectedFolder) {
        await loadLocalRepos(selectedFolder);
      }
    } catch (error) {
      console.error("Error en pull:", error);
      if (selectedFolder) {
        await loadLocalRepos(selectedFolder);
      }
    } finally {
      setGlobalLoading(false);
      setRepoToPull(null);
    }
  };

  const confirmDelete = async () => {
    if (!repoToDelete) return;
    setShowDeleteModal(false);
    setLoading(d => ({ ...d, deleting: true }));
    await DesktopManager.getInstance().deleteFolder(repoToDelete.path);
    if (selectedFolder) await loadLocalRepos(selectedFolder);
    setLoading(d => ({ ...d, deleting: false }));
    setRepoToDelete(null);
  };

  const handleLogout = async () => {
    const d = DesktopManager.getInstance();
    await d.setConfig("github_token", null);
    await d.setConfig("github_user", null);
    navigate("/");
  };

  const navigateToProject = async (path: string, name: string) => {
    const githubRepo = githubRepos.find(r => r.name === name);
    await DesktopManager.getInstance().setConfig("current_project", {
      repoPath: path, repoName: name, repoOwner: githubRepo?.owner?.login || ""
    });
    navigate("/landing");
  };

  const isRepoCloned = (repoName: string) => localRepos.some(r => r.name === repoName);

  const statusBadge = (status: string) => {
    const map: any = {
      "up-to-date": { text: "Al día", icon: <CheckCircle size={12} />, class: "status-badge-up-to-date" },
      "behind": { text: "Pendientes", icon: <Download size={12} />, class: "status-badge-behind" },
      "ahead": { text: "Adelantado", icon: <AlertCircle size={12} />, class: "status-badge-ahead" },
      "modified": { text: "Modificado", icon: <AlertCircle size={12} />, class: "status-badge-modified" },
      "unknown": { text: "Desconocido", icon: <Clock size={12} />, class: "status-badge-unknown" }
    };
    return map[status] || map.unknown;
  };

  const filteredLocal = localRepos.filter(r => r.name.toLowerCase().includes(search.local.toLowerCase()));
  const filteredGithub = githubRepos.filter(r => r.name.toLowerCase().includes(search.github.toLowerCase()));

  const Modal = ({ show, onClose, children, className = "" }: any) => show ? (
    <div className="modal-overlay" onClick={onClose}>
      <div className={`modal ${className}`} onClick={e => e.stopPropagation()}>
        <button className="modal-close" onClick={onClose}>×</button>
        {children}
      </div>
    </div>
  ) : null;

  const GlobalLoadingOverlay = () => (
    <div className="global-loading-overlay">
      <div className="global-loading-content">
        <div className="spinner-large" />
        <p>Actualizando repositorios...</p>
      </div>
    </div>
  );

  return (
    <div className="dashboard">
      {globalLoading && <GlobalLoadingOverlay />}

      <div className="dashboard-header">
        <div className="user-info" onClick={() => setShowProfile(true)}>
          {user?.avatar_url && <img src={user.avatar_url} alt={user.login} className="user-avatar" />}
          <div>
            <h3>{user?.name || user?.login}</h3>
            <p>@{user?.login} • {githubRepos.length} repos</p>
          </div>
        </div>

        <div className="header-actions">
          <button onClick={refreshAll} disabled={globalLoading} className="btn-refresh-all">
            {globalLoading ? <><div className="spinner-small" />Actualizando...</> : <><RefreshCw size={16} />Actualizar Todo</>}
          </button>
          <button onClick={selectFolder} disabled={loading.local} className="btn-folder">
            {loading.local ? <><div className="spinner-small" />Cargando...</> : <><Folder size={16} />{selectedFolder ? "Cambiar" : "Seleccionar"} Carpeta</>}
          </button>
        </div>
      </div>

      <div className="dashboard-columns">
        <div className="column column-local">
          <div className="card">
            <h3><Monitor size={18} /> Locales {selectedFolder && <span className="badge blue">{localRepos.length}</span>}</h3>
            {selectedFolder ? (
              <>
                <div className="folder-path" title={selectedFolder}>
                  <MapPin size={14} className="folder-icon" />
                  <span className="folder-text">{selectedFolder}</span>
                </div>

                <div className="search-box">
                  <Search size={16} className="search-icon" />
                  <input placeholder="Buscar..." value={search.local} onChange={e => setSearch(s => ({ ...s, local: e.target.value }))} />
                </div>

                {loadingLocal ? (
                  <div className="loading"><div className="spinner-large" /><p>Cargando...</p></div>
                ) : filteredLocal.length ? (
                  <div className="repo-list">
                    {filteredLocal.map((r, i) => {
                      const badge = statusBadge(r.status?.status);
                      return (
                        <div key={i} className="repo-card-local" onClick={() => navigateToProject(r.path, r.name)}>
                          <div className="repo-info">
                            <div className="repo-name">{r.name}</div>
                            {r.description && <p className="repo-desc">{r.description}</p>}
                            <div className="repo-meta">
                              <span className="repo-date"><Calendar size={12} /> {r.status?.lastPull?.toLocaleDateString() || "?"}</span>
                              <span className={`status-badge ${badge.class}`}>{badge.icon} {badge.text}</span>
                            </div>
                          </div>
                          <div className="repo-actions">
                            <button onClick={e => { e.stopPropagation(); setRepoToPull({ path: r.path, name: r.name }); setShowPullModal(true); }} 
                              className="btn-icon btn-pull" 
                              disabled={r.status?.status === "up-to-date" || globalLoading}
                              title={r.status?.status === "up-to-date" ? "Repositorio al día" : "Sincronizar con remoto"}>
                              <Download size={14} />
                            </button>
                            <button onClick={e => { e.stopPropagation(); setRepoToDelete({ path: r.path, name: r.name }); setShowDeleteModal(true); }} 
                              className="btn-icon btn-delete" disabled={loading.deleting || globalLoading}
                              title="Eliminar repositorio localmente">
                              <Trash2 size={14} />
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <div className="empty"><p>{search.local ? "No hay resultados" : "No hay repositorios"}</p></div>
                )}
              </>
            ) : (
              <div className="empty"><Folder size={48} /><p>Selecciona una carpeta</p></div>
            )}
          </div>
        </div>

        <div className="column column-github">
          <div className="card">
            <h3><Github size={18} /> GitHub <span className="badge green">{githubRepos.length}</span></h3>
            <div className="search-box">
              <Search size={16} className="search-icon" />
              <input placeholder="Buscar..." value={search.github} onChange={e => setSearch(s => ({ ...s, github: e.target.value }))} />
            </div>

            {loading.github ? (
              <div className="loading"><div className="spinner-large" /><p>Cargando...</p></div>
            ) : (
              <div className="repo-list">
                {filteredGithub.map(r => {
                  const cloned = isRepoCloned(r.name);
                  return (
                    <div key={r.id} className="repo-card-github">
                      <div className="repo-info">
                        <div className="repo-name">{r.name}</div>
                        {r.description && <p className="repo-desc">{r.description}</p>}
                        <span className="repo-date"><Calendar size={12} /> {new Date(r.updated_at).toLocaleDateString()}</span>
                      </div>
                      <button 
                        onClick={() => cloneRepo(r)} 
                        disabled={!selectedFolder || cloned || globalLoading}
                        className={`btn-icon btn-clone ${!selectedFolder ? "disabled" : ""} ${cloned ? "cloned" : ""}`}
                        title={!selectedFolder ? "Selecciona una carpeta primero" : cloned ? "Repositorio ya clonado" : "Clonar repositorio"}
                      >
                        <DownloadCloud size={14} />
                      </button>
                    </div>
                  );
                })}
              </div>
            )}
            {!loading.github && !filteredGithub.length && (
              <div className="empty"><p>{search.github ? "No hay resultados" : "No hay repositorios"}</p></div>
            )}
          </div>
        </div>
      </div>

      <Modal show={showProfile} onClose={() => setShowProfile(false)} className="profile-modal">
        <div className="profile-header">
          {user?.avatar_url && <img src={user.avatar_url} alt={user.login} className="profile-avatar" />}
          <div>
            <h4>{user?.name || user?.login}</h4>
            <p>@{user?.login}</p>
            <span className="profile-role"><Shield size={14} /> Desarrollador</span>
          </div>
        </div>
        <div className="profile-popup-actions">
          <button onClick={() => { setShowProfile(false); navigate("/profile", { state: { from: "/dashboard" } }); }} className="profile-popup-logout profile-popup-secondary">Ver perfil completo</button>
          <button onClick={handleLogout} className="profile-popup-logout"><LogOut size={16} /> Cerrar Sesión</button>
        </div>
      </Modal>

      <Modal show={showPullModal} onClose={() => setShowPullModal(false)} className="pull-modal">
        <div className="pull-header">
          <div className="pull-icon"><RefreshCwOff size={32} /></div>
          <div>
            <h4>¿Sincronizar con el repositorio remoto?</h4>
          </div>
        </div>
        <div className="pull-content">
          <p><strong>• Si tienes cambios locales (Modificado):</strong> Se ELIMINARÁN todos tus cambios y el repositorio quedará exactamente igual al remoto.</p>
          <p><strong>• Si el remoto tiene cambios (Pendientes):</strong> Se DESCARGARÁN los cambios remotos y el repositorio quedará actualizado.</p>
          <p className="pull-warning">Los cambios no guardados se perderán permanentemente.</p>
          <p className="repo-name-pull"><strong>"{repoToPull?.name}"</strong></p>
        </div>
        <div className="pull-actions">
          <button onClick={confirmPull} className="btn-pull-confirm"><Download size={16} />Sincronizar</button>
          <button onClick={() => setShowPullModal(false)} className="btn-cancel">Cancelar</button>
        </div>
      </Modal>

      <Modal show={showDeleteModal} onClose={() => setShowDeleteModal(false)} className="delete-modal">
        <div className="delete-header">
          <div className="delete-icon"><AlertTriangle size={32} /></div>
          <div>
            <h4>Confirmar eliminación</h4>
          </div>
        </div>
        <div className="delete-content">
          <p>¿Eliminar el repositorio localmente?</p>
          <p className="repo-name-delete"><strong>"{repoToDelete?.name}"</strong></p>
        </div>
        <div className="delete-actions">
          <button onClick={confirmDelete} className="btn-delete-confirm"><Trash2 size={16} />Eliminar</button>
          <button onClick={() => setShowDeleteModal(false)} className="btn-cancel">Cancelar</button>
        </div>
      </Modal>
    </div>
  );
};

export default Dashboard;