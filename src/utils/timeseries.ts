import { CSVRow } from "../csv/parser";
import { calculateActualDuration, getEffectiveDurationMs } from "./duration";


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
};

export function calculateExpectedTimeseries(
  data: CSVRow[],
  durationMs: number,
  speed: number,
): TimeseriesResult {
  if (data.length === 0 || durationMs === 0) {
    return { timestamps: [], rpsValues: [] };
  }

  // Work with raw data directly (no repetition/cropping) — timeseries previews original pattern
  const csvDuration = calculateActualDuration(data);
  const effectiveDurationMs = durationMs / speed;
  const binSizeMs = 1000;
  const totalBins = Math.floor(effectiveDurationMs / binSizeMs) + 1;

  const rpsValues: number[] = [];
  const timestamps: number[] = [];
  const firstRowTime = new Date(data[0].datetime).getTime();

  for (let i = 0; i < totalBins; i++) {
    const binStart = i * binSizeMs;
    const binEnd = (i + 1) * binSizeMs;

    let countInBin = 0;
    for (const row of data) {
      const rowTime = new Date(row.datetime).getTime();
      const offsetFromFirst = rowTime - firstRowTime;
      // When all rows share the same timestamp, csvDuration=0 → all land in bin0
      const playbackTime =
        csvDuration > 0 ? offsetFromFirst * effectiveDurationMs / csvDuration : 0;

      if (playbackTime >= binStart && playbackTime < binEnd) {
        countInBin++;
      }
    }

    rpsValues.push(countInBin);
    timestamps.push(binStart);
  }

  return { timestamps, rpsValues };
}

export function recalcPreviewStats(
  data: CSVRow[],
  config: DurationConfig,
): PreviewStats {
  const csvDuration = calculateActualDuration(data);
  const overrideMs = getEffectiveDurationFromConfig(config);
  const effectiveDuration = overrideMs > 0 ? overrideMs : csvDuration;
  const ts = calculateExpectedTimeseries(data, effectiveDuration, config.speed);

  // Preview totalRequests: count rows fitting within effectiveDuration (no inter-cycle gap)
  const fullCycles = csvDuration > 0 ? Math.floor(effectiveDuration / csvDuration) : 0;
  const remainingMs = csvDuration > 0 ? effectiveDuration % csvDuration : 0;
  const firstTime = data.length > 0 ? new Date(data[0].datetime).getTime() : 0;
  const partialRows =
    remainingMs > 0
      ? data.filter((r) => new Date(r.datetime).getTime() - firstTime <= remainingMs).length
      : 0;
  const totalRequests = fullCycles * data.length + partialRows;

  return { timeseries: ts, totalRequests };
}

function getEffectiveDurationFromConfig(config: DurationConfig): number {
  return getEffectiveDurationMs(
    config.durationEnabled,
    config.durationValue,
    config.durationUnit,
  );
}


