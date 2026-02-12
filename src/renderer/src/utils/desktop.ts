// src/renderer/src/utils/desktop.ts
import {
  ElectronAPI,
  MessageData,
  GitCloneData,
  RepoInformation,
  GitCommandData,
  IssueData,
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
    // Escuchar eventos del menú
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

  // Git operations
  async cloneRepository(data: GitCloneData) {
    return await this.electron.cloneRepository(data);
  }

  async getIssues(data: RepoInformation, label: string) {
    return await this.electron.getIssues(data, label);
  }

  async markIssueAsResolved(issueId: number, repoInfo: RepoInformation) {
    return await this.electron.markIssueAsResolved(issueId, repoInfo);
  }

  async editIssue(issueData: IssueData, repoInfo: RepoInformation) {
    return await this.electron.editIssue(issueData, repoInfo);
  }

  async createIssue(issueData: IssueData, repoInfo: RepoInformation) {
    return await this.electron.createIssue(issueData, repoInfo);
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

  // Información
  getPlatform(): string {
    return this.electron.platform;
  }

  getAppVersion(): string {
    return this.electron.appVersion;
  }

  isDevelopment(): boolean {
    return this.electron.isDev;
  }

  // Verificar si estamos en Electron
  static isElectron(): boolean {
    return !!window.electronAPI;
  }
}

export default DesktopManager;
