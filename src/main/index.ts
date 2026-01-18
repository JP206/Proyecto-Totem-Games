// src/main/index.ts
import { app, BrowserWindow } from 'electron';
import path from 'path';
import fs from 'fs';

let mainWindow: BrowserWindow | null = null;

function createWindow() {
  console.log('🚀 Creando ventana de Electron...');
  
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    backgroundColor: '#1a1a1a',
    show: false, // No mostrar hasta que esté listo
    webPreferences: {
      nodeIntegration: false, // IMPORTANTE: false para seguridad
      contextIsolation: true, // IMPORTANTE: true para seguridad
      preload: path.join(__dirname, 'preload.js')
    }
  });

  // RUTA 1: Primero intenta cargar el BUILD de React
  const reactBuildPath = path.join(__dirname, '../../src/renderer/build/index.html');
  
  console.log('🔍 Buscando React build en:', reactBuildPath);
  
  if (fs.existsSync(reactBuildPath)) {
    console.log('✅ BUILD encontrado, cargando React compilado...');
    mainWindow.loadFile(reactBuildPath);
  } else {
    // RUTA 2: Si no hay build, carga el HTML básico
    console.log('⚠️  BUILD no encontrado, cargando HTML básico...');
    const basicHTML = `
    <!DOCTYPE html>
    <html>
    <head>
      <style>
        body { 
          background: #1a1a1a; 
          color: white; 
          font-family: Arial; 
          padding: 50px;
          text-align: center;
        }
        .container {
          max-width: 600px;
          margin: 100px auto;
          background: #24292e;
          padding: 40px;
          border-radius: 12px;
          border: 1px solid #444;
        }
        h1 { color: #2ea44f; }
        code { 
          background: #0d1117; 
          padding: 15px; 
          border-radius: 8px;
          display: block;
          margin: 20px 0;
          font-family: 'Courier New', monospace;
        }
      </style>
    </head>
    <body>
      <div class="container">
        <h1>React no compilado</h1>
        <p>Para compilar React y ver la aplicación, ejecuta:</p>
        <code>cd src/renderer && npm run build</code>
        <p>Luego reinicia Electron.</p>
      </div>
      <script>
        console.log('HTML básico cargado');
      </script>
    </body>
    </html>
    `;
    
    mainWindow.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(basicHTML)}`);
  }

  // Mostrar cuando esté listo
  mainWindow.once('ready-to-show', () => {
    if (mainWindow) {
      mainWindow.show();
      mainWindow.webContents.openDevTools(); // Para debuggear
    }
  });

  // Debug: ver errores de carga
  mainWindow.webContents.on('did-fail-load', (event, errorCode, errorDescription) => {
    console.error('❌ Error cargando página:', errorCode, errorDescription);
  });

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

app.whenReady().then(() => {
  console.log('✅ Electron listo');
  createWindow();
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});