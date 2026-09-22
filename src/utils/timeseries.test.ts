import { test, expect, describe } from "bun:test";
import { calculateExpectedTimeseries, recalcPreviewStats } from "./timeseries";

describe("calculateExpectedTimeseries", () => {
  const makeData = (count: number, gapMs: number) => {
    const base = new Date("2024-01-01T10:00:00Z").getTime();
    return Array.from({ length: count }, (_, i) => ({
      datetime: new Date(base + i * gapMs),
      url: `/api/resource/${i}`,
    }));
  };

  test("returns empty arrays for empty data", () => {
    const result = calculateExpectedTimeseries([], 1000, 1);
    expect(result.timestamps).toEqual([]);
    expect(result.rpsValues).toEqual([]);
  });

  test("duration=0 means natural speed-scaled CSV span", () => {
    // Span = 2s at speed 1 → rows at 0,1000,2000 play once (no repeat, no crop)
    const data = makeData(3, 1000);
    const result = calculateExpectedTimeseries(data, 0, 1);

    expect(result.timestamps).toEqual([0, 1000, 2000]);
    expect(result.rpsValues).toEqual([1, 1, 1]);
  });

  test("2s override on 1s-apart CSV shows [1, 1, 2] (completed cycles)", () => {
    // CSV: row0@t=0, row1@t=1000. Duration=2000ms.
    // buildActiveRows cycles and completes the in-progress cycle:
    // activeRows = [t=0, t=1000, t=2000, t=3000]
    // Bins: [0,1000)→1, [1000,2000)→1, [2000,3000)→2
    const data = makeData(2, 1000);
    const result = calculateExpectedTimeseries(data, 2000, 1);

    expect(result.timestamps).toHaveLength(3);
    expect(result.rpsValues).toEqual([1, 1, 2]);
  });

  test("creates one bin per second of effective duration", () => {
    const data = makeData(3, 1000);
    const result = calculateExpectedTimeseries(data, 2000, 1);

    expect(result.timestamps).toHaveLength(3);
    expect(result.timestamps[0]).toBe(0);
    expect(result.timestamps[1]).toBe(1000);
    expect(result.timestamps[2]).toBe(2000);
  });

  test("distributes rows into correct time bins", () => {
    // 4 rows at 0,500,1000,1500ms. csvDuration=1500, target=2000ms.
    // minGap = 500. cycleAdvance = 1500 + 500 = 2000.
    // Cycle0: [0,500,1000,1500]. Cycle1 starts at 2000 (≤ window) and plays
    // COMPLETE: [2000,2500,3000,3500]. Rows past the window clamp into the
    // final bin.
    // activeRows = [0,500,1000,1500,2000,2500,3000,3500]
    // Bins: [0,1k)→2, [1k,2k)→2, [2k,3k)→4 (clamped)
    const data = makeData(4, 500);
    const result = calculateExpectedTimeseries(data, 2000, 1);

    expect(result.timestamps).toHaveLength(3);
    expect(result.rpsValues).toEqual([2, 2, 4]);
  });

  test("speed scales row offsets into the natural window (cycles fill override)", () => {
    // 2 rows 1s apart, duration=1000ms, speed=3.
    // offsets = 0, 333ms. cycleAdvance = (1000 + 1000)/3 = 666ms → cycles repeat.
    // rows: 0, 333, 667, 1000 (boundary) → bin0 has 3 rows, bin1 has 1.
    const data = makeData(2, 1000);
    const result = calculateExpectedTimeseries(data, 1000, 3);

    expect(result.timestamps).toEqual([0, 1000]);
    expect(result.rpsValues).toEqual([3, 1]);
  });

  test("rows beyond duration are excluded", () => {
    // 5 rows over 4s. csvDuration=4000, target=2000ms → crop to first rows fitting.
    // activeRows = [t=0, t=1000, t=2000]. Bins: [0,1000)→1, [1000,2000)→1, [2000,3000)→1
    const data = makeData(5, 1000);
    const result = calculateExpectedTimeseries(data, 2000, 1);

    expect(result.timestamps).toHaveLength(3);
    expect(result.rpsValues).toEqual([1, 1, 1]);
  });

  test("rows with identical timestamps land in same bin", () => {
    const data = [
      { datetime: new Date("2024-01-01T10:00:00Z"), url: "/a" },
      { datetime: new Date("2024-01-01T10:00:00Z"), url: "/b" },
    ];
    const result = calculateExpectedTimeseries(data, 2000, 1);

    expect(result.rpsValues[0]).toBe(2);
  });

  test("handles single row at start time", () => {
    const data = [{ datetime: new Date("2024-01-01T10:00:00Z"), url: "/api/a" }];
    const result = calculateExpectedTimeseries(data, 3000, 1);

    // Single row at t=0 → bin0 gets 1, rest get 0
    expect(result.timestamps).toHaveLength(4);
    expect(result.rpsValues[0]).toBe(1);
    expect(result.rpsValues[1]).toBe(0);
    expect(result.rpsValues[2]).toBe(0);
    expect(result.rpsValues[3]).toBe(0);
  });

  test("multiple cycles fill bins correctly", () => {
    // CSV: 2 rows at t=0, t=500. csvDuration=500. target=2500ms.
    // avgGap = 500/1 = 500. cycleInterval = 500 + 500 = 1000.
    // Cycle0: [t=0, t=500]. Cycle1: [t=1000, t=1500]. Cycle2: [t=2000, t=2500].
    // activeRows = 6 rows. Bins: [0,1k)→1, [1k,2k)→1, [2k,3k)→2 (t=2000, t=2500)
    const data = makeData(2, 500);
    const result = calculateExpectedTimeseries(data, 2500, 1);

    expect(result.timestamps).toHaveLength(3);
    // bin0 [0,1000): row at t=0 → 1
    // bin1 [1000,2000): row at t=1500 → 1 (t=1000 is at boundary 1000 < 1000? No, 1000 >= 1000)
    // Actually: cycle0: t=0, t=500. cycle1: t=1000, t=1500. cycle2: t=2000, t=2500
    // bin0 [0,1000): t=0, t=500 → 2
    // bin1 [1000,2000): t=1000, t=1500 → 2
    // bin2 [2000,3000): t=2000, t=2500 → 2
    expect(result.rpsValues).toEqual([2, 2, 2]);
  });
});

