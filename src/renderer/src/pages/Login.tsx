// src/renderer/src/pages/Login.tsx
import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import DesktopManager from '../utils/desktop';

const Login: React.FC = () => {
  const [token, setToken] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const navigate = useNavigate();

  useEffect(() => {
    // Verificar si ya hay token guardado
    const checkSavedToken = async () => {
      try {
        const desktop = DesktopManager.getInstance();
        const savedToken = await desktop.getConfig('github_token');
        if (savedToken) {
          setToken(savedToken);
        }
      } catch (error) {
        console.log('No hay token guardado');
      }
    };
    
    checkSavedToken();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!token.trim()) {
      setError('Por favor ingresa tu token de GitHub');
      return;
    }

    setLoading(true);
    setError('');

    try {
      // Verificar token con GitHub API
      const response = await fetch('https://api.github.com/user', {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Accept': 'application/vnd.github.v3+json'
        }
      });

      if (response.ok) {
        const userData = await response.json();
        
        // Guardar en configuración
        const desktop = DesktopManager.getInstance();
        await desktop.setConfig('github_token', token);
        await desktop.setConfig('github_user', userData);
        
        // Mostrar mensaje de éxito
        await desktop.showMessage(
          `¡Bienvenido ${userData.login}!`,
          'Autenticación exitosa'
        );
        
        // Navegar a la página principal
        navigate('/dashboard');
        
      } else if (response.status === 401) {
        setError('Token inválido o expirado');
      } else {
        setError(`Error ${response.status}: No se pudo autenticar`);
      }
    } catch (err) {
      setError('Error de conexión. Verifica tu internet.');
    } finally {
      setLoading(false);
    }
  };

  const openTokenPage = async () => {
    const desktop = DesktopManager.getInstance();
    await desktop.openInBrowser('https://github.com/settings/tokens');
  };

  return (
    <div style={{
      maxWidth: '500px',
      margin: '0 auto',
      padding: '40px 20px'
    }}>
      <div style={{
        backgroundColor: '#24292e',
        padding: '40px',
        borderRadius: '12px',
        border: '1px solid #444'
      }}>
        <div style={{ textAlign: 'center', marginBottom: '30px' }}>
          <div style={{ fontSize: '48px', marginBottom: '15px' }}>🔐</div>
          <h2 style={{ margin: '0 0 10px 0' }}>Iniciar Sesión en GitHub</h2>
          <p style={{ color: '#8b949e', fontSize: '14px' }}>
            Usa tu token personal para acceder a tus repositorios
          </p>
        </div>

        <form onSubmit={handleSubmit}>
          <div style={{ marginBottom: '20px' }}>
            <label style={{
              display: 'block',
              marginBottom: '8px',
              fontWeight: '600',
              fontSize: '14px'
            }}>
              Token de Acceso Personal
            </label>
            
            <input
              type="password"
              value={token}
              onChange={(e) => setToken(e.target.value)}
              placeholder="ghp_xxxxxxxxxxxxxxxxxxxx"
              style={{
                width: '100%',
                padding: '12px 15px',
                backgroundColor: '#0d1117',
                border: '1px solid #30363d',
                borderRadius: '6px',
                color: 'white',
                fontSize: '14px',
                boxSizing: 'border-box'
              }}
              disabled={loading}
            />
            
            <button
              type="button"
              onClick={openTokenPage}
              style={{
                marginTop: '8px',
                padding: '8px 12px',
                backgroundColor: 'transparent',
                border: '1px solid #30363d',
                borderRadius: '6px',
                color: '#58a6ff',
                fontSize: '12px',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '5px'
              }}
              disabled={loading}
            >
              <span>🔗</span>
              Generar nuevo token en GitHub
            </button>
          </div>

          {error && (
            <div style={{
              backgroundColor: 'rgba(248, 81, 73, 0.1)',
              border: '1px solid #f85149',
              color: '#f85149',
              padding: '12px',
              borderRadius: '6px',
              marginBottom: '20px',
              fontSize: '14px',
              display: 'flex',
              alignItems: 'center',
              gap: '10px'
            }}>
              <span>⚠️</span>
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={loading || !token.trim()}
            style={{
              width: '100%',
              padding: '14px',
              backgroundColor: loading || !token.trim() ? '#238636' : '#2ea44f',
              color: 'white',
              border: 'none',
              borderRadius: '6px',
              fontSize: '16px',
              fontWeight: '600',
              cursor: loading || !token.trim() ? 'not-allowed' : 'pointer',
              display: 'flex',
              justifyContent: 'center',
              alignItems: 'center',
              gap: '10px'
            }}
          >
            {loading ? (
              <>
                <div style={{
                  width: '16px',
                  height: '16px',
                  border: '2px solid rgba(255,255,255,0.3)',
                  borderTopColor: 'white',
                  borderRadius: '50%',
                  animation: 'spin 1s linear infinite'
                }} />
                Verificando...
              </>
            ) : (
              '🚀 Iniciar Sesión'
            )}
          </button>
        </form>

        <div style={{
          marginTop: '30px',
          padding: '20px',
          backgroundColor: 'rgba(56, 139, 253, 0.1)',
          border: '1px solid #388bfd',
          borderRadius: '6px',
          fontSize: '13px',
          color: '#8b949e'
        }}>
          <p style={{ marginTop: 0, fontWeight: '600', color: '#58a6ff' }}>
            📝 ¿Cómo obtener tu token?
          </p>
          <ol style={{ paddingLeft: '20px', marginBottom: 0 }}>
            <li>Ve a GitHub Settings → Developer settings → Personal access tokens</li>
            <li>Haz clic en "Generate new token"</li>
            <li>Selecciona los scopes: <code style={{ backgroundColor: '#0d1117', padding: '2px 6px', borderRadius: '4px' }}>repo</code> y <code style={{ backgroundColor: '#0d1117', padding: '2px 6px', borderRadius: '4px' }}>user</code></li>
            <li>Copia el token y pégalo aquí</li>
          </ol>
        </div>
      </div>

      <style>{`
        @keyframes spin {
          0% { transform: rotate(0deg); }
          100% { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
};

export default Login;