// src/main/index.ts
import { app, BrowserWindow, ipcMain, dialog, shell, safeStorage } from "electron";
import path from "path";
import fs from "fs/promises";
import { exec } from "child_process";
import { promisify } from "util";
import Store from "electron-store";
import { IssueData, RepoInformation } from "../renderer/src/utils/electron";
import "dotenv/config";
import {
  translateFileInMain,
  estimateTranslationCostInMain,
  TranslateFilePayload,
  TranslateFileResult,
} from "./ai/translation";
import {
  spellCheckFileInMain,
  estimateSpellCheckCostInMain,
  SpellCheckPayload,
  SpellCheckResult,
} from "./ai/spellcheck";

const execAsync = promisify(exec);
const store = new Store();

type ProviderId = "openai" | "gemini";

interface AiPersonalProviderConfig {
  encryptedKey?: string;
  defaultModel?: string | null;
}

interface AiPersonalConfig {
  openai?: AiPersonalProviderConfig;
  gemini?: AiPersonalProviderConfig;
}

interface ProviderModelInfo {
  id: string;
  displayName: string;
}

interface PersonalProviderConfigSummary {
  hasKey: boolean;
  defaultModel: string | null;
  models: ProviderModelInfo[];
  embeddingModels: ProviderModelInfo[];
}

interface PersonalAIConfigSummary {
  openai: PersonalProviderConfigSummary;
  gemini: PersonalProviderConfigSummary;
}

interface SavePersonalAIConfigRequest {
  provider: ProviderId;
  apiKey: string | null;
  preferredModelId: string | null;
}

interface SavePersonalAIConfigResult {
  success: boolean;
  error?: string;
  models?: ProviderModelInfo[];
  defaultModelId?: string | null;
}

function encryptString(value: string): string {
  if (!safeStorage.isEncryptionAvailable()) {
    return value;
  }
  const buf = safeStorage.encryptString(value);
  return buf.toString("base64");
}

function decryptString(value: string | undefined | null): string | null {
  if (!value) {
    return null;
  }
  if (!safeStorage.isEncryptionAvailable()) {
    return value;
  }
  try {
    const buf = Buffer.from(value, "base64");
    return safeStorage.decryptString(buf);
  } catch {
    return null;
  }
}

function getAiPersonalConfig(): AiPersonalConfig {
  const raw = store.get("ai_personal_config");
  if (!raw || typeof raw !== "object") {
    return {};
  }
  return raw as AiPersonalConfig;
}

// Expose a runtime helper with decrypted keys for AI modules.
// translation.ts / spellcheck.ts resolve personal keys from this global getter.
(global as any).getAiPersonalConfig = () => {
  const cfg = getAiPersonalConfig();
  return {
    openai: {
      apiKey: decryptString(cfg.openai?.encryptedKey) || undefined,
      defaultModel: cfg.openai?.defaultModel ?? null,
    },
    gemini: {
      apiKey: decryptString(cfg.gemini?.encryptedKey) || undefined,
      defaultModel: cfg.gemini?.defaultModel ?? null,
    },
  };
};

function setAiPersonalConfig(cfg: AiPersonalConfig) {
  store.set("ai_personal_config", cfg);
}

function mapOpenAIModels(raw: any): ProviderModelInfo[] {
  const data = Array.isArray(raw?.data) ? raw.data : [];
  return data
    .map((m: any): string => String(m.id || ""))
    .filter((id: string) => id)
    .filter((id: string) => id.includes("gpt") || id.startsWith("o"))
    // Excluir modelos puramente de audio/voz
    .filter((id: string) => {
      const lower = id.toLowerCase();
      return (
        !lower.includes("whisper") &&
        !lower.includes("tts") &&
        !lower.includes("audio") &&
        !lower.includes("speech")
      );
    })
    .map((id: string) => ({ id, displayName: id }));
}

function mapOpenAIEmbeddingModels(raw: any): ProviderModelInfo[] {
  const data = Array.isArray(raw?.data) ? raw.data : [];
  return data
    .map((m: any): string => String(m.id || ""))
    .filter((id: string) => id)
    .filter((id: string) => id.toLowerCase().includes("embedding"))
    .map((id: string) => ({ id, displayName: id }));
}

