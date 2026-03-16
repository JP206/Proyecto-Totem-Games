export const readFileMock = jest.fn();
export const writeFileMock = jest.fn();

export default {
  readFile: readFileMock,
  writeFile: writeFileMock,
};
