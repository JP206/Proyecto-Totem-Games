/**
 * Row was not processed for this language in the last run (sheet already had text in that column).
 */
export function isRowPreExistingTranslation(
  rowIndex: number,
  langCode: string,
  editableRows: string[][],
  previewRows: Array<{
    rowIndex?: number;
    perLanguage?: Record<string, unknown>;
  }>,
  sourceCol: number,
  langCol: number | undefined,
): boolean {
  if (langCol === undefined) return false;
  const source = String(editableRows[rowIndex]?.[sourceCol] ?? "").trim();
  const target = String(editableRows[rowIndex]?.[langCol] ?? "").trim();
  if (!source || !target) return false;
  const pr = previewRows.find((p) => p.rowIndex === rowIndex);
  if (!pr) return false;
  return pr.perLanguage?.[langCode] == null;
}
