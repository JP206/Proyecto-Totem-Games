// src/renderer/src/utils/electron.d.ts
export interface GitCloneData {
  url: string;
  destination: string;
  token?: string;
}

export interface GitCommandData {
  command: string;
  cwd: string; // Current working directory
}

export interface MessageData {
  type: 'info' | 'error' | 'warning' | 'question';
  title: string;
  message: string;
}

export interface FileItem {
  name: string;
  path: string;
  isDirectory: boolean;
  isFile: boolean;
  isGitRepo?: boolean;
  size: number;
}

export interface ElectronAPI {
  // Sistema de archivos
  selectFolder: () => Promise<string | null>;
  readFolder: (path: string) => Promise<FileItem[]>;
  
  // Git operations
  cloneRepository: (data: GitCloneData) => Promise<{ success: boolean; output: string; path: string }>;
  gitCommand: (data: GitCommandData) => Promise<string>;
  
  // Configuración
  setConfig: (key: string, value: any) => Promise<boolean>;
  getConfig: (key: string) => Promise<any>;
  deleteConfig: (key: string) => Promise<boolean>;
  
  // Utilitarios
  openExternal: (url: string) => Promise<void>;
  showMessage: (data: MessageData) => Promise<void>;
  
  // Eventos
  onMenuSelectFolder: (callback: () => void) => void;
  onMenuRefreshRepos: (callback: () => void) => void;
  onMenuLogout: (callback: () => void) => void;
  
  // Información
  platform: string;
  appVersion: string;
  isDev: boolean;
}

declare global {
  interface Window {
    electronAPI: ElectronAPI;
  }
}