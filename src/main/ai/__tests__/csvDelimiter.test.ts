import { detectDelimiter } from "../csvDelimiter";

describe("detectDelimiter", () => {
  it("returns comma when first line is empty", () => {
    expect(detectDelimiter("")).toBe(",");
    expect(detectDelimiter("\n\n")).toBe(",");
  });

  it("detects comma in simple CSV header", () => {
    const raw = "col1,col2,col3\n1,2,3";
    expect(detectDelimiter(raw)).toBe(",");
  });

  it("ignores delimiters inside quotes and detects semicolon", () => {
    const raw = 'col1;col2;col3\n"1,2";"3,4";"5,6"';
    expect(detectDelimiter(raw)).toBe(";");
  });

  it("detects tab-delimited header", () => {
    const raw = "col1\tcol2\tcol3\n1\t2\t3";
    expect(detectDelimiter(raw)).toBe("\t");
  });
});

