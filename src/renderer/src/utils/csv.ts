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

export function stringifyCSV(rows: string[][]): string {
  return rows
    .map((row) =>
      row
        .map((cell) => {
          const s = String(cell ?? "");
          if (
            s.includes(",") ||
            s.includes('"') ||
            s.includes("\n") ||
            s.includes("\r")
          ) {
            return '"' + s.replace(/"/g, '""') + '"';
          }
          return s;
        })
        .join(","),
    )
    .join("\r\n");
}
