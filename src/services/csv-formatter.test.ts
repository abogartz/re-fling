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
    // CSV span = 10s, duration=5s → buildActiveRows crops to first row fitting within 5s
    const result = formatRequestsForLog(data, 1, 5000);

    expect(result).toContain("requests:");
    const parsed = JSON.parse(result.replace("requests: ", ""));
    // Only row at t=0 fits within 5s target
    expect(parsed).toHaveLength(1);
  });

  test("repeats requests when duration exceeds CSV span", () => {
    const data = [
      { datetime: new Date("2024-01-01T10:00:00Z"), url: "/api/a" },
      { datetime: new Date("2024-01-01T10:00:05Z"), url: "/api/b" },
    ];
    // CSV span = 5s, avgGap = 5s. cycleInterval = 5s + 5s = 10s.
    // Cycle0: [t=0, t=5000]. Cycle1: offset=10000, row0=10000 (≤15000), row1=15000 (not >15000) → included.
    // Total: 4 rows.
    const result = formatRequestsForLog(data, 1, 15000);

    const parsed = JSON.parse(result.replace("requests: ", ""));
    expect(parsed).toHaveLength(4);
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

  test("preserves original timing gaps between rows", () => {
    const data = [
      { datetime: new Date("2024-01-01T10:00:00Z"), url: "/api/a" },
      { datetime: new Date("2024-01-01T10:00:10Z"), url: "/api/b" },
    ];
    // CSV span = 10s, duration=8s → buildActiveRows crops to first row fitting within 8s
    const result = formatRequestsForLog(data, 1, 8000);

    const parsed = JSON.parse(result.replace("requests: ", ""));
    expect(parsed).toHaveLength(1);
    expect(parsed[0].timing).toBe("0.00s");
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

  test("cycles with avg-gap between cycles", () => {
    // 2 rows spanning 5s (gap=5s). Duration=15000ms.
    // avgGap = 5s/1 = 5s. cycleInterval = 5s + 5s = 10s.
    // Cycle0: [t=0, t=5000]. Cycle1: offset=10000, row0=10000 (≤15000), row1=15000 (not >15000) → 4 total.
    const data = [
      { datetime: new Date("2024-01-01T10:00:00Z"), url: "/a" },
      { datetime: new Date("2024-01-01T10:00:05Z"), url: "/b" },
    ];
    const result = formatRequestsForLog(data, 1, 15000);
    const parsed = JSON.parse(result.replace("requests: ", ""));

    // Should have 4 rows (cycle0 + partial cycle1)
    expect(parsed).toHaveLength(4);

    // Check timing shows gap between cycles:
    // Cycle 0: 0.00s, 5.00s
    // Cycle 1: 10.00s, 15.00s (5s span + 5s avg gap)
    expect(parsed[2].timing).toBe("10.00s");
    expect(parsed[3].timing).toBe("15.00s");
  });
});
