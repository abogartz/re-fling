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

  const csvDuration = calculateActualDuration(data);
  const effectiveDurationMs = durationMs / speed;
  const binSizeMs = 1000;
  const totalBins = Math.floor(effectiveDurationMs / binSizeMs) + 1;

  const rpsValues: number[] = [];
  const timestamps: number[] = [];
  const firstTime = new Date(data[0].datetime).getTime();

  for (let i = 0; i < totalBins; i++) {
    const binStart = i * binSizeMs;
    const binEnd = (i + 1) * binSizeMs;

    let countInBin = 0;
    for (const row of data) {
      const csvTime = new Date(row.datetime).getTime();
      const playbackTime =
        csvDuration > 0
          ? (csvTime - firstTime) * effectiveDurationMs / csvDuration
          : 0;

      if (playbackTime >= binStart && playbackTime < binEnd) {
        countInBin++;
      }
    }

    const rps = countInBin;
    rpsValues.push(rps);
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

  let previewTotalRequests = data.length;
  if (effectiveDuration > 0 && csvDuration > 0) {
    const repeatCount = Math.ceil(effectiveDuration / csvDuration);
    previewTotalRequests = data.length * repeatCount;

    if (repeatCount > 1) {
      const maxTime =
        new Date(data[data.length - 1].datetime).getTime() -
        new Date(data[0].datetime).getTime();
      if (maxTime > 0) {
        let trimmed = 0;
        for (let r = 0; r < repeatCount; r++) {
          for (const row of data) {
            const t =
              new Date(row.datetime).getTime() -
              new Date(data[0].datetime).getTime();
            const absTime = r * maxTime + t;
            if (absTime > effectiveDuration) {
              break;
            }
            trimmed++;
          }
        }
        previewTotalRequests = trimmed;
      }
    }
  }

  return { timeseries: ts, totalRequests: previewTotalRequests };
}

function getEffectiveDurationFromConfig(config: DurationConfig): number {
  return getEffectiveDurationMs(
    config.durationEnabled,
    config.durationValue,
    config.durationUnit,
  );
}


