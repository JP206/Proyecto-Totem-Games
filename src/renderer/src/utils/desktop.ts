// src/renderer/src/utils/desktop.ts
import {
  ElectronAPI,
  MessageData,
  GitCloneData,
  RepoInformation,
  GitCommandData,
  IssueData,
  SaveFileData,
  TranslateFilePayload,
  TranslateFileResult,
  SpellCheckPayload,
  SpellCheckResult,
  RunCostEstimate,
  UploadTranslationPayload,
  UploadTranslationResult,
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

  async deleteFolder(path: string): Promise<boolean> {
    return await this.electron.deleteFolder(path);
  }

    async writeFile(filePath: string, content: string): Promise<boolean> {
    try {
      // Usamos writeTranslationFile que ya existe
      const result = await this.electron.writeTranslationFile({ filePath, content });
      return result.success;
    } catch (error) {
      console.error("Error escribiendo archivo:", error);
      return false;
    }
  }

  async readFile(filePath: string): Promise<string> {
    try {
      const content = await this.electron.readFile(filePath);
      return content;
    } catch (error) {
      console.error("Error leyendo archivo:", error);
      return "";
    }
  }

  async ensureDir(dirPath: string): Promise<boolean> {
    try {
      // Verificamos si existe, si no, creamos un archivo temporal
      const exists = await this.fileExists(dirPath);
      if (!exists) {
        const keepFile = `${dirPath}/.keep`;
        await this.writeFile(keepFile, "");
        await this.deleteFile(keepFile);
      }
      return true;
    } catch (error) {
      console.error("Error asegurando directorio:", error);
      return false;
    }
  }

  async renameFile(oldPath: string, newName: string): Promise<boolean> {
    try {
      const content = await this.readFile(oldPath);
      const folderPath = oldPath.substring(0, oldPath.lastIndexOf("/"));
      const newPath = `${folderPath}/${newName}`;
      const writeResult = await this.writeFile(newPath, content);
      
      if (writeResult) {
        await this.deleteFile(oldPath);
        return true;
      }
      return false;
    } catch (error) {
      console.error("Error renombrando archivo:", error);
      return false;
    }
  }

  async saveFile(
    file: File,
    destinationPath: string,
  ): Promise<{ success: boolean; path: string }> {
    const arrayBuffer = await file.arrayBuffer();

    // Convertir a array de números para enviar por IPC
    const byteArray = Array.from(new Uint8Array(arrayBuffer));

    const saveData: SaveFileData = {
      content: byteArray,
      destinationPath: destinationPath.substring(
        0,
        destinationPath.lastIndexOf("/"),
      ),
      fileName: destinationPath.substring(destinationPath.lastIndexOf("/") + 1),
    };

    return await this.electron.saveFile(saveData);
  }

  // Git operations
  async cloneRepository(data: GitCloneData) {
    return await this.electron.cloneRepository(data);
  }

  async getIssues(data: RepoInformation, label: string) {
    return await this.electron.getIssues(data, label);
  }

  async getIssuesVariable(data: RepoInformation, params: any) {
    return await this.electron.getIssuesVariable(data, params);
  }

  async markIssueAsResolved(issueId: number, repoInfo: RepoInformation) {
    return await this.electron.markIssueAsResolved(issueId, repoInfo);
  }

  async getCollaborators(repoInfo: RepoInformation) {
    return await this.electron.getCollaborators(repoInfo);
  }

  async inviteToOrg(organization: string, token: string, mail: string) {
    return await this.electron.inviteToOrg(organization, token, mail);
  }

  async getOrgMembers(organization: string, token: string) {
    return await this.electron.getOrgMembers(organization, token);
  }

  async editIssue(issueData: IssueData, repoInfo: RepoInformation) {
    return await this.electron.editIssue(issueData, repoInfo);
  }

  async createIssue(issueData: IssueData, repoInfo: RepoInformation) {
    return await this.electron.createIssue(issueData, repoInfo);
  }

  async getChanges(data: RepoInformation) {
    return await this.electron.getChanges(data);
  }

  async getDiff(
    base: string,
    head: string,
    repoInfo: RepoInformation,
  ): Promise<any> {
    return await this.electron.getDiff(base, head, repoInfo);
  }

  async getOrgRepos(organization: string, token: string) {
    return await this.electron.getOrgRepos(organization, token);
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
  async openInBrowser(url: string): Promise<void> {
    await this.electron.openExternal(url);
  }

  // AI Translation
  async translateFile(
    payload: TranslateFilePayload,
  ): Promise<TranslateFileResult> {
    return await this.electron.translateFile(payload);
  }

  async spellCheckFile(payload: SpellCheckPayload): Promise<SpellCheckResult> {
    return await this.electron.spellCheckFile(payload);
  }

  async estimateRunCost(payload: {
    translationPayload: TranslateFilePayload;
    includeSpellcheck: boolean;
    spellcheckPayload?: SpellCheckPayload;
  }): Promise<RunCostEstimate> {
    return await this.electron.estimateRunCost(payload);
  }

  onSpellCheckProgress(
    callback: (data: {
      percent: number;
      current?: number;
      total?: number;
    }) => void,
  ): () => void {
    return this.electron.onSpellCheckProgress(callback);
  }

  onTranslationProgress(
    callback: (data: { percent: number; stage?: string }) => void,
  ): () => void {
    return this.electron.onTranslationProgress(callback);
  }

  async uploadTranslation(
    payload: UploadTranslationPayload,
  ): Promise<UploadTranslationResult> {
    return await this.electron.uploadTranslation(payload);
  }

  async writeTranslationFile(data: {
    filePath: string;
    content: string;
  }): Promise<{ success: boolean; error?: string }> {
    return await this.electron.writeTranslationFile(data);
  }
}

export default DesktopManager;