function mapGeminiModels(raw: any): ProviderModelInfo[] {
  const models = Array.isArray(raw?.models) ? raw.models : [];
  return models
    .map((m: any): string => String(m.name || ""))
    .filter((name: string) => name)
    .map((name: string) => {
      const id = name.split("/").pop() || name;
      return { id, displayName: id };
    })
    .filter((m: ProviderModelInfo) => {
      const lower = m.id.toLowerCase();
      if (!lower.startsWith("gemini")) return false;
      // Excluir modelos puramente de audio/voz si aparecieran
      if (
        lower.includes("audio") ||
        lower.includes("speech") ||
        lower.includes("tts")
      ) {
        return false;
      }
      return true;
    });
}

function mapGeminiEmbeddingModels(raw: any): ProviderModelInfo[] {
  const models = Array.isArray(raw?.models) ? raw.models : [];
  return models
    .map((m: any): string => String(m.name || ""))
    .filter((name: string) => name)
    .map((name: string) => {
      const id = name.split("/").pop() || name;
      return { id, displayName: id };
    })
    .filter((m: ProviderModelInfo) => m.id.toLowerCase().includes("embedding"));
}

let mainWindow: BrowserWindow | null = null;

function createWindow() {
  mainWindow = new BrowserWindow({
    icon: path.join(__dirname, "../../resources/logo_totemgames.ico"),
    title: "Proyecto Totem Games App",
    width: 1200,
    height: 800,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, "preload.js"),
      webSecurity: false,
      webviewTag: true,
      allowRunningInsecureContent: true,
    },
  });

  mainWindow.loadFile(
    path.join(__dirname, "../../src/renderer/build/index.html"),
  );

  if (!app.isPackaged) {
    mainWindow.webContents.openDevTools();
  }
}

// ========== APIS IPC ==========

// 1. SELECCIONAR CARPETA
ipcMain.handle("select-folder", async (): Promise<string | null> => {
  if (!mainWindow) return null;

  const result = await dialog.showOpenDialog(mainWindow, {
    properties: ["openDirectory"],
    title: "Seleccionar carpeta",
  });

  return result.canceled ? null : result.filePaths[0];
});

// 2. LEER CONTENIDO DE CARPETA
ipcMain.handle("read-folder", async (event: any, folderPath: string) => {
  try {
    const files = await fs.readdir(folderPath, { withFileTypes: true });

    const filePromises = files.map(async (file) => {
      const filePath = path.join(folderPath, file.name);
      let size = 0;
      let isGitRepo = false;

      if (file.isFile()) {
        try {
          const stats = await fs.stat(filePath);
          size = stats.size;
        } catch {
          size = 0;
        }
      } else if (file.isDirectory()) {
        // Verificar si es un repositorio git
        const gitPath = path.join(filePath, ".git");
        try {
          await fs.access(gitPath);
          isGitRepo = true;
        } catch {
          isGitRepo = false;
        }
      }

      return {
        name: file.name,
        path: filePath,
        isDirectory: file.isDirectory(),
        isFile: file.isFile(),
        isGitRepo,
        size,
      };
    });

    return await Promise.all(filePromises);
  } catch (error: unknown) {
    const errorMessage =
      error instanceof Error ? error.message : "Error desconocido";
    throw new Error(`Error leyendo carpeta: ${errorMessage}`);
  }
});

// 2a. ELIMINAR CARPETA
ipcMain.handle("delete-folder", async (event: any, folderPath: string) => {
  try {
    const deleteRecursive = async (dirPath: string) => {
      const files = await fs.readdir(dirPath, { withFileTypes: true });
      
      for (const file of files) {
        const filePath = path.join(dirPath, file.name);
        if (file.isDirectory()) {
          await deleteRecursive(filePath);
        } else {
          await fs.unlink(filePath);
        }
      }
      
      await fs.rmdir(dirPath);
    };

    await deleteRecursive(folderPath);
    return true; // Devuelve boolean directamente
  } catch (error) {
    console.error("Error eliminando carpeta:", error);
    return false; // Devuelve boolean directamente
  }
});

