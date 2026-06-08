import fs from "fs/promises";
import path from "path";
import { parse as csvParse } from "csv-parse/sync";
import * as XLSX from "xlsx";
import { detectDelimiter } from "./csvDelimiter";

export async function readLocalizeFileHeaders(
  filePath: string,
): Promise<string[]> {
  const ext = path.extname(filePath).toLowerCase();
  let rows: unknown[][] = [];

  if (ext === ".csv") {
    const raw = await fs.readFile(filePath, "utf8");
    const delimiter = detectDelimiter(raw);
    rows = csvParse(raw, {
      delimiter,
      skip_empty_lines: true,
      to: 1,
    }) as unknown[][];
  } else if (ext === ".xlsx") {
    const buf = await fs.readFile(filePath);
    const workbook = XLSX.read(buf, { type: "buffer" });
    const sheetName = workbook.SheetNames[0];
    const sheet = workbook.Sheets[sheetName];
    rows = XLSX.utils.sheet_to_json(sheet, {
      header: 1,
      blankrows: false,
    }) as unknown[][];
  } else {
    return [];
  }

  const header = rows[0] || [];
  return header.map((cell) => String(cell ?? "").trim());
}