describe("recalcPreviewStats", () => {
  const makeData = (count: number, gapMs: number) => {
    const base = new Date("2024-01-01T10:00:00Z").getTime();
    return Array.from({ length: count }, (_, i) => ({
      datetime: new Date(base + i * gapMs),
      url: `/api/resource/${i}`,
    }));
  };

  test("returns empty stats for no data", () => {
    const config = { speed: 1, durationEnabled: false, durationValue: 0, durationUnit: "seconds" as const };
    const result = recalcPreviewStats([], config);
    expect(result.timeseries.timestamps).toEqual([]);
    expect(result.timeseries.rpsValues).toEqual([]);
    expect(result.totalRequests).toBe(0);
  });

  test("uses CSV span when duration disabled", () => {
    const data = makeData(3, 1000); // 2s span
    const config = { speed: 1, durationEnabled: false, durationValue: 0, durationUnit: "seconds" as const };
    const result = recalcPreviewStats(data, config);
    expect(result.totalRequests).toBe(3);
    expect(result.timeseries.timestamps.length).toBeGreaterThan(0);
  });

  test("repeats data when duration exceeds CSV span", () => {
    const data = makeData(2, 1000); // 1s span
    const config = { speed: 1, durationEnabled: true, durationValue: 5, durationUnit: "seconds" as const };
    const result = recalcPreviewStats(data, config);
    // 5 cycles of 2 rows each = 10 total (minus last partial)
    expect(result.totalRequests).toBeGreaterThan(2);
  });

  test("no repeat when duration equals CSV span", () => {
    const data = makeData(3, 1000); // 2s span
    const config = { speed: 1, durationEnabled: true, durationValue: 2, durationUnit: "seconds" as const };
    const result = recalcPreviewStats(data, config);
    expect(result.totalRequests).toBe(3);
  });

  test("speed changes total request count (tighter pacing fills more cycles)", () => {
    // 4 rows 1s apart (3s span). Override 3s.
    // speed 1 → natural window = 3s → 4 rows play once.
    // speed 3 → offsets h=0,333,667,1000; cycleAdvance=(3000+1000)/3 ≈1333ms
    //   → 4 + 4 + 1 = 9 rows fit the 3s window.
    const data = makeData(4, 1000); // 3s span
    const configSlow = { speed: 1, durationEnabled: true, durationValue: 3, durationUnit: "seconds" as const };
    const configFast = { speed: 3, durationEnabled: true, durationValue: 3, durationUnit: "seconds" as const };

    const resultSlow = recalcPreviewStats(data, configSlow);
    const resultFast = recalcPreviewStats(data, configFast);

    // Faster speed compresses the schedule, so more cycles fit the window
    expect(resultSlow.totalRequests).toBe(4);
    expect(resultFast.totalRequests).toBeGreaterThan(resultSlow.totalRequests);
    // And the per-bin profile differs
    expect(resultSlow.timeseries.rpsValues).not.toEqual(resultFast.timeseries.rpsValues);
  });

  test("duration in minutes converts correctly", () => {
    const data = makeData(2, 1000); // 1s span
    const config = { speed: 1, durationEnabled: true, durationValue: 1, durationUnit: "minutes" as const };
    const result = recalcPreviewStats(data, config);
    expect(result.totalRequests).toBeGreaterThan(2);
  });

  test("duration=0 with no override uses CSV span", () => {
    const data = makeData(5, 500); // 2s span
    const config = { speed: 1, durationEnabled: false, durationValue: 0, durationUnit: "seconds" as const };
    const result = recalcPreviewStats(data, config);
    expect(result.totalRequests).toBe(5);
  });

  test("BUG FIX: cycling matches engine behavior for totalRequests", () => {
    // 2 rows spanning 1s. Duration=1500ms → should cycle to fill.
    // avgGap = 1000/1 = 1000. cycleInterval = 1000 + 1000 = 2000.
    // Cycle0: [t=0, t=1000]. Cycle1 would start at 2000 > 1500 → break.
    // activeRows = 2 rows (only cycle0 fits).
    const data = [
      { datetime: new Date("2024-01-01T10:00:00Z"), url: "/a" },
      { datetime: new Date("2024-01-01T10:00:01Z"), url: "/b" },
    ];
    const config = { speed: 1, durationEnabled: true, durationValue: 1.5, durationUnit: "seconds" as const };
    const result = recalcPreviewStats(data, config);

    // buildActiveRows: cycle0 has both rows (t=0, t=1000 both <= 1500).
    // Cycle1 offset=2000 > 1500 → break. total = 2.
    expect(result.totalRequests).toBe(2);
  });
});
