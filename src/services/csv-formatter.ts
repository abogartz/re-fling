import { CSVRow } from "../csv/parser";
import { buildActiveRows } from "../utils/buildActiveRows";

/**
 * Format request data into log-friendly JSON string.
 * Uses buildActiveRows for consistent cycling logic with engine and chart.
 * durationMs of 0 (or negative) means "natural" — the speed-scaled CSV span.
 */
export function formatRequestsForLog(
  data: CSVRow[],
  speed: number,
  durationMs: number,
): string {
  if (data.length === 0) {
    return "requests: []";
  }

  // Use buildActiveRows for consistent cycling with engine/chart
  const { activeRows } = buildActiveRows(data, { speed, duration: durationMs });

  if (activeRows.length === 0) {
    return "requests: []";
  }

  const firstTime = new Date(activeRows[0].datetime).getTime();
  const requests = activeRows.map((row) => {
    const rowTime = new Date(row.datetime).getTime();
    const offsetFromFirst = rowTime - firstTime;
    return {
      url: row.url,
      timing: `${(offsetFromFirst / 1000).toFixed(2)}s`,
    };
  });

  return `requests: ${JSON.stringify(requests)}`;
}
