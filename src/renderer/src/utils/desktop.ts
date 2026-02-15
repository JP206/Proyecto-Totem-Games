// src/renderer/src/utils/desktop.ts
import {
  ElectronAPI,
  MessageData,
  GitCloneData,
  GitGetIssuesData,
  GitCommandData,
  SaveFileData
} from "./electron";

class DesktopManager {
  private static instance: DesktopManager;
  private electron: ElectronAPI;

  private constructor() {
    this.electron = window.electronAPI;
    this.setupEventListeners();
  }

  static getInstance(): DesktopManager {
    if (!DesktopManager.instance) {
      DesktopManager.instance = new DesktopManager();
    }
    return DesktopManager.instance;
  }

  private setupEventListeners(): void {
    this.electron.onMenuSelectFolder(() => {
      window.dispatchEvent(new CustomEvent("desktop:select-folder"));
    });

    this.electron.onMenuRefreshRepos(() => {
      window.dispatchEvent(new CustomEvent("desktop:refresh-repos"));
    });

    this.electron.onMenuLogout(() => {
      window.dispatchEvent(new CustomEvent("desktop:logout"));
    });
  }

  // ========== MÉTODOS PÚBLICOS ==========

  // Sistema de archivos
  async selectFolder(): Promise<string | null> {
    return await this.electron.selectFolder();
  }

  async readFolder(path: string) {
    return await this.electron.readFolder(path);
  }

  async fileExists(path: string): Promise<boolean> {
    return await this.electron.fileExists(path);
  }

  async deleteFile(path: string): Promise<boolean> {
    return await this.electron.deleteFile(path);
  }

  async saveFile(file: File, destinationPath: string): Promise<{ success: boolean; path: string }> {
    const arrayBuffer = await file.arrayBuffer();
    
    // Convertir a array de números para enviar por IPC
    const byteArray = Array.from(new Uint8Array(arrayBuffer));
    
    const saveData: SaveFileData = {
      content: byteArray,
      destinationPath: destinationPath.substring(0, destinationPath.lastIndexOf('/')),
      fileName: destinationPath.substring(destinationPath.lastIndexOf('/') + 1)
    };
    
    return await this.electron.saveFile(saveData);
  }

  // Git operations
  async cloneRepository(data: GitCloneData) {
    return await this.electron.cloneRepository(data);
  }

  async getIssues(data: GitGetIssuesData) {
    return await this.electron.getIssues(data);
  }

  async gitCommand(data: GitCommandData): Promise<string> {
    return await this.electron.gitCommand(data);
  }

  // Configuración
  async setConfig(key: string, value: any): Promise<void> {
    await this.electron.setConfig(key, value);
  }

  async getConfig(key: string): Promise<any> {
    return await this.electron.getConfig(key);
  }

  async deleteConfig(key: string): Promise<void> {
    await this.electron.deleteConfig(key);
  }

  // Utilitarios
  async showMessage(
    message: string,
    title: string = "GitHub Desktop",
    type: MessageData["type"] = "info",
  ): Promise<void> {
    await this.electron.showMessage({ type, title, message });
  }

  async openInBrowser(url: string): Promise<void> {
    await this.electron.openExternal(url);
  }
}

export default DesktopManager;
