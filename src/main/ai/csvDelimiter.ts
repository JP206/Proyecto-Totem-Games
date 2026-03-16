/**
 * Detect CSV delimiter from raw content (first line).
 * Enables support for semicolon (;) and tab-delimited files (e.g. European Excel export).
 */

const CANDIDATES = [",", ";", "\t"] as const;
export type CsvDelimiter = (typeof CANDIDATES)[number];

function countDelimiterInLine(line: string, delim: string): number {
  let count = 0;
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const c = line[i];
    if (c === '"') {
      inQuotes = !inQuotes;
    } else if (!inQuotes && c === delim) {
      count++;
    }
  }
  return count;
}

/**
 * Detect the most likely delimiter from the first line of CSV content.
 * Defaults to comma if unclear. Used so semicolon/tab CSVs parse correctly.
 */
export function detectDelimiter(raw: string): CsvDelimiter {
  const firstLine = raw.split(/\r?\n/)[0] ?? "";
  if (!firstLine.trim()) return ",";

  let best: CsvDelimiter = ",";
  let bestCount = 0;

  for (const d of CANDIDATES) {
    const n = countDelimiterInLine(firstLine, d);
    if (n > bestCount) {
      bestCount = n;
      best = d;
    }
  }

  return best;
}