// 2b. TRADUCIR ARCHIVO DE LOCALIZACIÓN
ipcMain.handle(
  "ai-translate-file",
  async (
    event: any,
    payload: TranslateFilePayload,
  ): Promise<TranslateFileResult> => {
    return await translateFileInMain(payload, event.sender);
  },
);

// 2c. REVISIÓN ORTOGRÁFICA Y GRAMATICAL (IA)
ipcMain.handle(
  "ai-spellcheck-file",
  async (event: any, payload: SpellCheckPayload): Promise<SpellCheckResult> => {
    return await spellCheckFileInMain(payload, event.sender);
  },
);

ipcMain.handle(
  "ai-estimate-run-cost",
  async (
    _event: any,
    payload: {
      translationPayload: TranslateFilePayload;
      includeSpellcheck: boolean;
      spellcheckPayload?: SpellCheckPayload;
    },
  ) => {
    const translation = await estimateTranslationCostInMain(payload.translationPayload);
    const spellcheck =
      payload.includeSpellcheck && payload.spellcheckPayload
        ? await estimateSpellCheckCostInMain(payload.spellcheckPayload)
        : { estimatedTokens: 0 };
    return {
      translation,
      spellcheck,
      total: {
        estimatedTokens: translation.estimatedTokens + spellcheck.estimatedTokens,
      },
    };
  },
);

// 3. EJECUTAR COMANDO GENÉRICO
ipcMain.handle(
  "execute-command",
  async (event: any, data: { command: string; cwd?: string }) => {
    try {
      const { stdout, stderr } = await execAsync(data.command, {
        cwd: data.cwd || process.cwd(),
        timeout: 30000,
      });

      if (stderr) console.warn("Stderr:", stderr);
      return { success: true, output: stdout, error: stderr };
    } catch (error: unknown) {
      const errorMessage =
        error instanceof Error ? error.message : "Error desconocido";
      return {
        success: false,
        output: "",
        error: errorMessage,
      };
    }
  },
);

// 4. CLONAR REPOSITORIO GIT (CON TOKEN)
ipcMain.handle(
  "git-clone",
  async (
    event: any,
    data: {
      url: string;
      destination: string;
      token?: string;
    },
  ) => {
    try {
      let cloneUrl = data.url;

      // Si hay token, autenticar la URL
      if (data.token) {
        cloneUrl = data.url.replace("https://", `https://${data.token}@`);
      }

      const command = `git clone "${cloneUrl}" "${data.destination}"`;
      console.log("Ejecutando comando git clone:", command);

      const { stdout, stderr } = await execAsync(command, {
        timeout: 120000, // 2 minutos para clones grandes
      });

      if (stderr && !stderr.includes("Cloning into")) {
        console.warn("Advertencias en clone:", stderr);
      }

      return {
        success: true,
        output: stdout,
        path: data.destination,
      };
    } catch (error: unknown) {
      const errorMessage =
        error instanceof Error ? error.message : "Error desconocido";
      console.error("Error en git-clone:", errorMessage);

      // Verificar si es error de autenticación
      if (errorMessage.includes("Authentication")) {
        throw new Error("Token de GitHub inválido o expirado");
      }

      throw new Error(`Error clonando repositorio: ${errorMessage}`);
    }
  },
);

// OBTENER ISSUES GIT (devuelve todos los issues abiertos segun label)
ipcMain.handle(
  "git-get-issues",
  async (event: any, data: RepoInformation, label: string) => {
    try {
      const url: string = `https://api.github.com/repos/${data.repoOwner}/${data.repoName}/issues?labels=${label}`;

      const response = await fetch(url, {
        method: "GET",
        headers: {
          Accept: "application/vnd.github+json",
          Authorization: `Bearer ${data.token}`,
          "X-GitHub-Api-Version": "2022-11-28",
        },
      });

      return response.json();
    } catch (error: unknown) {
      const errorMessage =
        error instanceof Error ? error.message : "Error desconocido";
      console.error("Error en git-clone:", errorMessage);

      if (errorMessage.includes("Authentication")) {
        throw new Error("Token de GitHub inválido o expirado");
      }

      throw new Error(`Error clonando repositorio: ${errorMessage}`);
    }
  },
);

