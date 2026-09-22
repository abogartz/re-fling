import { CSVRow } from "../csv/parser";

/**
 * Exclude any row whose URL matches one of the given regex patterns
 * (case-insensitive). Invalid patterns are treated as matching nothing.
 * Shared by the engine (actual replay) and the preview/chart (expected).
 */
export function filterRowsByPatterns(rows: CSVRow[], patterns: string[]): CSVRow[] {
  if (!patterns || patterns.length === 0) {
    return rows;
  }
  return rows.filter(
    (row) =>
      !patterns.some((pattern) => {
        try {
          return new RegExp(pattern, "i").test(row.url);
        } catch {
          return false;
        }
      }),
  );
}

/**
 * Split a comma-joined filterPatterns string (AppState) into regex patterns.
 * Single source of truth for the replay config and the preview config so
 * both always send the same filter set.
 */
export function splitFilterPatterns(patterns: string | undefined): string[] {
  if (!patterns) {
    return [];
  }
  return patterns
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
}