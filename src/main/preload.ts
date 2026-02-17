// src/main/preload.ts
import { contextBridge, ipcRenderer, IpcRendererEvent } from "electron";
import { RepoInformation } from "../renderer/src/utils/electron";
import { IssueData } from "../renderer/src/utils/electron";

contextBridge.exposeInMainWorld("electronAPI", {
  // 1. SISTEMA DE ARCHIVOS
  selectFolder: () => ipcRenderer.invoke("select-folder"),
  readFolder: (path: string) => ipcRenderer.invoke("read-folder", path),

  // 2. COMANDOS GIT
  cloneRepository: (data: {
    url: string;
    destination: string;
    token?: string;
  }) => ipcRenderer.invoke("git-clone", data),

  getIssues: (data: RepoInformation, label: string) => ipcRenderer.invoke("git-get-issues", data, label),

  markIssueAsResolved: (issueId: number, repoInfo: RepoInformation) =>
    ipcRenderer.invoke("git-mark-issue-as-resolved", issueId, repoInfo),

  editIssue: (issueData: IssueData, repoInfo: RepoInformation) =>
    ipcRenderer.invoke("git-edit-issue", issueData, repoInfo),

  createIssue: (issueData: IssueData, repoInfo: RepoInformation) =>
    ipcRenderer.invoke("git-create-issue", issueData, repoInfo),

  gitCommand: (data: { command: string; cwd: string }) =>
    ipcRenderer.invoke("git-command", data),

  // 3. CONFIGURACIÓN (Storage)
  setConfig: (key: string, value: any) =>
    ipcRenderer.invoke("set-config", { key, value }),

  getConfig: (key: string) => ipcRenderer.invoke("get-config", key),

  deleteConfig: (key: string) => ipcRenderer.invoke("delete-config", key),

  // 4. UTILITARIOS
  openExternal: (url: string) => ipcRenderer.invoke("open-external", url),

  showMessage: (data: { type: string; title: string; message: string }) =>
    ipcRenderer.invoke("show-message", data),

  // 5. EVENTOS DEL MENÚ
  onMenuSelectFolder: (callback: () => void) => {
    ipcRenderer.on("menu:select-folder", () => callback());
  },

  onMenuRefreshRepos: (callback: () => void) => {
    ipcRenderer.on("menu:refresh-repos", () => callback());
  },

  onMenuLogout: (callback: () => void) => {
    ipcRenderer.on("menu:logout", () => callback());
  },

  // 6. INFO DEL SISTEMA
  platform: process.platform,
  isDev: process.env.NODE_ENV === "development",

  // 7. VERIFICAR SI ARCHIVO EXISTE
  fileExists: (path: string) => ipcRenderer.invoke("file-exists", path),

  // 8. ELIMINAR ARCHIVO
  deleteFile: (path: string) => ipcRenderer.invoke("delete-file", path),

  // 9. GUARDAR ARCHIVO
  saveFile: (data: { content: number[]; destinationPath: string; fileName: string }) =>
    ipcRenderer.invoke("save-file", data),

  // 10. TRADUCCIÓN AI
  translateFile: (payload: any) => ipcRenderer.invoke("ai-translate-file", payload),

  // 10b. REVISIÓN ORTOGRÁFICA Y GRAMATICAL (IA)
  spellCheckFile: (payload: any) => ipcRenderer.invoke("ai-spellcheck-file", payload),

  onSpellCheckProgress: (callback: (data: { percent: number; current?: number; total?: number }) => void) => {
    const handler = (_: IpcRendererEvent, data: any) => callback(data);
    ipcRenderer.on("spellcheck-progress", handler);
    return () => ipcRenderer.removeListener("spellcheck-progress", handler);
  },
  onTranslationProgress: (callback: (data: { percent: number; stage?: string }) => void) => {
    const handler = (_: IpcRendererEvent, data: any) => callback(data);
    ipcRenderer.on("translation-progress", handler);
    return () => ipcRenderer.removeListener("translation-progress", handler);
  },

  // 11. SUBIR TRADUCCIÓN AL REPO
  uploadTranslation: (payload: any) => ipcRenderer.invoke("ai-upload-translation", payload),

  // 11b. ESCRIBIR ARCHIVO DE TRADUCCIÓN (guardar ediciones)
  writeTranslationFile: (data: { filePath: string; content: string }) =>
    ipcRenderer.invoke("write-translation-file", data),
});
