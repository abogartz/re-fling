import { CSVRow } from "../csv/parser";

export interface TimeseriesResult {
  timestamps: number[];
  rpsValues: number[];
}

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

    const rps = Math.round(countInBin * speed);
    rpsValues.push(rps);
    timestamps.push(binStart);
  }

  return { timestamps, rpsValues };
}

function calculateActualDuration(data: CSVRow[]): number {
  if (data.length < 2) { return 0; }
  const firstTime = new Date(data[0].datetime).getTime();
  const lastTime = new Date(data[data.length - 1].datetime).getTime();
  return Math.max(0, lastTime - firstTime);
}