// OBTENER ISSUES CON PARAMETROS VARIABLES
ipcMain.handle(
  "git-get-issues-variable",
  async (
    event: any,
    data: RepoInformation,
    params?: {
      assignee?: string;    // user name, none (issues sin assignees), * (todos)
      state?: string;       // open, closed, all
      labels?: string;      // bug (issue), documentation (nota) 
    }
  ) => {
    try {
      const baseUrl = `https://api.github.com/repos/${data.repoOwner}/${data.repoName}/issues`;

      const url = new URL(baseUrl);

      Object.entries(params || {}).forEach(([k, v]) => {
        if (v) url.searchParams.append(k, v);
      });

      const response = await fetch(url.toString(), {
        method: "GET",
        headers: {
          Accept: "application/vnd.github+json",
          Authorization: `Bearer ${data.token}`,
          "X-GitHub-Api-Version": "2022-11-28",
        },
      });

      return response.json();
    }catch (error: unknown) {
      const errorMessage =
        error instanceof Error ? error.message : "Error desconocido";

      console.error("Error en git-get-issues:", errorMessage);

      if (errorMessage.includes("Authentication")) {
        throw new Error("Token de GitHub inválido o expirado");
      }

      throw new Error(`Error obteniendo issues: ${errorMessage}`);
    }
  }
);

// MARCAR ISSUE COMO RESUELTO
ipcMain.handle(
  "git-mark-issue-as-resolved",
  async (event: any, issueId: number, data: RepoInformation) => {
    try {
      const url: string = `https://api.github.com/repos/${data.repoOwner}/${data.repoName}/issues/${issueId}`;

      const response = await fetch(url, {
        method: "PATCH",
        headers: {
          Accept: "application/vnd.github+json",
          Authorization: `Bearer ${data.token}`,
          "X-GitHub-Api-Version": "2022-11-28",
        },
        body: JSON.stringify({
          state: "closed",
        }),
      });

      return response.json();
    } catch (error: unknown) {
      const errorMessage =
        error instanceof Error ? error.message : "Error desconocido";
      console.error("Error en git-clone:", errorMessage);

      if (errorMessage.includes("Authentication")) {
        throw new Error("Token de GitHub inválido o expirado");
      }

      throw new Error(`Error clonando repositorio: ${errorMessage}`);
    }
  },
);

// EDITAR ISSUE
ipcMain.handle(
  "git-edit-issue",
  async (event: any, issueData: IssueData, data: RepoInformation) => {
    try {
      const url: string = `https://api.github.com/repos/${data.repoOwner}/${data.repoName}/issues/${issueData.id}`;

      const response = await fetch(url, {
        method: "PATCH",
        headers: {
          Accept: "application/vnd.github+json",
          Authorization: `Bearer ${data.token}`,
          "X-GitHub-Api-Version": "2022-11-28",
        },
        body: JSON.stringify({
          ...(issueData.title != null && { title: issueData.title }),
          ...(issueData.description != null && { body: issueData.description }),
          ...(issueData.assignees != null && { assignees: issueData.assignees }),
        }),
      });

      return response.json();
    } catch (error: unknown) {
      const errorMessage =
        error instanceof Error ? error.message : "Error desconocido";
      console.error("Error en git-clone:", errorMessage);
      if (errorMessage.includes("Authentication")) {
        throw new Error("Token de GitHub inválido o expirado");
      }

      throw new Error(`Error clonando repositorio: ${errorMessage}`);
    }
  },
);

