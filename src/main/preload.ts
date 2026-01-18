// src/main/preload.ts
import { contextBridge, ipcRenderer } from 'electron';

contextBridge.exposeInMainWorld('electronAPI', {
  getAppInfo: () => ipcRenderer.invoke('get-app-info'),
  
  // API simple para mostrar alertas
  showAlert: (message: string) => {
    console.log('Alert from renderer:', message);
  },
  
  // Información básica del sistema
  platform: process.platform,
  isDev: process.env.NODE_ENV === 'development'
});