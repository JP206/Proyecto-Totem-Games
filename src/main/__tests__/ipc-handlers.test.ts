describe("main ipc handlers", () => {
  const handlers = new Map<string, (...args: any[]) => any>();
  const writeFileMock = jest.fn();
  const translateFileInMainMock = jest.fn();
  const spellCheckFileInMainMock = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
    handlers.clear();
    jest.resetModules();

    jest.doMock("electron", () => {
      const webContents = {
        openDevTools: jest.fn(),
        send: jest.fn(),
      };
      const browserWindow = {
        loadFile: jest.fn(),
        webContents,
      };
      return {
        app: {
          isPackaged: true,
          whenReady: jest.fn().mockResolvedValue(undefined),
          on: jest.fn(),
          quit: jest.fn(),
        },
        BrowserWindow: jest.fn(() => browserWindow),
        ipcMain: {
          handle: jest.fn((channel: string, fn: (...args: any[]) => any) => {
            handlers.set(channel, fn);
          }),
          on: jest.fn(),
        },
        dialog: {
          showOpenDialog: jest.fn().mockResolvedValue({
            canceled: true,
            filePaths: [],
          }),
          showMessageBox: jest.fn().mockResolvedValue({}),
        },
        shell: {
          openExternal: jest.fn().mockResolvedValue(undefined),
        },
      };
    });

    jest.doMock("fs/promises", () => ({
      __esModule: true,
      default: {
        readdir: jest.fn(),
        stat: jest.fn(),
        access: jest.fn(),
        unlink: jest.fn(),
        mkdir: jest.fn(),
        writeFile: writeFileMock,
      },
    }));

    jest.doMock("child_process", () => ({
      exec: jest.fn(
        (
          _cmd: string,
          _opts: any,
          cb: (err: any, out: string, errOut: string) => void,
        ) => cb(null, "", ""),
      ),
    }));

    jest.doMock("electron-store", () =>
      jest.fn().mockImplementation(() => ({
        get: jest.fn(),
        set: jest.fn(),
        delete: jest.fn(),
      })),
    );

    jest.doMock("../ai/translation", () => ({
      translateFileInMain: translateFileInMainMock,
    }));
    jest.doMock("../ai/spellcheck", () => ({
      spellCheckFileInMain: spellCheckFileInMainMock,
    }));

    require("../index");
  });

  it("calls translateFileInMain with payload and sender", async () => {
    const event = {
      sender: {
        send: jest.fn(),
        isDestroyed: jest.fn().mockReturnValue(false),
      },
    };
    const payload = { filePath: "/repo/localizar.csv", targetLanguages: [] };
    translateFileInMainMock.mockResolvedValue({ ok: true });

    const result = await handlers.get("ai-translate-file")?.(event, payload);

    expect(translateFileInMainMock).toHaveBeenCalledWith(payload, event.sender);
    expect(result).toEqual({ ok: true });
  });

  it("calls spellCheckFileInMain with payload and sender", async () => {
    const event = {
      sender: {
        send: jest.fn(),
        isDestroyed: jest.fn().mockReturnValue(false),
      },
    };
    const payload = { filePath: "/repo/localizar.csv" };
    spellCheckFileInMainMock.mockResolvedValue({ ok: true });

    const result = await handlers.get("ai-spellcheck-file")?.(event, payload);

    expect(spellCheckFileInMainMock).toHaveBeenCalledWith(
      payload,
      event.sender,
    );
    expect(result).toEqual({ ok: true });
  });

  it("write-translation-file returns success true", async () => {
    writeFileMock.mockResolvedValue(undefined);

    const result = await handlers.get("write-translation-file")?.(
      {},
      { filePath: "/repo/localizar.csv", content: "k,v" },
    );

    expect(writeFileMock).toHaveBeenCalledWith(
      "/repo/localizar.csv",
      "k,v",
      "utf8",
    );
    expect(result).toEqual({ success: true });
  });

  it("write-translation-file returns success false with error", async () => {
    writeFileMock.mockRejectedValue(new Error("disk error"));

    const result = await handlers.get("write-translation-file")?.(
      {},
      { filePath: "/repo/localizar.csv", content: "k,v" },
    );

    expect(result).toEqual({ success: false, error: "disk error" });
  });
});
