import { parseCSV, stringifyCSV } from "../csv";
import {
  SIMPLE_CSV,
  SIMPLE_ROWS,
  CSV_WITH_COMMAS,
  ROWS_WITH_COMMAS,
  CSV_EMPTY,
  CSV_HEADER_ONLY,
  ROWS_HEADER_ONLY,
  CSV_CRLF,
  ROWS_CRLF,
} from "./fixtures/csvFixtures";

describe("parseCSV", () => {
  it("parses simple comma-separated content", () => {
    expect(parseCSV(SIMPLE_CSV)).toEqual(SIMPLE_ROWS);
  });

  it("parses quoted fields containing commas", () => {
    expect(parseCSV(CSV_WITH_COMMAS)).toEqual(ROWS_WITH_COMMAS);
  });

  it("returns single empty cell row for empty string", () => {
    expect(parseCSV(CSV_EMPTY)).toEqual([[""]]);
  });

  it("parses header-only line", () => {
    expect(parseCSV(CSV_HEADER_ONLY)).toEqual(ROWS_HEADER_ONLY);
  });

  it("handles CRLF line endings", () => {
    expect(parseCSV(CSV_CRLF)).toEqual(ROWS_CRLF);
  });

  it("handles escaped double quotes inside quoted field", () => {
    const csv = 'k,v\n"say ""hi""",ok';
    expect(parseCSV(csv)).toEqual([
      ["k", "v"],
      ['say "hi"', "ok"],
    ]);
  });

  it("handles newline inside quoted field", () => {
    const csv = 'a,b\n"line1\nline2",c';
    expect(parseCSV(csv)).toEqual([
      ["a", "b"],
      ["line1\nline2", "c"],
    ]);
  });
});

describe("stringifyCSV", () => {
  it("serializes rows to comma-delimited string", () => {
    expect(stringifyCSV(SIMPLE_ROWS)).toBe(SIMPLE_CSV);
  });

  it("quotes fields that contain commas", () => {
    expect(stringifyCSV(ROWS_WITH_COMMAS)).toBe(CSV_WITH_COMMAS);
  });

  it("uses CRLF between rows", () => {
    const out = stringifyCSV(SIMPLE_ROWS);
    expect(out).toContain("\r\n");
    expect(out.split("\r\n").length).toBe(3);
  });

  it("escapes double quotes in quoted fields", () => {
    const rows = [
      ["k", "v"],
      ['say "hi"', "ok"],
    ];
    const out = stringifyCSV(rows);
    expect(parseCSV(out)).toEqual(rows);
  });

  it("roundtrip: parse then stringify preserves data", () => {
    const csv = "Clave,ESP,EN\n1,Hola,Hello\n2,Mundo,World";
    const rows = parseCSV(csv);
    expect(parseCSV(stringifyCSV(rows))).toEqual(rows);
  });

  it("handles null/undefined cells as empty string", () => {
    const rows = [
      ["a", "b"],
      ["1", null as any],
      ["2", undefined as any],
    ];
    const out = stringifyCSV(rows);
    expect(parseCSV(out)).toEqual([
      ["a", "b"],
      ["1", ""],
      ["2", ""],
    ]);
  });
});
