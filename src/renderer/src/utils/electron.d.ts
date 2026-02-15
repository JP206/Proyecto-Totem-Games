// src/renderer/src/utils/electron.d.ts
export interface GitCloneData {
  url: string;
  destination: string;
  token?: string;
}

export interface RepoInformation {
  repoName: string;
  repoOwner: string;
  token: string;
}

export interface IssueData {
  title: string;
  description: string;
  id: number | null; // Null if creating an issue
  assignees: string[] | null;
  labels: string[] | null;
}

export interface GitCommandData {
  command: string;
  cwd: string;
}

export interface MessageData {
  type: "info" | "error" | "warning" | "question";
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

export interface SaveFileData {
  content: number[]; // Array de bytes del archivo
  destinationPath: string;
  fileName: string;
}

export interface ElectronAPI {
  // Sistema de archivos
  selectFolder: () => Promise<string | null>;
  readFolder: (path: string) => Promise<FileItem[]>;
  fileExists: (path: string) => Promise<boolean>;
  deleteFile: (path: string) => Promise<boolean>;
  saveFile: (data: SaveFileData) => Promise<{ success: boolean; path: string }>;

  // Git operations
  cloneRepository: (
    data: GitCloneData,
  ) => Promise<{ success: boolean; output: string; path: string }>;
  gitCommand: (data: GitCommandData) => Promise<string>;

  getIssues: (data: RepoInformation, label: string) => Promise<IssueData[]>;

  markIssueAsResolved: (issueId: number, repoInfo: RepoInformation) => Promise<boolean>;

  editIssue: (issueData: IssueData, repoInfo: RepoInformation) => Promise<boolean>;

  createIssue: (issueData: IssueData, repoInfo: RepoInformation) => Promise<boolean>;

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
}

declare global {
  interface Window {
    electronAPI: ElectronAPI;
  }
}
