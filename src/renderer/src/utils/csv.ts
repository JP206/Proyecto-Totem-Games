/**
 * Minimal CSV parse/stringify for translation preview (handles quoted fields).
 */

export function parseCSV(csv: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = "";
  let inQuotes = false;
  for (let i = 0; i < csv.length; i++) {
    const c = csv[i];
    if (inQuotes) {
      if (c === '"') {
        if (csv[i + 1] === '"') {
          cell += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        cell += c;
      }
    } else {
      if (c === '"') {
        inQuotes = true;
      } else if (c === ",") {
        row.push(cell);
        cell = "";
      } else if (c === "\n" || c === "\r") {
        if (c === "\r" && csv[i + 1] === "\n") i++;
        row.push(cell);
        cell = "";
        rows.push(row);
        row = [];
      } else {
        cell += c;
      }
    }
  }
  row.push(cell);
  if (row.length > 0 || cell !== "") rows.push(row);
  return rows;
}

/** Delimiter for CSV output. Use ";" so Excel (e.g. European locale) opens with columns. */
const DEFAULT_DOWNLOAD_DELIMITER = ";";

export function stringifyCSV(
  rows: string[][],
  delimiter: string = ",",
): string {
  const needQuotes = (s: string) =>
    delimiter === ","
      ? s.includes(",") ||
        s.includes('"') ||
        s.includes("\n") ||
        s.includes("\r")
      : s.includes(delimiter) ||
        s.includes('"') ||
        s.includes("\n") ||
        s.includes("\r");
  return rows
    .map((row) =>
      row
        .map((cell) => {
          const s = String(cell ?? "");
          if (needQuotes(s)) {
            return '"' + s.replace(/"/g, '""') + '"';
          }
          return s;
        })
        .join(delimiter),
    )
    .join("\r\n");
}

/** Delimiter to use for the "Download CSV" button so Excel opens with columns. */
export function getDownloadDelimiter(): string {
  return DEFAULT_DOWNLOAD_DELIMITER;
}
