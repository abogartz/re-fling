import { test, expect, describe } from "bun:test";
import {
  calculateActualDuration,
  formatDuration,
  getEffectiveDurationMs,
} from "./duration";

describe("calculateActualDuration", () => {
  test("returns 0 for empty array", () => {
    expect(calculateActualDuration([])).toBe(0);
  });

  test("returns 0 for single row", () => {
    expect(
      calculateActualDuration([{ datetime: new Date("2024-01-01T10:00:00Z") }]),
    ).toBe(0);
  });

  test("calculates span between first and last timestamps", () => {
    const data = [
      { datetime: new Date("2024-01-01T10:00:00Z") },
      { datetime: new Date("2024-01-01T10:00:30Z") },
    ];
    expect(calculateActualDuration(data)).toBe(30_000);
  });

  test("returns 0 when last timestamp is before first (out of order)", () => {
    const data = [
      { datetime: new Date("2024-01-01T10:01:00Z") },
      { datetime: new Date("2024-01-01T10:00:00Z") },
    ];
    expect(calculateActualDuration(data)).toBe(0);
  });

  test("handles multiple rows with gaps", () => {
    const data = [
      { datetime: new Date("2024-01-01T10:00:00Z") },
      { datetime: new Date("2024-01-01T10:00:05Z") },
      { datetime: new Date("2024-01-01T10:00:10Z") },
    ];
    expect(calculateActualDuration(data)).toBe(10_000);
  });

  test("handles identical timestamps", () => {
    const data = [
      { datetime: new Date("2024-01-01T10:00:00Z") },
      { datetime: new Date("2024-01-01T10:00:00Z") },
    ];
    expect(calculateActualDuration(data)).toBe(0);
  });

  test("handles large time spans", () => {
    const data = [
      { datetime: new Date("2024-01-01T00:00:00Z") },
      { datetime: new Date("2024-01-02T00:00:00Z") },
    ];
    expect(calculateActualDuration(data)).toBe(86_400_000);
  });
});

describe("formatDuration", () => {
  test("formats seconds only", () => {
    expect(formatDuration(45_000)).toBe("45s");
  });

  test("formats minutes and seconds", () => {
    expect(formatDuration(90_000)).toBe("1m 30s");
  });

  test("formats hours and minutes", () => {
    expect(formatDuration(3_900_000)).toBe("1h 5m");
  });

  test("formats zero", () => {
    expect(formatDuration(0)).toBe("0s");
  });

  test("formats exactly one minute", () => {
    expect(formatDuration(60_000)).toBe("1m 0s");
  });

  test("formats exactly one hour", () => {
    expect(formatDuration(3_600_000)).toBe("1h 0m");
  });

  test("formats large values correctly", () => {
    // 2h 30m 15s = 9015000ms
    expect(formatDuration(9_015_000)).toBe("2h 30m");
  });

  test("rounds down partial seconds", () => {
    expect(formatDuration(45_500)).toBe("45s");
  });
});

describe("getEffectiveDurationMs", () => {
  test("returns 0 when disabled", () => {
    expect(getEffectiveDurationMs(false, 100, "seconds")).toBe(0);
  });

  test("returns 0 when value is 0", () => {
    expect(getEffectiveDurationMs(true, 0, "seconds")).toBe(0);
  });

  test("returns 0 when value is negative", () => {
    expect(getEffectiveDurationMs(true, -5, "seconds")).toBe(0);
  });

  test("converts seconds to ms", () => {
    expect(getEffectiveDurationMs(true, 10, "seconds")).toBe(10_000);
  });

  test("converts minutes to ms", () => {
    expect(getEffectiveDurationMs(true, 5, "minutes")).toBe(300_000);
  });

  test("converts hours to ms", () => {
    expect(getEffectiveDurationMs(true, 2, "hours")).toBe(7_200_000);
  });

  test("handles fractional values", () => {
    expect(getEffectiveDurationMs(true, 1.5, "minutes")).toBe(90_000);
  });
});
