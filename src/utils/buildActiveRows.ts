import { CSVRow } from "../csv/parser";

export interface BuildActiveRowsConfig {
  speed: number;
  duration: number | null;
}

export interface BuildActiveRowsResult {
  activeRows: CSVRow[];
  delayMs: number;
}

/**
 * Build an array of rows that fits the target duration.
 * - If CSV span > duration: crop to first N rows whose cumulative time <= duration
 * - If CSV span < duration: repeat (cycle) the array until it fills the duration,
 *   preserving original inter-row gaps and adding average inter-row gap between cycles
 */
export function buildActiveRows(
  rows: CSVRow[],
  config: BuildActiveRowsConfig,
): BuildActiveRowsResult {
  if (rows.length === 0) {
    return { activeRows: [], delayMs: 0 };
  }

  const targetDuration =
    config.duration ?? calculateActualDuration(rows);
  if (targetDuration <= 0 || rows.length === 1) {
    return { activeRows: [...rows], delayMs: 0 };
  }

  const csvSpan = calculateActualDuration(rows);

  if (csvSpan < targetDuration) {
    // CSV is shorter than target → repeat/cycle to fill duration.
    // Preserve internal gaps within each cycle; add uniform gap between cycles.
    // Gap = average gap from original CSV, adjusted for speed.
    const avgGap = csvSpan > 0 ? csvSpan / (rows.length - 1) : 0;
    const effectiveGap = avgGap / (config.speed ?? 1);

    const firstRowTime = new Date(rows[0].datetime).getTime();
    const activeRows: CSVRow[] = [];
    let cycleOffset = 0;
    const cycleAdvance = csvSpan + effectiveGap;

    while (true) {
      // No more cycles can fit if the offset itself exceeds target
      if (cycleOffset > targetDuration) {
        break;
      }
      let cycleExceedsTarget = false;
      for (const row of rows) {
        const rowTime = new Date(row.datetime).getTime();
        const relativeTime = rowTime - firstRowTime;
        const shiftedTime = relativeTime + cycleOffset;
        if (shiftedTime > targetDuration) {
          cycleExceedsTarget = true;
          break;
        }
        const shiftedRow: CSVRow = {
          ...row,
          datetime: new Date(firstRowTime + shiftedTime),
        };
        activeRows.push(shiftedRow);
      }

      if (cycleExceedsTarget) {
        break;
      }

      // Advance offset for next cycle: original span + gap
      // Guard against zero-advance (csvSpan=0, avgGap=0) to prevent infinite loop
      if (cycleAdvance <= 0) {
        break;
      }
      cycleOffset += cycleAdvance;
    }

    const delayMs = activeRows.length > 1 ? targetDuration / (activeRows.length - 1) : 0;
    return { activeRows, delayMs };
  }

  // CSV is longer than or equal to target → crop rows that fit within duration
  const firstTime = new Date(rows[0].datetime).getTime();
  const cutoff = firstTime + targetDuration;
  const cropped: CSVRow[] = [];
  for (const row of rows) {
    const t = new Date(row.datetime).getTime();
    if (t <= cutoff) {
      cropped.push(row);
    } else if (t > cutoff + 1) {
      break;
    }
  }

  if (cropped.length === 0) {
    return { activeRows: [rows[0]], delayMs: 0 };
  }

  const delayMs = cropped.length > 1 ? targetDuration / (cropped.length - 1) : 0;
  return { activeRows: cropped, delayMs };
}

function calculateActualDuration(data: CSVRow[]): number {
  if (data.length < 2) {
    return 0;
  }
  const firstTime = new Date(data[0].datetime).getTime();
  const lastTime = new Date(data[data.length - 1].datetime).getTime();
  return Math.max(0, lastTime - firstTime);
}