// CREAR ISSUE/NOTA
ipcMain.handle(
  "git-create-issue",
  async (event: any, issueData: IssueData, data: RepoInformation) => {
    try {
      const url: string = `https://api.github.com/repos/${data.repoOwner}/${data.repoName}/issues`;

      const response = await fetch(url, {
        method: "POST",
        headers: {
          Accept: "application/vnd.github+json",
          Authorization: `Bearer ${data.token}`,
          "X-GitHub-Api-Version": "2022-11-28",
        },
        body: JSON.stringify({
          ...{ title: issueData.title },
          ...(issueData.description != null && { body: issueData.description }),
          ...(issueData.assignees != null && {
            assignees: issueData.assignees,
          }),
          ...(issueData.labels != null && { labels: issueData.labels }),
        }),
      });

      return response.json();
    } catch (error: unknown) {
      const errorMessage =
        error instanceof Error ? error.message : "Error desconocido";
      console.error("Error en git-clone:", errorMessage);
      if (errorMessage.includes("Authentication")) {
        throw new Error("Token de GitHub inválido o expirado");
      }

      throw new Error(`Error clonando repositorio: ${errorMessage}`);
    }
  },
);

// OBTENER NOTAS GIT
ipcMain.handle("git-get-notes", async (event: any, data: RepoInformation) => {
  try {
    const url: string = `https://api.github.com/repos/${data.repoOwner}/${data.repoName}/issues?labels=documentation`;

    const response = await fetch(url, {
      method: "GET",
      headers: {
        Accept: "application/vnd.github+json",
        Authorization: `Bearer ${data.token}`,
        "X-GitHub-Api-Version": "2022-11-28",
      },
    });

    return response.json();
  } catch (error: unknown) {
    const errorMessage =
      error instanceof Error ? error.message : "Error desconocido";
    console.error("Error en git-clone:", errorMessage);

      if (errorMessage.includes("Authentication")) {
        throw new Error("Token de GitHub inválido o expirado");
      }

      throw new Error(`Error clonando repositorio: ${errorMessage}`);
    }
});

// OBTENER COLLABORATORS DE UN REPOSITORIO
ipcMain.handle(
  "git-get-collaborators",
  async (event: any, data: RepoInformation) => {
    try {
      const url: string = `https://api.github.com/repos/${data.repoOwner}/${data.repoName}/collaborators`;

      const response = await fetch(url, {
        method: "GET",
        headers: {
          Accept: "application/vnd.github+json",
          Authorization: `Bearer ${data.token}`,
          "X-GitHub-Api-Version": "2022-11-28",
        },
      });

      return response.json();
    } catch (error: unknown) {
      const errorMessage =
        error instanceof Error ? error.message : "Error desconocido";
      console.error("Error en git-get-collaborators:", errorMessage);

      if (errorMessage.includes("Authentication")) {
        throw new Error("Token de GitHub inválido o expirado");
      }

      throw new Error(`Error obteniendo contributors: ${errorMessage}`);
    }
  },
);

// INVITAR A ORGANIZATION (***solo el creador de la organizacion puede hacerlo)
ipcMain.handle(
  "git-invite-org",
  async (event: any, organization: string, mail: string, token: string) => {
    try {
      const url: string = `https://api.github.com/orgs/${organization}/invitations`;

      const response = await fetch(url, {
        method: "POST",
        headers: {
          Accept: "application/vnd.github+json",
          Authorization: `Bearer ${token}`,
          "X-GitHub-Api-Version": "2026-03-10",
        },
        body: JSON.stringify({
            "email": mail,
            "role": "direct_member"
        }),
      });

      return response.json();
    } catch (error: unknown) {
      const errorMessage =
        error instanceof Error ? error.message : "Error desconocido";
      console.error("Error invitando a organizacion:", errorMessage);
      if (errorMessage.includes("Authentication")) {
        throw new Error("Token de GitHub inválido o expirado");
      }

      throw new Error(`Error invitando a organizacion: ${errorMessage}`);
    }
  },
);

// OBTENER MIEMBROS DE UNA ORGANIZACION (para invitaciones de admin)
ipcMain.handle(
  "git-get-org-members",
  async (event: any, token: string, organization: string) => {
    try {
      const url: string = `https://api.github.com/orgs/${organization}/members`;

      const response = await fetch(url, {
        method: "GET",
        headers: {
          Accept: "application/vnd.github+json",
          Authorization: `Bearer ${token}`,
          "X-GitHub-Api-Version": "2026-03-10",
        },
      });

      return response.json();
    } catch (error: unknown) {
      const errorMessage =
        error instanceof Error ? error.message : "Error desconocido";
      console.error("Error al obtener miembros de la organizacion:", errorMessage);

      if (errorMessage.includes("Authentication")) {
        throw new Error("Token de GitHub inválido o expirado");
      }

      throw new Error(`Error al obtener miembros de la organizacion: ${errorMessage}`);
    }
  },
);

