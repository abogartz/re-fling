import { CSVRow } from "../csv/parser";
import { getEffectiveDurationMs } from "./duration";
import { buildActiveRows } from "./buildActiveRows";
import { filterRowsByPatterns } from "./filterRows";

export interface TimeseriesResult {
  timestamps: number[];
  rpsValues: number[];
}

export interface PreviewStats {
  timeseries: TimeseriesResult;
  totalRequests: number;
}

export type DurationConfig = {
  speed: number;
  durationEnabled: boolean;
  durationValue: number;
  durationUnit: "seconds" | "minutes" | "hours";
  filterPatterns?: string[];
};

/**
 * Build active rows matching engine behavior, then bin into 1s RPS intervals.
 * This ensures chart, logs, and totalRequests all agree on the same data.
 */
export function calculateExpectedTimeseries(
  data: CSVRow[],
  durationMs: number,
  speed: number,
): TimeseriesResult {
  if (data.length === 0) {
    return { timestamps: [], rpsValues: [] };
  }

  // Build active rows exactly like the engine does (single source of truth for
  // offsets, cycles, and the effective window).
  const { activeRows, durationMs: windowMs } = buildActiveRows(data, {
    speed,
    duration: durationMs,
  });

  if (activeRows.length === 0 || windowMs <= 0) {
    return { timestamps: [], rpsValues: [] };
  }

  // Determine time bins (1 second intervals) across the effective window.
  const binSizeMs = 1000;
  const totalBins = Math.floor(windowMs / binSizeMs) + 1;
  const timestamps: number[] = Array.from({ length: totalBins }, (_, i) => i * binSizeMs);

  const rpsValues: number[] = new Array(totalBins).fill(0);
  const firstRowTime = new Date(activeRows[0].datetime).getTime();

  // Shifted row datetimes already encode the planned wall-clock offset.
  // Rows from a completed cycle can land past the nominal window end; clamp
  // them into the final bin so the chart total always equals totalRequests.
  for (const row of activeRows) {
    const rowTime = new Date(row.datetime).getTime();
    const bin = Math.min(Math.floor((rowTime - firstRowTime) / binSizeMs), totalBins - 1);
    if (bin >= 0 && bin < totalBins) {
      rpsValues[bin]++;
    }
  }

  return { timestamps, rpsValues };
}

export function recalcPreviewStats(
  data: CSVRow[],
  config: DurationConfig,
): PreviewStats {
  const overrideMs = getEffectiveDurationFromConfig(config);

  // Mirror the engine: drop rows matching any filter pattern before scheduling.
  const filteredData = filterRowsByPatterns(data, config.filterPatterns ?? []);

  // Build active rows exactly like engine does — this is the source of truth.
  // duration 0 → natural speed-scaled window (span / speed).
  const { activeRows } = buildActiveRows(filteredData, {
    speed: config.speed,
    duration: overrideMs > 0 ? overrideMs : 0,
  });

  const ts = calculateExpectedTimeseries(filteredData, overrideMs > 0 ? overrideMs : 0, config.speed);

  return { timeseries: ts, totalRequests: activeRows.length };
}

function getEffectiveDurationFromConfig(config: DurationConfig): number {
  return getEffectiveDurationMs(
    config.durationEnabled,
    config.durationValue,
    config.durationUnit,
  );
}
