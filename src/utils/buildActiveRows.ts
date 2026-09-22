import { CSVRow } from "../csv/parser";

export interface BuildActiveRowsConfig {
  speed: number;
  duration: number | null;
}

export interface BuildActiveRowsResult {
  activeRows: CSVRow[];
  rowDelays: number[];
  durationMs: number;
}

/**
 * Build the replay schedule for the target window.
 *
 * Pacing rule: every inter-row delay is the ORIGINAL gap divided by speed
 * (1s gap at 2x = 0.5s). The window is the duration override if set,
 * otherwise the speed-scaled CSV span (natural duration = span / speed).
 *
 * Repeating: when the natural scaled duration is shorter than the window,
 * cycles restart after the tightest original inter-row gap (scaled by speed),
 * so the whole window fills with gaps that all exist in the source data.
 * A cycle whose first row starts within the window is played to COMPLETION —
 * trailing rows may land past the nominal window end so the underlying rate
 * stays legible (e.g. a 1s-apart pair at 2x over 2s yields 6 rows at 0, .5,
 * 1.0, 1.5, 2.0, 2.5s = flat 2 RPS).
 * Cropping: when the natural duration exceeds the window, only rows whose
 * scaled offset fits inside the window fire (a row at exactly the window
 * boundary is included); the in-progress pass is not completed.
 *
 * Row datetimes are shifted to encode the planned wall-clock offset from the
 * first row, so the engine, chart, and logs all read the same schedule.
 * Each row also knows the delay to the next fire (rowDelays[i] = ms until the
 * next row; the last entry is always 0).
 */
export function buildActiveRows(
  rows: CSVRow[],
  config: BuildActiveRowsConfig,
): BuildActiveRowsResult {
  const speed = config.speed && config.speed > 0 ? config.speed : 1;

  if (rows.length === 0) {
    return { activeRows: [], rowDelays: [], durationMs: 0 };
  }

  const base = new Date(rows[0].datetime).getTime();
  const span = calculateActualDuration(rows);
  const naturalDurationMs = span / speed;
  const durationMs =
    config.duration && config.duration > 0 ? config.duration : naturalDurationMs;

  if (rows.length === 1) {
    return {
      activeRows: [{ ...rows[0], datetime: new Date(base) }],
      rowDelays: [0],
      durationMs,
    };
  }

  // Speed-scaled offsets of each row from the first row.
  const offsets = rows.map((row) => (new Date(row.datetime).getTime() - base) / speed);

  // Tightest original inter-row gap → cycle restart gap (scaled).
  let minGap = Infinity;
  for (let i = 1; i < rows.length; i++) {
    const gap = new Date(rows[i].datetime).getTime() - new Date(rows[i - 1].datetime).getTime();
    if (gap < minGap) {
      minGap = gap;
    }
  }
  const wrapGap = Math.max(0, minGap === Infinity ? 0 : minGap) / speed;
  // Distance between the first row of one cycle and the first row of the next
  // (scaled span + scaled wrap gap — both in the playback time domain).
  const cycleAdvance = naturalDurationMs + wrapGap;

  const activeRows: CSVRow[] = [];

  // Repeat: emit complete cycles while a cycle's first row starts within the
  // window. Each started cycle fires every source row (gaps preserved), so the
  // final cycle can extend a little past the nominal window end.
  if (naturalDurationMs < durationMs) {
    let cycleOffset = 0;
    while (cycleOffset <= durationMs) {
      for (let i = 0; i < rows.length; i++) {
        activeRows.push({
          ...rows[i],
          datetime: new Date(base + Math.round(offsets[i] + cycleOffset)),
        });
      }
      if (cycleAdvance <= 0) {
        break;
      }
      cycleOffset += cycleAdvance;
    }
  } else {
    // Single pass (crop / exact fit): fire rows up to the window boundary.
    for (let i = 0; i < rows.length; i++) {
      if (offsets[i] > durationMs) {
        break;
      }
      activeRows.push({ ...rows[i], datetime: new Date(base + Math.round(offsets[i])) });
    }
  }

  const rowDelays = activeRows.map((row, i) => {
    if (i === activeRows.length - 1) {
      return 0;
    }
    const current = new Date(row.datetime).getTime();
    const next = new Date(activeRows[i + 1].datetime).getTime();
    return Math.max(0, next - current);
  });

  return { activeRows, rowDelays, durationMs };
}

function calculateActualDuration(data: CSVRow[]): number {
  if (data.length < 2) {
    return 0;
  }
  const firstTime = new Date(data[0].datetime).getTime();
  const lastTime = new Date(data[data.length - 1].datetime).getTime();
  return Math.max(0, lastTime - firstTime);
}