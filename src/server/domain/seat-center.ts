/** Zero-based column after which the boundary falls; -1 means before the first column. */
export function effectiveCenterAfterColumn(columns: number, configured: number | null): number {
  if (columns < 1) return -1;
  return configured === null
    ? Math.floor(columns / 2) - 1
    : Math.min(Math.max(configured, 0), columns - 1);
}
