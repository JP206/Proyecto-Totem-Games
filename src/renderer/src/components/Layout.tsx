// src/renderer/src/components/Layout.tsx
import React, { useEffect, useState } from 'react';
import DesktopManager from '../utils/desktop';

interface LayoutProps {
  children: React.ReactNode;
}

const Layout: React.FC<LayoutProps> = ({ children }) => {
  const [isElectron, setIsElectron] = useState(false);
  const [appVersion, setAppVersion] = useState('');

  useEffect(() => {
    if (DesktopManager.isElectron()) {
      setIsElectron(true);
      const desktop = DesktopManager.getInstance();
      setAppVersion(desktop.getAppVersion());
      
      // Configurar event listeners globales
      window.addEventListener('desktop:select-folder', () => {
        console.log('Seleccionar carpeta desde menú');
        // Aquí iría la lógica para tu app
      });
      
      window.addEventListener('desktop:refresh-repos', () => {
        console.log('Refrescar repositorios desde menú');
      });
      
      window.addEventListener('desktop:logout', () => {
        window.location.href = '/login';
      });
    }
  }, []);

  // Si no estamos en Electron, mostrar mensaje de error
  if (!isElectron) {
    return (
      <div style={{
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        height: '100vh',
        backgroundColor: '#1a1a1a',
        color: 'white',
        textAlign: 'center',
        padding: '40px',
        fontFamily: 'Arial, sans-serif'
      }}>
        <div>
          <h1 style={{ fontSize: '48px', marginBottom: '20px' }}>🚫</h1>
          <h2>Versión de Escritorio Requerida</h2>
          <p style={{ margin: '20px 0', fontSize: '18px' }}>
            Esta es una aplicación de escritorio que no funciona en el navegador.
          </p>
          <p style={{ marginBottom: '30px', color: '#aaa' }}>
            Descarga e instala la aplicación para tu sistema operativo.
          </p>
          <button
            onClick={() => window.open('https://github.com', '_blank')}
            style={{
              padding: '15px 30px',
              fontSize: '16px',
              backgroundColor: '#2ea44f',
              color: 'white',
              border: 'none',
              borderRadius: '8px',
              cursor: 'pointer',
              fontWeight: 'bold'
            }}
          >
            📥 Descargar Aplicación
          </button>
        </div>
      </div>
    );
  }

  return (
    <div style={{
      backgroundColor: '#1a1a1a',
      minHeight: '100vh',
      color: 'white',
      fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif'
    }}>
      {/* Header de la app */}
      <header style={{
        backgroundColor: '#24292e',
        padding: '15px 30px',
        borderBottom: '1px solid #444',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '15px' }}>
          <h1 style={{ margin: 0, fontSize: '20px', fontWeight: '600' }}>
            🚀 GitHub Desktop Manager
          </h1>
          <span style={{
            fontSize: '12px',
            backgroundColor: '#2ea44f',
            padding: '2px 8px',
            borderRadius: '10px'
          }}>
            v{appVersion}
          </span>
        </div>
        
        <div style={{ fontSize: '13px', color: '#8b949e' }}>
          {DesktopManager.getInstance().getPlatform() === 'win32' ? 'Windows' : 
           DesktopManager.getInstance().getPlatform() === 'darwin' ? 'macOS' : 'Linux'}
        </div>
      </header>

      {/* Contenido principal */}
      <main style={{ padding: '30px' }}>
        {children}
      </main>

      {/* Footer */}
      <footer style={{
        backgroundColor: '#24292e',
        padding: '15px 30px',
        borderTop: '1px solid #444',
        textAlign: 'center',
        fontSize: '12px',
        color: '#8b949e'
      }}>
        <p>GitHub Desktop Manager • Aplicación de escritorio • {new Date().getFullYear()}</p>
      </footer>
    </div>
  );
};

export default Layout;