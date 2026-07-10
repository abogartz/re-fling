import { CSVRow } from "../csv/parser";
import { calculateActualDuration as calcDuration } from "../utils/duration";

/**
 * Format request data into log-friendly JSON string.
 * Single source of truth for request formatting across the app.
 */
export function formatRequestsForLog(
  data: CSVRow[],
  speed: number,
  durationMs: number,
): string {
  if (data.length === 0) {
    return "requests: []";
  }

  const csvDuration = calcDuration(data);
  const effectiveDuration = durationMs > 0 ? durationMs : csvDuration;
  const repeatCount = csvDuration > 0 ? Math.ceil(effectiveDuration / csvDuration) : 1;

  const requests: Array<{ url: string; timing: string }> = [];
  const firstTime = new Date(data[0].datetime).getTime();

  // Average inter-row gap from original CSV (used as pause between cycles)
  const avgGap = data.length > 1 ? csvDuration / (data.length - 1) : 0;
  const cycleInterval = csvDuration + avgGap;

  for (let cycle = 0; cycle < repeatCount; cycle++) {
    for (const row of data) {
      const csvTime = new Date(row.datetime).getTime();
      const relativeTime = csvTime - firstTime;
      const playbackTime = relativeTime;
      const absoluteTime = playbackTime + cycle * cycleInterval;

      requests.push({
        url: row.url,
        timing: `${(absoluteTime / 1000).toFixed(2)}s`,
      });
    }
  }

  return `requests: ${JSON.stringify(requests)}`;
}
