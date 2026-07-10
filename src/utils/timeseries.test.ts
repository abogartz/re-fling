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

  test("returns empty arrays for zero duration", () => {
    const data = makeData(3, 1000);
    const result = calculateExpectedTimeseries(data, 0, 1);
    expect(result.timestamps).toEqual([]);
    expect(result.rpsValues).toEqual([]);
  });

  test("creates one bin per second of effective duration", () => {
    // 3 rows over 2s, speed=1 → effectiveDuration=2s → 3 bins (0, 1000, 2000)
    const data = makeData(3, 1000);
    const result = calculateExpectedTimeseries(data, 2000, 1);

    expect(result.timestamps).toHaveLength(3);
    expect(result.timestamps[0]).toBe(0);
    expect(result.timestamps[1]).toBe(1000);
    expect(result.timestamps[2]).toBe(2000);
  });

  test("distributes rows into correct time bins with strict upper bound", () => {
    // 4 rows at 0,500,1000,1500ms. csvDuration=1500, effectiveDuration=2000
    // playbackTime = csvOffset * (2000/1500)
    // Row0(0ms)→0, Row1(500ms)→667, Row2(1000ms)→1333, Row3(1500ms)→2000
    // totalBins = floor(2000/1000)+1 = 3 bins at [0, 1000, 2000]
    const data = makeData(4, 500);
    const result = calculateExpectedTimeseries(data, 2000, 1);

    expect(result.timestamps).toHaveLength(3);
    // bin0 [0,1000): rows at 0ms, 667ms → count=2
    // bin1 [1000,2000): row at 1333ms → count=1
    // bin2 [2000,3000): row at 2000ms → count=1 (strict upper bound: 2000 < 3000)
    expect(result.rpsValues).toEqual([2, 1, 1]);
  });

  test("RPS = countInBin / binDurationInSeconds (not countInBin * speed)", () => {
    // 2 rows at 0 and 1000ms. csvDuration=1000, effectiveDuration=1000/3≈333
    // totalBins = floor(333/1000)+1 = 1 bin at [0]
    // Both rows map to bin0 (playback times: 0 and 333)
    // RPS should be countInBin / 1s = 2, not countInBin * speed
    const data = makeData(2, 1000);
    const result = calculateExpectedTimeseries(data, 1000, 3);

    expect(result.timestamps).toHaveLength(1);
    // Correct RPS calculation: 2 requests in 1 second bin = 2 RPS
    expect(result.rpsValues).toEqual([2]);
  });

  test("rows beyond duration are excluded", () => {
    // 5 rows over 4s. csvDuration=4000, effectiveDuration=2000
    // playbackTime = csvOffset * (2000/4000) = csvOffset * 0.5
    // Row0(0)→0, Row1(1000)→500, Row2(2000)→1000, Row3(3000)→1500, Row4(4000)→2000
    // totalBins = floor(2000/1000)+1 = 3 bins at [0, 1000, 2000]
    const data = makeData(5, 1000);
    const result = calculateExpectedTimeseries(data, 2000, 1);

    expect(result.timestamps).toHaveLength(3);
    // bin0 [0,1000): rows at 0ms, 500ms → count=2
    // bin1 [1000,2000): rows at 1000ms, 1500ms → count=2
    // bin2 [2000,3000): row at 2000ms → count=1 (strict upper bound)
    expect(result.rpsValues).toEqual([2, 2, 1]);
  });

  test("speed scales playback time inversely", () => {
    // 2 rows at 0ms and 4000ms. csvDuration=4000, effectiveDuration=4000/2=2000
    // totalBins = floor(2000/1000)+1 = 3 bins at [0, 1000, 2000]
    // playbackTime = csvOffset * (2000/4000) = csvOffset * 0.5
    // Row0(0)→0 → bin0, Row1(4000)→2000 → bin2
    const data = makeData(2, 4000);
    const result = calculateExpectedTimeseries(data, 4000, 2);

    expect(result.timestamps).toHaveLength(3);
    expect(result.rpsValues[0]).toBe(1);
    expect(result.rpsValues[1]).toBe(0);
    expect(result.rpsValues[2]).toBe(1);
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
    expect(result.timestamps).toHaveLength(4); // bins at 0, 1000, 2000, 3000
    expect(result.rpsValues[0]).toBe(1);
    expect(result.rpsValues[1]).toBe(0);
    expect(result.rpsValues[2]).toBe(0);
    expect(result.rpsValues[3]).toBe(0);
  });

  test("RPS calculation uses bin duration not speed multiplier", () => {
    // Test that RPS = countInBin / (binSizeMs / 1000) regardless of speed
    // 4 rows in 1 second, speed=2 → effectiveDuration=500ms → 1 bin
    // All 4 rows in bin0, RPS should be 4/1s = 4, not 4*2=8
    const data = [
      { datetime: new Date("2024-01-01T10:00:00Z"), url: "/a" },
      { datetime: new Date("2024-01-01T10:00:00.250Z"), url: "/b" },
      { datetime: new Date("2024-01-01T10:00:00.500Z"), url: "/c" },
      { datetime: new Date("2024-01-01T10:00:00.750Z"), url: "/d" },
    ];
    const result = calculateExpectedTimeseries(data, 500, 2);

    expect(result.timestamps).toHaveLength(1);
    // All 4 rows in bin0 [0,1000), RPS = 4/1s = 4
    expect(result.rpsValues[0]).toBe(4);
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
    // No override → csvDuration=2000ms, no repeat needed
    expect(result.totalRequests).toBe(3);
    expect(result.timeseries.timestamps.length).toBeGreaterThan(0);
  });

  test("repeats data when duration exceeds CSV span", () => {
    const data = makeData(2, 1000); // 1s span
    const config = { speed: 1, durationEnabled: true, durationValue: 5, durationUnit: "seconds" as const };
    // overrideMs = 5000ms, csvDuration = 1000ms → repeatCount = 5
    const result = recalcPreviewStats(data, config);
    expect(result.totalRequests).toBeGreaterThan(2);
  });

  test("no repeat when duration equals CSV span", () => {
    const data = makeData(3, 1000); // 2s span
    const config = { speed: 1, durationEnabled: true, durationValue: 2, durationUnit: "seconds" as const };
    const result = recalcPreviewStats(data, config);
    expect(result.totalRequests).toBe(3);
  });

  test("speed affects timeseries but not total request count", () => {
    const data = makeData(4, 1000); // 3s span
    const configSlow = { speed: 1, durationEnabled: true, durationValue: 3, durationUnit: "seconds" as const };
    const configFast = { speed: 3, durationEnabled: true, durationValue: 3, durationUnit: "seconds" as const };

    const resultSlow = recalcPreviewStats(data, configSlow);
    const resultFast = recalcPreviewStats(data, configFast);

    // Same data, same override → same totalRequests
    expect(resultSlow.totalRequests).toBe(resultFast.totalRequests);
    // But timeseries differs due to speed scaling playback time
    expect(resultSlow.timeseries.rpsValues).not.toEqual(resultFast.timeseries.rpsValues);
  });

  test("duration in minutes converts correctly", () => {
    const data = makeData(2, 1000); // 1s span
    const config = { speed: 1, durationEnabled: true, durationValue: 1, durationUnit: "minutes" as const };
    // overrideMs = 60000ms, csvDuration = 1000ms → repeatCount = 60
    const result = recalcPreviewStats(data, config);
    expect(result.totalRequests).toBeGreaterThan(2);
  });

  test("duration=0 with no override uses CSV span", () => {
    const data = makeData(5, 500); // 2s span
    const config = { speed: 1, durationEnabled: false, durationValue: 0, durationUnit: "seconds" as const };
    const result = recalcPreviewStats(data, config);
    expect(result.totalRequests).toBe(5);
  });

  test("EXPOSES BUG: trimming logic undercounts when repeating", () => {
    // 2 rows spanning 1s. Duration=1500ms → repeatCount=2.
    // Expected: ~3 rows (1.5 cycles)
    // Bug: trimming loop breaks early because elapsed doesn't accumulate across cycles
    const data = [
      { datetime: new Date("2024-01-01T10:00:00Z"), url: "/a" },
      { datetime: new Date("2024-01-01T10:00:01Z"), url: "/b" },
    ];
    const config = { speed: 1, durationEnabled: true, durationValue: 1.5, durationUnit: "seconds" as const };
    const result = recalcPreviewStats(data, config);

    // Current bug: trimmed breaks after cycle 0 row1 because elapsed+maxTime > effectiveDuration
    // Result: only 2 rows counted instead of ~3
    expect(result.totalRequests).toBeGreaterThan(2); // Should be ~3, currently fails with 2
  });
});
