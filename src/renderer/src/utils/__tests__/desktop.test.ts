import DesktopManager from "../desktop";

describe("DesktopManager", () => {
  let selectFolderCb: (() => void) | undefined;
  let refreshReposCb: (() => void) | undefined;
  let logoutCb: (() => void) | undefined;

  const electronAPI = {
    selectFolder: jest.fn().mockResolvedValue("C:/repo"),
    readFolder: jest.fn().mockResolvedValue([]),
    fileExists: jest.fn().mockResolvedValue(true),
    deleteFile: jest.fn().mockResolvedValue(true),
    saveFile: jest
      .fn()
      .mockResolvedValue({ success: true, path: "C:/out/file.csv" }),
    translateFile: jest
      .fn()
      .mockResolvedValue({
        filePath: "",
        csvContent: "",
        preview: [],
        stats: { totalRows: 0, translatedRows: 0 },
      }),
    spellCheckFile: jest
      .fn()
      .mockResolvedValue({
        filePath: "",
        csvContent: "",
        preview: [],
        stats: { totalRows: 0, correctedRows: 0 },
      }),
    uploadTranslation: jest.fn().mockResolvedValue({ success: true }),
    writeTranslationFile: jest.fn().mockResolvedValue({ success: true }),
    onSpellCheckProgress: jest.fn().mockReturnValue(() => undefined),
    onTranslationProgress: jest.fn().mockReturnValue(() => undefined),
    cloneRepository: jest.fn(),
    gitCommand: jest.fn().mockResolvedValue("ok"),
    getIssues: jest.fn(),
    markIssueAsResolved: jest.fn(),
    editIssue: jest.fn(),
    createIssue: jest.fn(),
    getChanges: jest.fn(),
    getDiff: jest.fn(),
    setConfig: jest.fn().mockResolvedValue(true),
    getConfig: jest.fn().mockResolvedValue("v"),
    deleteConfig: jest.fn().mockResolvedValue(true),
    openExternal: jest.fn().mockResolvedValue(undefined),
    showMessage: jest.fn().mockResolvedValue(undefined),
    onMenuSelectFolder: jest.fn((cb: () => void) => {
      selectFolderCb = cb;
    }),
    onMenuRefreshRepos: jest.fn((cb: () => void) => {
      refreshReposCb = cb;
    }),
    onMenuLogout: jest.fn((cb: () => void) => {
      logoutCb = cb;
    }),
  };

  beforeEach(() => {
    jest.clearAllMocks();
    selectFolderCb = undefined;
    refreshReposCb = undefined;
    logoutCb = undefined;
    (DesktopManager as any).instance = undefined;
    (global as any).CustomEvent = class {
      type: string;
      constructor(type: string) {
        this.type = type;
      }
    };
    (global as any).window = {
      electronAPI,
      dispatchEvent: jest.fn(),
    };
  });

  it("returns singleton instance", () => {
    const a = DesktopManager.getInstance();
    const b = DesktopManager.getInstance();

    expect(a).toBe(b);
    expect(electronAPI.onMenuSelectFolder).toHaveBeenCalledTimes(1);
    expect(electronAPI.onMenuRefreshRepos).toHaveBeenCalledTimes(1);
    expect(electronAPI.onMenuLogout).toHaveBeenCalledTimes(1);
  });

  it("dispatches menu events from electron callbacks", () => {
    DesktopManager.getInstance();
    selectFolderCb?.();
    refreshReposCb?.();
    logoutCb?.();

    const dispatchEvent = (global as any).window.dispatchEvent;
    expect(dispatchEvent).toHaveBeenCalledTimes(3);
    expect(dispatchEvent.mock.calls[0][0].type).toBe("desktop:select-folder");
    expect(dispatchEvent.mock.calls[1][0].type).toBe("desktop:refresh-repos");
    expect(dispatchEvent.mock.calls[2][0].type).toBe("desktop:logout");
  });

  it("forwards selectFolder and readFolder", async () => {
    const manager = DesktopManager.getInstance();
    const folder = await manager.selectFolder();
    await manager.readFolder("C:/repo");

    expect(folder).toBe("C:/repo");
    expect(electronAPI.selectFolder).toHaveBeenCalled();
    expect(electronAPI.readFolder).toHaveBeenCalledWith("C:/repo");
  });

  it("transforms path and bytes for saveFile", async () => {
    const manager = DesktopManager.getInstance();
    const fakeFile = {
      arrayBuffer: jest
        .fn()
        .mockResolvedValue(Uint8Array.from([1, 2, 3]).buffer),
    };

    await manager.saveFile(fakeFile as any, "C:/repo/sub/file.csv");

    expect(electronAPI.saveFile).toHaveBeenCalledWith({
      content: [1, 2, 3],
      destinationPath: "C:/repo/sub",
      fileName: "file.csv",
    });
  });

  it("forwards translation and spellcheck calls", async () => {
    const manager = DesktopManager.getInstance();
    await manager.translateFile({
      repoPath: "/repo",
      projectName: "p",
      filePath: "/repo/localizar.csv",
      targetLanguages: [{ code: "es", name: "Spanish" }],
      contexts: [],
      glossaries: [],
      providerOptions: {
        mode: "openai",
        openaiModel: "gpt-4",
        geminiModel: "gemini-1.5",
      },
    });
    await manager.spellCheckFile({
      filePath: "/repo/localizar.csv",
      providerOptions: {
        mode: "openai",
        openaiModel: "gpt-4",
        geminiModel: "gemini-1.5",
      },
    });

    expect(electronAPI.translateFile).toHaveBeenCalledTimes(1);
    expect(electronAPI.spellCheckFile).toHaveBeenCalledTimes(1);
  });

  it("forwards progress subscriptions", () => {
    const manager = DesktopManager.getInstance();
    const cb = jest.fn();
    manager.onSpellCheckProgress(cb);
    manager.onTranslationProgress(cb);

    expect(electronAPI.onSpellCheckProgress).toHaveBeenCalledWith(cb);
    expect(electronAPI.onTranslationProgress).toHaveBeenCalledWith(cb);
  });

  it("forwards remaining git and config methods", async () => {
    const manager = DesktopManager.getInstance();
    const repoInfo = { repoName: "n", repoOwner: "o", token: "t" };
    const issueData = {
      title: "title",
      description: "desc",
      id: 1,
      assignees: [],
      labels: [],
    };

    await manager.fileExists("C:/repo/file.txt");
    await manager.deleteFile("C:/repo/file.txt");
    await manager.cloneRepository({ url: "u", destination: "d", token: "t" });
    await manager.getIssues(repoInfo as any, "bug");
    await manager.markIssueAsResolved(1, repoInfo as any);
    await manager.editIssue(issueData as any, repoInfo as any);
    await manager.createIssue(issueData as any, repoInfo as any);
    await manager.getChanges(repoInfo as any);
    await manager.getDiff("a", "b", repoInfo as any);
    await manager.gitCommand({ command: "git status", cwd: "C:/repo" });
    await manager.setConfig("k", "v");
    await manager.getConfig("k");
    await manager.deleteConfig("k");
    await manager.showMessage("msg");
    await manager.openInBrowser("https://example.com");
    await manager.uploadTranslation({ repoPath: "/r", filePath: "/r/f.csv" });
    await manager.writeTranslationFile({
      filePath: "/r/f.csv",
      content: "a,b",
    });

    expect(electronAPI.fileExists).toHaveBeenCalledWith("C:/repo/file.txt");
    expect(electronAPI.deleteFile).toHaveBeenCalledWith("C:/repo/file.txt");
    expect(electronAPI.cloneRepository).toHaveBeenCalled();
    expect(electronAPI.getIssues).toHaveBeenCalledWith(repoInfo, "bug");
    expect(electronAPI.markIssueAsResolved).toHaveBeenCalledWith(1, repoInfo);
    expect(electronAPI.editIssue).toHaveBeenCalledWith(issueData, repoInfo);
    expect(electronAPI.createIssue).toHaveBeenCalledWith(issueData, repoInfo);
    expect(electronAPI.getChanges).toHaveBeenCalledWith(repoInfo);
    expect(electronAPI.getDiff).toHaveBeenCalledWith("a", "b", repoInfo);
    expect(electronAPI.gitCommand).toHaveBeenCalledWith({
      command: "git status",
      cwd: "C:/repo",
    });
    expect(electronAPI.setConfig).toHaveBeenCalledWith("k", "v");
    expect(electronAPI.getConfig).toHaveBeenCalledWith("k");
    expect(electronAPI.deleteConfig).toHaveBeenCalledWith("k");
    expect(electronAPI.showMessage).toHaveBeenCalledWith({
      type: "info",
      title: "GitHub Desktop",
      message: "msg",
    });
    expect(electronAPI.openExternal).toHaveBeenCalledWith(
      "https://example.com",
    );
    expect(electronAPI.uploadTranslation).toHaveBeenCalled();
    expect(electronAPI.writeTranslationFile).toHaveBeenCalled();
  });
});