// OBTENER CAMBIOS EN REPOSITORIO
ipcMain.handle("git-get-changes", async (event: any, data: RepoInformation) => {
  try {
    const url: string = `https://api.github.com/repos/${data.repoOwner}/${data.repoName}/commits`;

    const response = await fetch(url, {
      method: "GET",
      headers: {
        Accept: "application/vnd.github+json",
        Authorization: `Bearer ${data.token}`,
        "X-GitHub-Api-Version": "2022-11-28",
      },
    });

    return response.json();
  } catch (error: unknown) {
    const errorMessage =
      error instanceof Error ? error.message : "Error desconocido";
    console.error("Error obteniendo cambios:", errorMessage);
  }
});

// OBTENER DIFF ENTRE DOS COMMITS
ipcMain.handle(
  "git-get-diff",
  (event: any, base: string, head: string, data: RepoInformation) => {
    try {
      console.log(data);
      const url: string = `https://github.com/${data.repoOwner}/${data.repoName}/compare/${base}..${head}`;

      return url;
    } catch (error: unknown) {
      const errorMessage =
        error instanceof Error ? error.message : "Error desconocido";
      console.error("Error comparando diff:", errorMessage);

      if (errorMessage.includes("Authentication")) {
        throw new Error("Token de GitHub inválido o expirado");
      }

      throw new Error(`Error comparando diff: ${errorMessage}`);
    }
  },
);

// OBTENER REPOSITORIOS DE UNA ORGANIZACION
ipcMain.handle("git-get-org-repos", async (event: any, organization: string, token: string) => {
  try {
    const url: string = `https://api.github.com/orgs/${organization}/repos`;

    const response = await fetch(url, {
      method: "GET",
      headers: {
        Accept: "application/vnd.github+json",
        Authorization: `Bearer ${token}`,
        "X-GitHub-Api-Version": "2026-03-10",
      },
    });

    return response.json();
  } catch (error: unknown) {
    const errorMessage =
      error instanceof Error ? error.message : "Error desconocido";
    console.error("Error obteniendo cambios:", errorMessage);
  }
});

// 5. COMANDO GIT GENÉRICO
ipcMain.handle(
  "git-command",
  async (event: any, data: { command: string; cwd: string }) => {
    try {
      const { stdout, stderr } = await execAsync(data.command, {
        cwd: data.cwd,
        timeout: 60000,
      });

      if (stderr) {
        console.warn("Stderr en git-command:", stderr);
      }

      return stdout;
    } catch (error: unknown) {
      const errorMessage =
        error instanceof Error ? error.message : "Error desconocido";
      throw new Error(`Error ejecutando comando git: ${errorMessage}`);
    }
  },
);

// 6. CONFIGURACIÓN (Store)
ipcMain.handle(
  "set-config",
  async (event: any, data: { key: string; value: any }) => {
    try {
      store.set(data.key, data.value);
      return true;
    } catch (error) {
      console.error("Error guardando configuración:", error);
      return false;
    }
  },
);

