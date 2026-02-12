// src/main/index.ts
import { app, BrowserWindow, ipcMain, dialog, shell } from "electron";
import path from "path";
import fs from "fs/promises";
import { exec } from "child_process";
import { promisify } from "util";
import Store from "electron-store";
import { IssueData, RepoInformation } from "../renderer/src/utils/electron";

const execAsync = promisify(exec);
const store = new Store();

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

// OBTENER ISSUES GIT
ipcMain.handle(
  "git-get-issues",
  async (
    event: any,
    data: {
      repoName: string;
      repoOwner: string;
      token: string;
    },
    label: string
  ) => {
    try {
      const url: string = `https://api.github.com/repos/${data.repoOwner}/${data.repoName}/issues?labels=${label}`;
      
      const response = await fetch(url, {
        method: "GET",
        headers: {
          "Accept": "application/vnd.github+json",
          "Authorization": `Bearer ${data.token}`,
          "X-GitHub-Api-Version": "2022-11-28",
        },
      });

      return response.json();
            
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

// MARCAR ISSUE COMO RESUELTO
ipcMain.handle(
  "git-mark-issue-as-resolved",
  async (
    event: any,
    issueId: number,
    data: RepoInformation
  ) => {
    try {
      const url: string = `https://api.github.com/repos/${data.repoOwner}/${data.repoName}/issues/${issueId}`;
      
      const response = await fetch(url, {
        method: "PATCH",
        headers: {
          "Accept": "application/vnd.github+json",
          "Authorization": `Bearer ${data.token}`,
          "X-GitHub-Api-Version": "2022-11-28",
        },
        body: JSON.stringify({
          "state": "closed"
        })
      });

      return response.json();
            
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

// EDITAR ISSUE
ipcMain.handle(
  "git-edit-issue",
  async (
    event: any,
    issueData: IssueData,
    data: RepoInformation
  ) => {
    try {
      const url: string = `https://api.github.com/repos/${data.repoOwner}/${data.repoName}/issues/${issueData.id}`;
      
      const response = await fetch(url, {
        method: "PATCH",
        headers: {
          "Accept": "application/vnd.github+json",
          "Authorization": `Bearer ${data.token}`,
          "X-GitHub-Api-Version": "2022-11-28",
        },
        body: JSON.stringify({
          ...(issueData.title != null && { title: issueData.title }),
          ...(issueData.description != null && { body: issueData.description }),
          ...(issueData.assignees != null && { assignees: issueData.assignees }),
        })
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
  async (
    event: any,
    issueData: IssueData,
    data: RepoInformation
  ) => {
    try {
      const url: string = `https://api.github.com/repos/${data.repoOwner}/${data.repoName}/issues`;
      
      const response = await fetch(url, {
        method: "POST",
        headers: {
          "Accept": "application/vnd.github+json",
          "Authorization": `Bearer ${data.token}`,
          "X-GitHub-Api-Version": "2022-11-28",
        },
        body: JSON.stringify({
          ...{ title: issueData.title },
          ...(issueData.description != null && { body: issueData.description }),
          ...(issueData.assignees != null && { assignees: issueData.assignees }),
          ...(issueData.labels != null && { labels: issueData.labels }),
        })
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
ipcMain.handle(
  "git-get-notes",
  async (
    event: any,
    data: {
      repoName: string;
      repoOwner: string;
      token: string;
    },
  ) => {
    try {
      const url: string = `https://api.github.com/repos/${data.repoOwner}/${data.repoName}/issues?labels=documentation`;
      
      const response = await fetch(url, {
        method: "GET",
        headers: {
          "Accept": "application/vnd.github+json",
          "Authorization": `Bearer ${data.token}`,
          "X-GitHub-Api-Version": "2022-11-28",
        },
      });

      return response.json();
            
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

// 7. UTILITARIOS
ipcMain.handle("open-external", async (event: any, url: string) => {
  await shell.openExternal(url);
});

ipcMain.handle(
  "show-message",
  async (
    event: any,
    data: {
      type: "info" | "error" | "warning" | "question";
      title: string;
      message: string;
    },
  ) => {
    if (!mainWindow) return;

    const options: any = {
      type: data.type,
      title: data.title,
      message: data.message,
      buttons: ["OK"],
    };

    if (data.type === "question") {
      options.buttons = ["Sí", "No"];
    }

    await dialog.showMessageBox(mainWindow, options);
  },
);

// 8. EVENTOS DEL MENÚ (para ser disparados desde el menú de la aplicación)
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
