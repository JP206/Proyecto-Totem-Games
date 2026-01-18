// src/renderer/src/pages/Dashboard.tsx
import React, { useState, useEffect } from 'react';
import DesktopManager from '../utils/desktop';

const Dashboard: React.FC = () => {
  const [githubRepos, setGithubRepos] = useState<any[]>([]);
  const [localRepos, setLocalRepos] = useState<any[]>([]);
  const [selectedFolder, setSelectedFolder] = useState<string>('');
  const [loading, setLoading] = useState({
    github: true,
    local: false
  });
  const [user, setUser] = useState<any>(null);

  useEffect(() => {
    loadUserData();
    fetchGithubRepos();
  }, []);

  const loadUserData = async () => {
    try {
      const desktop = DesktopManager.getInstance();
      const userData = await desktop.getConfig('github_user');
      setUser(userData);
    } catch (error) {
      console.error('Error cargando usuario:', error);
    }
  };

  const fetchGithubRepos = async () => {
    setLoading(prev => ({ ...prev, github: true }));
    
    try {
      const desktop = DesktopManager.getInstance();
      const token = await desktop.getConfig('github_token');
      
      if (!token) {
        await desktop.showMessage('No estás autenticado', 'Error', 'error');
        return;
      }

      const response = await fetch('https://api.github.com/user/repos', {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Accept': 'application/vnd.github.v3+json'
        }
      });

      if (response.ok) {
        const repos = await response.json();
        setGithubRepos(repos);
      } else {
        await desktop.showMessage('Error al cargar repositorios', 'GitHub Error', 'error');
      }
    } catch (error) {
      console.error('Error:', error);
    } finally {
      setLoading(prev => ({ ...prev, github: false }));
    }
  };

  const selectLocalFolder = async () => {
    setLoading(prev => ({ ...prev, local: true }));
    
    try {
      const desktop = DesktopManager.getInstance();
      const folder = await desktop.selectFolder();
      
      if (folder) {
        setSelectedFolder(folder);
        const files = await desktop.readFolder(folder);
        const repos = files.filter((f: any) => f.isGitRepo);
        setLocalRepos(repos);
      }
    } catch (error: any) {
      await DesktopManager.getInstance().showMessage(error.message, 'Error', 'error');
    } finally {
      setLoading(prev => ({ ...prev, local: false }));
    }
  };

  const cloneRepository = async (repo: any) => {
    if (!selectedFolder) {
      await DesktopManager.getInstance().showMessage(
        'Primero selecciona una carpeta local',
        'Selecciona carpeta',
        'warning'
      );
      return;
    }

    try {
      const desktop = DesktopManager.getInstance();
      const token = await desktop.getConfig('github_token');
      
      if (!token) {
        await desktop.showMessage('No estás autenticado', 'Error', 'error');
        return;
      }

      const destination = `${selectedFolder}/${repo.name}`;
      
      await desktop.cloneRepository({
        url: repo.clone_url,
        destination,
        token
      });
      
      await desktop.showMessage(
        `Repositorio "${repo.name}" clonado exitosamente en:\n${destination}`,
        'Clonado exitoso'
      );
      
      // Actualizar lista local
      const files = await desktop.readFolder(selectedFolder);
      const repos = files.filter((f: any) => f.isGitRepo);
      setLocalRepos(repos);
      
    } catch (error: any) {
      await DesktopManager.getInstance().showMessage(error, 'Error al clonar', 'error');
    }
  };

  const gitPull = async (repoPath: string, repoName: string) => {
    try {
        const desktop = DesktopManager.getInstance(); // ✅ Añadir esta línea
        const output = await desktop.gitCommand({
        command: 'pull',
        cwd: repoPath
        });
        
        await desktop.showMessage(
        `Repositorio "${repoName}" actualizado:\n${output}`,
        'Git Pull exitoso'
        );
    } catch (error: any) {
        const desktop = DesktopManager.getInstance(); // ✅ Y también aquí
        await desktop.showMessage(error, 'Error en Git Pull', 'error');
    }
  };

  return (
    <div>
      {/* Header con info del usuario */}
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: '30px',
        backgroundColor: '#24292e',
        padding: '20px',
        borderRadius: '8px',
        border: '1px solid #444'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '15px' }}>
          {user?.avatar_url && (
            <img 
              src={user.avatar_url} 
              alt={user.login}
              style={{
                width: '50px',
                height: '50px',
                borderRadius: '50%',
                border: '2px solid #2ea44f'
              }}
            />
          )}
          <div>
            <h3 style={{ margin: '0 0 5px 0' }}>{user?.name || user?.login}</h3>
            <p style={{ margin: 0, color: '#8b949e', fontSize: '14px' }}>
              @{user?.login} • {githubRepos.length} repositorios
            </p>
          </div>
        </div>
        
        <button
          onClick={() => selectLocalFolder()}
          style={{
            padding: '10px 20px',
            backgroundColor: '#238636',
            color: 'white',
            border: 'none',
            borderRadius: '6px',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            fontSize: '14px'
          }}
          disabled={loading.local}
        >
          {loading.local ? (
            <>
              <div style={{
                width: '14px',
                height: '14px',
                border: '2px solid rgba(255,255,255,0.3)',
                borderTopColor: 'white',
                borderRadius: '50%',
                animation: 'spin 1s linear infinite'
              }} />
              Cargando...
            </>
          ) : (
            <>
              📁 {selectedFolder ? 'Cambiar Carpeta' : 'Seleccionar Carpeta'}
            </>
          )}
        </button>
      </div>

      {/* Dos columnas: Local y GitHub */}
      <div style={{ display: 'flex', gap: '20px' }}>
        {/* Columna 1: Repositorios Locales */}
        <div style={{ flex: 1 }}>
          <div style={{
            backgroundColor: '#24292e',
            padding: '20px',
            borderRadius: '8px',
            border: '1px solid #444',
            height: '100%'
          }}>
            <h3 style={{ marginTop: 0, display: 'flex', alignItems: 'center', gap: '10px' }}>
              💻 Repositorios Locales
              {selectedFolder && (
                <span style={{
                  fontSize: '12px',
                  backgroundColor: '#388bfd',
                  padding: '2px 8px',
                  borderRadius: '10px'
                }}>
                  {localRepos.length}
                </span>
              )}
            </h3>
            
            {selectedFolder ? (
              <div style={{ marginBottom: '15px', fontSize: '13px', color: '#8b949e', wordBreak: 'break-all' }}>
                📍 {selectedFolder}
              </div>
            ) : (
              <div style={{
                textAlign: 'center',
                padding: '40px 20px',
                color: '#8b949e',
                fontSize: '14px'
              }}>
                <div style={{ fontSize: '48px', marginBottom: '15px' }}>📁</div>
                <p>Selecciona una carpeta para ver tus repositorios locales</p>
              </div>
            )}

            {localRepos.length > 0 && (
              <div style={{ display: 'grid', gap: '10px' }}>
                {localRepos.map((repo, index) => (
                  <div
                    key={index}
                    style={{
                      backgroundColor: '#0d1117',
                      padding: '15px',
                      borderRadius: '6px',
                      border: '1px solid #30363d'
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <div>
                        <div style={{ fontWeight: '600', fontSize: '14px' }}>{repo.name}</div>
                        <div style={{ fontSize: '12px', color: '#8b949e', marginTop: '5px' }}>
                          {repo.path}
                        </div>
                      </div>
                      
                      <button
                        onClick={() => gitPull(repo.path, repo.name)}
                        style={{
                          padding: '6px 12px',
                          backgroundColor: '#388bfd',
                          color: 'white',
                          border: 'none',
                          borderRadius: '4px',
                          cursor: 'pointer',
                          fontSize: '12px',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '5px'
                        }}
                      >
                        ⬇️ Pull
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Columna 2: Repositorios GitHub */}
        <div style={{ flex: 2 }}>
          <div style={{
            backgroundColor: '#24292e',
            padding: '20px',
            borderRadius: '8px',
            border: '1px solid #444'
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
              <h3 style={{ margin: 0, display: 'flex', alignItems: 'center', gap: '10px' }}>
                🌐 Repositorios de GitHub
                <span style={{
                  fontSize: '12px',
                  backgroundColor: '#2ea44f',
                  padding: '2px 8px',
                  borderRadius: '10px'
                }}>
                  {githubRepos.length}
                </span>
              </h3>
              
              <button
                onClick={fetchGithubRepos}
                disabled={loading.github}
                style={{
                  padding: '8px 16px',
                  backgroundColor: '#238636',
                  color: 'white',
                  border: 'none',
                  borderRadius: '6px',
                  cursor: 'pointer',
                  fontSize: '14px',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px'
                }}
              >
                🔄 Actualizar
              </button>
            </div>

            {loading.github ? (
              <div style={{ textAlign: 'center', padding: '40px' }}>
                <div style={{
                  width: '40px',
                  height: '40px',
                  border: '3px solid rgba(56, 139, 253, 0.3)',
                  borderTopColor: '#388bfd',
                  borderRadius: '50%',
                  margin: '0 auto 15px',
                  animation: 'spin 1s linear infinite'
                }} />
                <p style={{ color: '#8b949e' }}>Cargando repositorios de GitHub...</p>
              </div>
            ) : (
              <div style={{ display: 'grid', gap: '15px' }}>
                {githubRepos.map((repo) => (
                  <div
                    key={repo.id}
                    style={{
                      backgroundColor: '#0d1117',
                      padding: '20px',
                      borderRadius: '8px',
                      border: '1px solid #30363d',
                      transition: 'all 0.2s'
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                      <div style={{ flex: 1 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '10px' }}>
                          <h4 style={{ margin: 0, fontSize: '16px' }}>
                            {repo.name}
                            {repo.private && <span style={{ marginLeft: '8px', fontSize: '12px', color: '#f85149' }}>🔒 Privado</span>}
                          </h4>
                          <span style={{
                            fontSize: '11px',
                            backgroundColor: '#6e7681',
                            padding: '2px 6px',
                            borderRadius: '10px'
                          }}>
                            {repo.language || 'Code'}
                          </span>
                        </div>
                        
                        {repo.description && (
                          <p style={{ color: '#8b949e', fontSize: '14px', marginBottom: '15px' }}>
                            {repo.description}
                          </p>
                        )}
                        
                        <div style={{ display: 'flex', gap: '15px', fontSize: '13px', color: '#8b949e' }}>
                          <span>⭐ {repo.stargazers_count}</span>
                          <span>🍴 {repo.forks_count}</span>
                          <span>📅 {new Date(repo.updated_at).toLocaleDateString()}</span>
                        </div>
                      </div>
                      
                      <button
                        onClick={() => cloneRepository(repo)}
                        disabled={!selectedFolder}
                        style={{
                          padding: '8px 16px',
                          backgroundColor: selectedFolder ? '#2ea44f' : '#6e7681',
                          color: 'white',
                          border: 'none',
                          borderRadius: '6px',
                          cursor: selectedFolder ? 'pointer' : 'not-allowed',
                          fontSize: '14px',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '8px',
                          whiteSpace: 'nowrap'
                        }}
                      >
                        📥 Clonar Local
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