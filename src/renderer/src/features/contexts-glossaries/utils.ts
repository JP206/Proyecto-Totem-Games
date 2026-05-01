/** Normalize a file name for display in lists (trim, collapse internal spaces). */
export function displayFileLabel(name: string): string {
  return name.replace(/\s+/g, " ").trim();
}
