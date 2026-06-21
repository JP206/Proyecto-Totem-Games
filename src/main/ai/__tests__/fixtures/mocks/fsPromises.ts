export const readFileMock = jest.fn();
export const writeFileMock = jest.fn();
export const mkdirMock = jest.fn().mockResolvedValue(undefined);

export default {
  readFile: readFileMock,
  writeFile: writeFileMock,
  mkdir: mkdirMock,
};
