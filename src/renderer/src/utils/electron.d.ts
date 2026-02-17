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

export interface TranslateFilePayload {
  repoPath: string;
  projectName: string;
  filePath: string;
  sourceLanguageName?: string;
  targetLanguages: { code: string; name: string }[];
  contexts: string[];
  glossaries: string[];
  providerOptions: {
    mode: "openai" | "gemini" | "both";
    openaiModel: string;
    geminiModel: string;
  };
  maxRowsPerBatch?: number;
  maxContextChars?: number;
}

export interface RowProviderTranslation {
  openaiText?: string;
  geminiText?: string;
  mergedText: string;
  confidence: number | null;
}

export interface PreviewRow {
  key: string;
  sourceText: string;
  perLanguage: {
    [langCode: string]: RowProviderTranslation;
  };
}

export interface TranslateFileResult {
  filePath: string;
  csvContent: string;
  preview: PreviewRow[];
  stats: {
    totalRows: number;
    translatedRows: number;
  };
}

export interface SpellCheckPayload {
  filePath: string;
  language?: string;
  maxRows?: number;
  /** If false, do not write to file (for preview/discard flow). */
  applyToFile?: boolean;
  providerOptions: {
    mode: "openai" | "gemini" | "both";
    openaiModel: string;
    geminiModel: string;
  };
}

export interface ProgressPayload {
  percent: number;
  current?: number;
  total?: number;
  stage?: string;
}

export interface SpellCheckPreviewRow {
  rowIndex: number;
  key: string;
  originalSource: string;
  correctedSource: string;
}

export interface SpellCheckResult {
  filePath: string;
  csvContent: string;
  preview: SpellCheckPreviewRow[];
  stats: { totalRows: number; correctedRows: number };
}

export interface UploadTranslationPayload {
  repoPath: string;
  filePath: string;
  commitMessage?: string;
}

export interface WriteTranslationFilePayload {
  filePath: string;
  content: string;
}

export interface UploadTranslationResult {
  success: boolean;
  commitCreated?: boolean;
  stdout?: string;
  stderr?: string;
  error?: string;
}

export interface ElectronAPI {
  // Sistema de archivos
  selectFolder: () => Promise<string | null>;
  readFolder: (path: string) => Promise<FileItem[]>;
  fileExists: (path: string) => Promise<boolean>;
  deleteFile: (path: string) => Promise<boolean>;
  saveFile: (data: SaveFileData) => Promise<{ success: boolean; path: string }>;

  // AI translation
  translateFile: (payload: TranslateFilePayload) => Promise<TranslateFileResult>;
  spellCheckFile: (payload: SpellCheckPayload) => Promise<SpellCheckResult>;
  uploadTranslation: (payload: UploadTranslationPayload) => Promise<UploadTranslationResult>;
  writeTranslationFile: (data: WriteTranslationFilePayload) => Promise<{ success: boolean; error?: string }>;
  onSpellCheckProgress: (callback: (data: ProgressPayload) => void) => () => void;
  onTranslationProgress: (callback: (data: ProgressPayload) => void) => () => void;

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
