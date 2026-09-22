import { test, expect, describe } from "bun:test";
import { buildActiveRows } from "./buildActiveRows";

const makeRows = (gapMs: number, count = 2) => {
  const base = new Date("2024-01-01T10:00:00Z").getTime();
  return Array.from({ length: count }, (_, i) => ({
    datetime: new Date(base + i * gapMs),
    url: `http://localhost/${i}`,
  }));
};

const offsetsOf = (rows: { datetime: Date }[]) =>
  rows.map((r) => new Date(r.datetime).getTime() - new Date(rows[0].datetime).getTime());

describe("buildActiveRows", () => {
  test("CORE: speed=2, 2 rows 1s apart, duration=2s → 6 rows at 0/0.5/1.0/1.5/2.0/2.5s", () => {
    const data = makeRows(1000);
    const { activeRows, rowDelays, durationMs } = buildActiveRows(data, {
      speed: 2,
      duration: 2000,
    });

    expect(durationMs).toBe(2000);
    expect(offsetsOf(activeRows)).toEqual([0, 500, 1000, 1500, 2000, 2500]);
    expect(activeRows.length).toBe(6);
    expect(rowDelays).toEqual([500, 500, 500, 500, 500, 0]);
  });

  test("CORE: same data at speed=1, duration=2s → 4 rows (R1,R2,R1,R2) with 1s gaps", () => {
    const data = makeRows(1000);
    const { activeRows, rowDelays } = buildActiveRows(data, { speed: 1, duration: 2000 });

    expect(offsetsOf(activeRows)).toEqual([0, 1000, 2000, 3000]);
    expect(activeRows.length).toBe(4);
    expect(rowDelays).toEqual([1000, 1000, 1000, 0]);
  });

  test("repeat: cycle starting within window plays to completion even past the window", () => {
    // dur=1500 at speed 2 → cycles at 0 (@0,@500) and 1000 (@1000,@1500); no @2000 cycle
    const data = makeRows(1000);
    const { activeRows } = buildActiveRows(data, { speed: 2, duration: 1500 });

    expect(offsetsOf(activeRows)).toEqual([0, 500, 1000, 1500]);
  });

  test("crop still clips mid-cycle when source data is longer than the window", () => {
    // 3 rows at 0, 5s, 10s (natural 10s) with a 6s window → only first two rows fire
    const base = new Date("2024-01-01T10:00:00Z").getTime();
    const data = Array.from({ length: 3 }, (_, i) => ({
      datetime: new Date(base + i * 5000),
      url: `http://localhost/${i}`,
    }));
    const { activeRows } = buildActiveRows(data, { speed: 1, duration: 6000 });

    expect(offsetsOf(activeRows)).toEqual([0, 5000]);
  });

  test("exact fit: natural span == window → single pass, boundary row included", () => {
    const data = makeRows(1000);
    const { activeRows } = buildActiveRows(data, { speed: 1, duration: 1000 });

    expect(offsetsOf(activeRows)).toEqual([0, 1000]);
  });

  test("speed scales gaps: 3 rows at 0/4s/6s, speed=2, natural duration", () => {
    const base = new Date("2024-01-01T10:00:00Z").getTime();
    const data = [0, 4000, 6000].map((ms, i) => ({
      datetime: new Date(base + ms),
      url: `http://localhost/${i}`,
    }));
    const { activeRows, rowDelays, durationMs } = buildActiveRows(data, { speed: 2, duration: 0 });

    expect(durationMs).toBe(3000); // 6s span / 2
    expect(offsetsOf(activeRows)).toEqual([0, 2000, 3000]);
    expect(rowDelays).toEqual([2000, 1000, 0]);
  });

  test("repeat wraps at the tightest gap: 3 rows 0/5s/6s, duration=20s → 9 rows", () => {
    const base = new Date("2024-01-01T10:00:00Z").getTime();
    const data = [0, 5000, 6000].map((ms, i) => ({
      datetime: new Date(base + ms),
      url: `http://localhost/${i}`,
    }));
    const { activeRows, rowDelays } = buildActiveRows(data, { speed: 1, duration: 20000 });

    expect(offsetsOf(activeRows)).toEqual([0, 5000, 6000, 7000, 12000, 13000, 14000, 19000, 20000]);
    expect(rowDelays).toEqual([5000, 1000, 1000, 5000, 1000, 1000, 5000, 1000, 0]);
  });

  test("empty data → empty schedule", () => {
    const { activeRows, rowDelays, durationMs } = buildActiveRows([], { speed: 1, duration: 0 });
    expect(activeRows).toEqual([]);
    expect(rowDelays).toEqual([]);
    expect(durationMs).toBe(0);
  });

  test("single row → fires once", () => {
    const { activeRows, rowDelays } = buildActiveRows(makeRows(1000, 1), { speed: 1, duration: 5000 });
    expect(activeRows.length).toBe(1);
    expect(rowDelays).toEqual([0]);
  });

  test("identical timestamps do not loop infinitely", () => {
    const base = new Date("2024-01-01T10:00:00Z").getTime();
    const data = [
      { datetime: new Date(base), url: "/a" },
      { datetime: new Date(base), url: "/b" },
    ];
    const { activeRows } = buildActiveRows(data, { speed: 1, duration: 5000 });
    expect(offsetsOf(activeRows)).toEqual([0, 0]);
  });
});