ipcMain.handle("ai-get-personal-config", async (): Promise<PersonalAIConfigSummary> => {
  const cfg = getAiPersonalConfig();

  const summary: PersonalAIConfigSummary = {
    openai: {
      hasKey: !!cfg.openai?.encryptedKey,
      defaultModel: cfg.openai?.defaultModel ?? null,
      models: [],
      embeddingModels: [],
    },
    gemini: {
      hasKey: !!cfg.gemini?.encryptedKey,
      defaultModel: cfg.gemini?.defaultModel ?? null,
      models: [],
      embeddingModels: [],
    },
  };

  const openaiKey = decryptString(cfg.openai?.encryptedKey);
  if (openaiKey) {
    try {
      const response = await fetch("https://api.openai.com/v1/models", {
        headers: {
          Authorization: `Bearer ${openaiKey}`,
        },
      });
      if (response.ok) {
        const data = await response.json();
        summary.openai.models = mapOpenAIModels(data);
        summary.openai.embeddingModels = mapOpenAIEmbeddingModels(data);
      }
    } catch {
    }
  }

  const geminiKey = decryptString(cfg.gemini?.encryptedKey);
  if (geminiKey) {
    try {
      const response = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models?key=${encodeURIComponent(
          geminiKey,
        )}`,
      );
      if (response.ok) {
        const data = await response.json();
        summary.gemini.models = mapGeminiModels(data);
        summary.gemini.embeddingModels = mapGeminiEmbeddingModels(data);
      }
    } catch {
    }
  }

  return summary;
});

ipcMain.handle(
  "ai-save-personal-config",
  async (
    _event: any,
    data: SavePersonalAIConfigRequest,
  ): Promise<SavePersonalAIConfigResult> => {
    const cfg = getAiPersonalConfig();
    const current = cfg[data.provider] || {};
    const next: AiPersonalProviderConfig = { ...current };

    if (data.apiKey !== null && !data.apiKey.trim()) {
      delete cfg[data.provider];
      setAiPersonalConfig(cfg);
      return { success: true, models: [], defaultModelId: null };
    }

    if (data.apiKey === null && data.preferredModelId) {
      if (!current.encryptedKey) {
        return {
          success: false,
          error: "No hay una API key guardada para este proveedor.",
        };
      }
      next.defaultModel = data.preferredModelId;
      cfg[data.provider] = next;
      setAiPersonalConfig(cfg);
      return {
        success: true,
        models: [],
        defaultModelId: data.preferredModelId,
      };
    }

    if (data.apiKey && data.apiKey.trim()) {
      const apiKey = data.apiKey.trim();
      try {
        let models: ProviderModelInfo[] = [];
        if (data.provider === "openai") {
          const response = await fetch("https://api.openai.com/v1/models", {
            headers: {
              Authorization: `Bearer ${apiKey}`,
            },
          });
          if (!response.ok) {
            const body = await response.text();
            return {
              success: false,
              error: `Error validando API key de OpenAI: ${response.status} ${body}`,
            };
          }
          const json = await response.json();
          models = mapOpenAIModels(json);
        } else {
          const response = await fetch(
            `https://generativelanguage.googleapis.com/v1beta/models?key=${encodeURIComponent(
              apiKey,
            )}`,
          );
          if (!response.ok) {
            const body = await response.text();
            return {
              success: false,
              error: `Error validando API key de Gemini: ${response.status} ${body}`,
            };
          }
          const json = await response.json();
          models = mapGeminiModels(json);
        }

        const chosenModel =
          data.preferredModelId && models.some((m) => m.id === data.preferredModelId)
            ? data.preferredModelId
            : models[0]?.id ?? null;

        next.encryptedKey = encryptString(apiKey);
        next.defaultModel = chosenModel;
        cfg[data.provider] = next;
        setAiPersonalConfig(cfg);

        return {
          success: true,
          models,
          defaultModelId: chosenModel,
        };
      } catch (error: any) {
        const message =
          error instanceof Error ? error.message : String(error);
        return {
          success: false,
          error: `No se pudo validar la API key: ${message}`,
        };
      }
    }

    return {
      success: false,
      error: "Solicitud inválida para guardar configuración de IA personal.",
    };
  },
);

ipcMain.handle("get-config", async (event: any, key: string) => {
  try {
    return store.get(key);
  } catch (error) {
    console.error("Error obteniendo configuración:", error);
    return null;
  }
});

ipcMain.handle("delete-config", async (event: any, key: string) => {
  try {
    store.delete(key);
    return true;
  } catch (error) {
    console.error("Error eliminando configuración:", error);
    return false;
  }
});

// 7. UTILITARIOS (eliminado show-message)
ipcMain.handle("open-external", async (event: any, url: string) => {
  await shell.openExternal(url);
});

// 8. EVENTOS DEL MENÚ
ipcMain.on("menu:select-folder", () => {
  if (mainWindow) {
    mainWindow.webContents.send("menu:select-folder");
  }
});

ipcMain.on("menu:refresh-repos", () => {
  if (mainWindow) {
    mainWindow.webContents.send("menu:refresh-repos");
  }
});

ipcMain.on("menu:logout", () => {
  if (mainWindow) {
    mainWindow.webContents.send("menu:logout");
  }
});

// 9. VERIFICAR SI ARCHIVO EXISTE
ipcMain.handle("file-exists", async (event: any, filePath: string) => {
  try {
    await fs.access(filePath);
    return true;
  } catch {
    return false;
  }
});

// 10. ELIMINAR ARCHIVO
ipcMain.handle("delete-file", async (event: any, filePath: string) => {
  try {
    await fs.unlink(filePath);
    return true;
  } catch (error) {
    console.error("Error eliminando archivo:", error);
    return false;
  }
});

// 11. GUARDAR ARCHIVO (recibe array de bytes)
ipcMain.handle(
  "save-file",
  async (
    event: any,
    data: { content: number[]; destinationPath: string; fileName: string },
  ) => {
    try {
      // Asegurar que la carpeta destino existe
      await fs.mkdir(data.destinationPath, { recursive: true });

      const fullPath = path.join(data.destinationPath, data.fileName);

      // Convertir array de números a Buffer y guardar
      const buffer = Buffer.from(data.content);
      await fs.writeFile(fullPath, buffer);

      return { success: true, path: fullPath };
    } catch (error) {
      console.error("Error guardando archivo:", error);
      throw error;
    }
  },
);

// 11b. ESCRIBIR ARCHIVO DE TRADUCCIÓN (para guardar ediciones antes de subir)
ipcMain.handle(
  "write-translation-file",
  async (event: any, data: { filePath: string; content: string }) => {
    try {
      await fs.writeFile(data.filePath, data.content, "utf8");
      return { success: true };
    } catch (error: any) {
      return { success: false, error: error?.message || String(error) };
    }
  },
);

// 11c. LEER ARCHIVO
ipcMain.handle("read-file", async (event: any, filePath: string) => {
  try {
    const content = await fs.readFile(filePath, "utf8");
    return content;
  } catch (error: any) {
    console.error("Error leyendo archivo:", error);
    throw new Error(`Error leyendo archivo: ${error.message}`);
  }
});

// 12. SUBIR TRADUCCIÓN AL REPOSITORIO (git add/commit/push)
ipcMain.handle(
  "ai-upload-translation",
  async (
    event: any,
    data: { repoPath: string; filePath: string; commitMessage?: string },
  ) => {
    const { repoPath, filePath, commitMessage } = data;
    const message = commitMessage || "Update localization translations";

    const runGit = async (command: string) => {
      const { stdout, stderr } = await execAsync(command, {
        cwd: repoPath,
        timeout: 60000,
      });
      return { stdout, stderr };
    };

    try {
      // git add
      await runGit(`git add "${filePath}"`);

      // git commit
      let commitOk = true;
      try {
        const { stderr } = await runGit(
          `git commit -m "${message.replace(/"/g, '\\"')}"`,
        );
        if (stderr && stderr.includes("nothing to commit")) {
          commitOk = false;
        }
      } catch (err: any) {
        const msg = String(err?.message || "");
        if (msg.includes("nothing to commit")) {
          commitOk = false;
        } else {
          throw err;
        }
      }

      // git push origin main (aunque no haya commit nuevo, será un no-op)
      const { stdout, stderr } = await runGit("git push origin main");

      return {
        success: true,
        commitCreated: commitOk,
        stdout,
        stderr,
      };
    } catch (error: any) {
      const messageError =
        error instanceof Error ? error.message : String(error);
      return {
        success: false,
        error: messageError,
      };
    }
  },
);

// ========== INICIALIZACIÓN ==========
app.whenReady().then(() => {
  createWindow();
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    app.quit();
  }
});

app.on("activate", () => {
  if (mainWindow === null) {
    createWindow();
  }
});