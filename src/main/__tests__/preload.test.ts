describe("preload", () => {
  const invoke = jest.fn();
  const on = jest.fn();
  const removeListener = jest.fn();
  const exposeInMainWorld = jest.fn();
  let exposedApi: any;

  beforeEach(() => {
    jest.clearAllMocks();
    exposedApi = undefined;
    exposeInMainWorld.mockImplementation((_key: string, api: any) => {
      exposedApi = api;
    });
    jest.resetModules();
    jest.doMock("electron", () => ({
      contextBridge: { exposeInMainWorld },
      ipcRenderer: { invoke, on, removeListener },
    }));
    require("../preload");
  });

  it("exposes electronAPI", () => {
    expect(exposeInMainWorld).toHaveBeenCalledWith(
      "electronAPI",
      expect.any(Object),
    );
    expect(exposedApi).toBeDefined();
  });

  it("maps translate and spellcheck channels", async () => {
    const payload = { filePath: "/repo/localizar.csv" };

    await exposedApi.translateFile(payload);
    await exposedApi.spellCheckFile(payload);

    expect(invoke).toHaveBeenCalledWith("ai-translate-file", payload);
    expect(invoke).toHaveBeenCalledWith("ai-spellcheck-file", payload);
  });

  it("maps upload and write translation channels", async () => {
    const uploadPayload = {
      repoPath: "/repo",
      filePath: "/repo/localizar.csv",
    };
    const writePayload = { filePath: "/repo/localizar.csv", content: "a,b" };

    await exposedApi.uploadTranslation(uploadPayload);
    await exposedApi.writeTranslationFile(writePayload);

    expect(invoke).toHaveBeenCalledWith("ai-upload-translation", uploadPayload);
    expect(invoke).toHaveBeenCalledWith("write-translation-file", writePayload);
  });

  it("registers and unregisters progress listeners", () => {
    const callback = jest.fn();
    on.mockImplementation(
      (_channel: string, handler: (...args: any[]) => void) => {
        handler({}, { percent: 50 });
      },
    );

    const unsubscribeSpell = exposedApi.onSpellCheckProgress(callback);
    const unsubscribeTranslation = exposedApi.onTranslationProgress(callback);

    expect(on).toHaveBeenCalledWith(
      "spellcheck-progress",
      expect.any(Function),
    );
    expect(on).toHaveBeenCalledWith(
      "translation-progress",
      expect.any(Function),
    );
    expect(callback).toHaveBeenCalledWith({ percent: 50 });

    unsubscribeSpell();
    unsubscribeTranslation();

    expect(removeListener).toHaveBeenCalledWith(
      "spellcheck-progress",
      expect.any(Function),
    );
    expect(removeListener).toHaveBeenCalledWith(
      "translation-progress",
      expect.any(Function),
    );
  });

  it("maps menu listener channels", () => {
    const cb = jest.fn();
    on.mockImplementation(
      (_channel: string, handler: (...args: any[]) => void) => {
        handler();
      },
    );

    exposedApi.onMenuSelectFolder(cb);
    exposedApi.onMenuRefreshRepos(cb);
    exposedApi.onMenuLogout(cb);

    expect(on).toHaveBeenCalledWith("menu:select-folder", expect.any(Function));
    expect(on).toHaveBeenCalledWith("menu:refresh-repos", expect.any(Function));
    expect(on).toHaveBeenCalledWith("menu:logout", expect.any(Function));
    expect(cb).toHaveBeenCalledTimes(3);
  });

  it("maps filesystem, git, config and utility invoke channels", async () => {
    const repoInfo = { repoName: "n", repoOwner: "o", token: "t" };
    const issueData = {
      title: "title",
      description: "desc",
      id: 1,
      assignees: [],
      labels: [],
    };

    await exposedApi.selectFolder();
    await exposedApi.readFolder("C:/repo");
    await exposedApi.cloneRepository({
      url: "u",
      destination: "d",
      token: "t",
    });
    await exposedApi.getIssues(repoInfo, "bug");
    await exposedApi.markIssueAsResolved(1, repoInfo);
    await exposedApi.editIssue(issueData, repoInfo);
    await exposedApi.createIssue(issueData, repoInfo);
    await exposedApi.gitCommand({ command: "git status", cwd: "C:/repo" });
    await exposedApi.getChanges(repoInfo);
    await exposedApi.getDiff("a", "b", repoInfo);
    await exposedApi.setConfig("k", "v");
    await exposedApi.getConfig("k");
    await exposedApi.deleteConfig("k");
    await exposedApi.openExternal("https://example.com");
    await exposedApi.fileExists("C:/repo/file.txt");
    await exposedApi.deleteFile("C:/repo/file.txt");
    await exposedApi.saveFile({
      content: [1, 2, 3],
      destinationPath: "C:/repo",
      fileName: "f.csv",
    });

    expect(invoke).toHaveBeenCalledWith("select-folder");
    expect(invoke).toHaveBeenCalledWith("read-folder", "C:/repo");
    expect(invoke).toHaveBeenCalledWith("git-clone", {
      url: "u",
      destination: "d",
      token: "t",
    });
    expect(invoke).toHaveBeenCalledWith("git-get-issues", repoInfo, "bug");
    expect(invoke).toHaveBeenCalledWith(
      "git-mark-issue-as-resolved",
      1,
      repoInfo,
    );
    expect(invoke).toHaveBeenCalledWith("git-edit-issue", issueData, repoInfo);
    expect(invoke).toHaveBeenCalledWith(
      "git-create-issue",
      issueData,
      repoInfo,
    );
    expect(invoke).toHaveBeenCalledWith("git-command", {
      command: "git status",
      cwd: "C:/repo",
    });
    expect(invoke).toHaveBeenCalledWith("git-get-changes", repoInfo);
    expect(invoke).toHaveBeenCalledWith("git-get-diff", "a", "b", repoInfo);
    expect(invoke).toHaveBeenCalledWith("set-config", { key: "k", value: "v" });
    expect(invoke).toHaveBeenCalledWith("get-config", "k");
    expect(invoke).toHaveBeenCalledWith("delete-config", "k");
    expect(invoke).toHaveBeenCalledWith("open-external", "https://example.com");
    expect(invoke).toHaveBeenCalledWith("file-exists", "C:/repo/file.txt");
    expect(invoke).toHaveBeenCalledWith("delete-file", "C:/repo/file.txt");
    expect(invoke).toHaveBeenCalledWith("save-file", {
      content: [1, 2, 3],
      destinationPath: "C:/repo",
      fileName: "f.csv",
    });
    expect(["win32", "darwin", "linux"]).toContain(exposedApi.platform);
    expect(typeof exposedApi.isDev).toBe("boolean");
  });
});
