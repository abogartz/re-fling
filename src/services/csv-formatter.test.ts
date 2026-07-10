import { test, expect, describe } from "bun:test";
import { formatRequestsForLog } from "./csv-formatter";

describe("formatRequestsForLog", () => {
  const makeData = (count: number, gapMs: number) => {
    const base = new Date("2024-01-01T10:00:00Z").getTime();
    return Array.from({ length: count }, (_, i) => ({
      datetime: new Date(base + i * gapMs),
      url: `/api/resource/${i}`,
    }));
  };

  test("returns empty requests string for no data", () => {
    expect(formatRequestsForLog([], 1, 0)).toBe("requests: []");
  });

  test("formats single request with correct timing", () => {
    const data = [
      { datetime: new Date("2024-01-01T10:00:00Z"), url: "/api/a" },
    ];
    const result = formatRequestsForLog(data, 1, 0);

    expect(result).toContain("requests:");
    expect(result).toContain("/api/a");
    expect(result).toContain("0.00s");
  });

  test("formats multiple requests with sequential timing", () => {
    const data = [
      { datetime: new Date("2024-01-01T10:00:00Z"), url: "/api/a" },
      { datetime: new Date("2024-01-01T10:00:01Z"), url: "/api/b" },
    ];
    const result = formatRequestsForLog(data, 1, 0);

    expect(result).toContain("/api/a");
    expect(result).toContain("/api/b");
    expect(result).toContain("0.00s");
    expect(result).toContain("1.00s");
  });

  test("uses provided duration when non-zero", () => {
    const data = [
      { datetime: new Date("2024-01-01T10:00:00Z"), url: "/api/a" },
      { datetime: new Date("2024-01-01T10:00:10Z"), url: "/api/b" },
    ];
    // CSV span = 10s, duration=5s → repeatCount = ceil(5/10) = 1
    const result = formatRequestsForLog(data, 1, 5000);

    expect(result).toContain("requests:");
    // Both rows should appear in the output
    const parsed = JSON.parse(result.replace("requests: ", ""));
    expect(parsed).toHaveLength(2);
  });

  test("repeats requests when duration exceeds CSV span", () => {
    const data = [
      { datetime: new Date("2024-01-01T10:00:00Z"), url: "/api/a" },
      { datetime: new Date("2024-01-01T10:00:05Z"), url: "/api/b" },
    ];
    // CSV span = 5s, duration=15s → repeatCount = ceil(15/5) = 3
    const result = formatRequestsForLog(data, 1, 15000);

    const parsed = JSON.parse(result.replace("requests: ", ""));
    expect(parsed).toHaveLength(6); // 2 rows × 3 repeats
  });

  test("handles duration=0 by using CSV span", () => {
    const data = [
      { datetime: new Date("2024-01-01T10:00:00Z"), url: "/api/a" },
      { datetime: new Date("2024-01-01T10:00:05Z"), url: "/api/b" },
    ];
    // duration=0 → effectiveDuration = csvDuration = 5000ms
    const result = formatRequestsForLog(data, 1, 0);

    const parsed = JSON.parse(result.replace("requests: ", ""));
    expect(parsed).toHaveLength(2);
  });

  test("applies speed to timing calculations", () => {
    const data = [
      { datetime: new Date("2024-01-01T10:00:00Z"), url: "/api/a" },
      { datetime: new Date("2024-01-01T10:00:10Z"), url: "/api/b" },
    ];
    // speed=2 → playback is 2x faster
    const result = formatRequestsForLog(data, 2, 5000);

    const parsed = JSON.parse(result.replace("requests: ", ""));
    expect(parsed).toHaveLength(2);
    // With speed=2 and csvDuration=10s, effectiveDuration=5s
    // Row 0: playbackTime = 0 * 5/10 = 0 → 0.00s
    // Row 1: playbackTime = 10000 * 5/10 = 5000 → 5.00s
    expect(parsed[0].timing).toBe("0.00s");
    expect(parsed[1].timing).toBe("5.00s");
  });

  test("output is valid JSON-parseable format", () => {
    const data = makeData(3, 500);
    const result = formatRequestsForLog(data, 1, 2000);

    // Should start with "requests: " prefix
    expect(result.startsWith("requests: ")).toBe(true);
    // The rest should be valid JSON array
    const jsonStr = result.slice("requests: ".length);
    const parsed = JSON.parse(jsonStr);
    expect(Array.isArray(parsed)).toBe(true);
    expect(parsed[0]).toHaveProperty("url");
    expect(parsed[0]).toHaveProperty("timing");
  });

  test("handles large datasets without errors", () => {
    const data = makeData(100, 100);
    const result = formatRequestsForLog(data, 1, 15000);

    const parsed = JSON.parse(result.replace("requests: ", ""));
    expect(parsed.length).toBeGreaterThan(0);
    expect(parsed[0]).toHaveProperty("url");
    expect(parsed[0]).toHaveProperty("timing");
  });

  test("EXPOSES BUG: timing between cycles includes gap (avg inter-row gap)", () => {
    // 2 rows spanning 5s (gap=5s). Duration=15000ms → 3 repeats.
    // With gap between cycles (avg gap = 5s), cycle 1 should start at 10s (5s span + 5s gap).
    // Current bug: cycles placed back-to-back at 0s, 5s, 10s instead of 0s, 10s, 20s.
    const data = [
      { datetime: new Date("2024-01-01T10:00:00Z"), url: "/a" },
      { datetime: new Date("2024-01-01T10:00:05Z"), url: "/b" },
    ];
    const result = formatRequestsForLog(data, 1, 15000);
    const parsed = JSON.parse(result.replace("requests: ", ""));

    // Should have 6 rows (2 × 3 cycles)
    expect(parsed).toHaveLength(6);

    // Check timing shows gap between cycles:
    // Cycle 0: 0.00s, 5.00s
    // Cycle 1: should be ~10.00s, ~15.00s (5s span + 5s avg gap)
    // Current bug: cycle 1 starts at 5.00s (back-to-back), not 10.00s
    expect(parsed[2].timing).toBe("10.00s"); // Row 0 of cycle 1
    expect(parsed[3].timing).toBe("15.00s"); // Row 1 of cycle 1
  });
});
