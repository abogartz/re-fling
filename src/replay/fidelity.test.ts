/**
 * Phase 0 — Fidelity contract tests.
 *
 * Contract (the font of record is the row sequence and its gaps):
 *   C1 Ordering — rows fire in the order they appear in the (source-ordered)
 *      input; response arrival order never changes fire order.
 *   C2 Gaps    — at speed s, the delay between fire i and i+1 is
 *      (dt(i+1) - dt(i)) / s. Bound: ±20ms at speed 1x.
 *   C3 Boundary— rows at/inside the replay window fire; cycles that have
 *      started play to completion (buildActiveRows semantics).
 *   C4 No implicit transforms — no retries, no auto-drop, no scheduler
 *      reordering; a transport failure is recorded, never silently retried.
 *   C5 Non-blocking — response latency must never delay subsequent fires.
 *
 * Phase 1 adds absolute-offset scheduling: ReplayState exposes scheduledAt
 * (planned fire offset per row) and actuallyFiredAt (realized offset), so
 * per-row jitter and the long-run drift tests below are asserted against the
 * schedule itself, not just wall-clock gaps.
 */

import { test, expect, describe, beforeEach, afterEach } from "bun:test";
import { ReplayEngine, type ReplayConfig } from "./engine";
import type { CSVRow } from "../csv/parser";

// ------------------------------ Harness ------------------------------------

interface FireRecord {
  url: string;
  firedAt: number;
  index: number;
}

let fires: FireRecord[] = [];
let origFetch: typeof fetch | null = null;

function okResponse(): Promise<Response> {
  return Promise.resolve(new Response("ok", { status: 200 }));
}

function installFetchStub(opts?: {
  failUrls?: Set<string>;
  delayedUrls?: Set<string>;
  delayMs?: number;
}): void {
  fires = [];
  origFetch = globalThis.fetch;
  globalThis.fetch = ((input: RequestInfo | URL) => {
    const url =
      typeof input === "string"
        ? input
        : input instanceof URL
          ? input.href
          : input.url;
    const rec: FireRecord = { url, firedAt: Date.now(), index: fires.length };
    fires.push(rec);
    if (opts?.failUrls?.has(url)) {
      return Promise.reject(new Error("transport failure"));
    }
    if (opts?.delayedUrls?.has(url)) {
      const delay = opts.delayMs ?? 300;
      return new Promise<Response>((resolve) =>
        setTimeout(() => resolve(new Response("ok", { status: 200 })), delay),
      );
    }
    return okResponse();
  }) as typeof fetch;
}

function rowsWithGaps(gapMs: number, n: number): CSVRow[] {
  const base = Date.UTC(2024, 0, 1);
  return Array.from({ length: n }, (_, i) => ({
    datetime: new Date(base + i * gapMs),
    url: `https://host.test/${i}`,
  }));
}

function configFor(speed: number, duration: number | null): ReplayConfig {
  return { speed, duration, baseUrl: "", filterPatterns: [] };
}

async function waitForStatus(
  engine: ReplayEngine,
  status: string,
  timeoutMs = 8000,
): Promise<void> {
  const t0 = Date.now();
  while (Date.now() - t0 < timeoutMs) {
    if (engine.getState().status === status) {
      return;
    }
    await new Promise((r) => setTimeout(r, 10));
  }
  throw new Error(
    `timed out waiting for "${status}"; got "${engine.getState().status}"`,
  );
}

function fireGaps(): number[] {
  const deltas: number[] = [];
  for (let i = 1; i < fires.length; i++) {
    deltas.push(fires[i].firedAt - fires[i - 1].firedAt);
  }
  return deltas;
}

// ------------------------------ Tests --------------------------------------

describe("Fidelity contract — C1 ordering", () => {
  beforeEach(() => installFetchStub());

  afterEach(() => {
    if (origFetch) {
      globalThis.fetch = origFetch;
      origFetch = null;
    }
  });

  test("fires rows in recorded order", async () => {
    const data = rowsWithGaps(50, 10);
    const engine = new ReplayEngine();
    engine.setData(data, configFor(1, 0));
    engine.setProgressCallback(() => {});
    engine.start();

    await waitForStatus(engine, "completed");
    engine.cancel();

    expect(fires.map((f) => f.url)).toEqual(data.map((d) => d.url));
    expect(fires.length).toBe(data.length);
  });

  test("fire order is preserved even when responses resolve out of order", async () => {
    installFetchStub({
      delayedUrls: new Set(["https://host.test/0", "https://host.test/1"]),
    });
    const data = rowsWithGaps(30, 5);
    const engine = new ReplayEngine();
    engine.setData(data, configFor(1, 0));
    engine.setProgressCallback(() => {});
    engine.start();

    await waitForStatus(engine, "completed");
    engine.cancel();

    expect(fires.map((f) => f.url)).toEqual(data.map((d) => d.url));
  });
});

describe("Fidelity contract — C2 gaps", () => {
  beforeEach(() => installFetchStub());

  afterEach(() => {
    if (origFetch) {
      globalThis.fetch = origFetch;
      origFetch = null;
    }
  });

  test("speed 1 preserves original gaps within tolerance", async () => {
    const gapMs = 50;
    const data = rowsWithGaps(gapMs, 20);
    const engine = new ReplayEngine();
    engine.setData(data, configFor(1, 0));
    engine.setProgressCallback(() => {});
    engine.start();

    await waitForStatus(engine, "completed");
    engine.cancel();

    expect(fires.length).toBe(data.length); // C4: no auto-drop
    const gaps = fireGaps();
    expect(gaps.length).toBe(data.length - 1);
    for (const gap of gaps) {
      expect(Math.abs(gap - gapMs)).toBeLessThanOrEqual(20);
    }
  });

  test("gaps scale with speed (100ms at 2x -> ~50ms)", async () => {
    const data = rowsWithGaps(100, 8);
    const engine = new ReplayEngine();
    engine.setData(data, configFor(2, 0));
    engine.setProgressCallback(() => {});
    engine.start();

    await waitForStatus(engine, "completed");
    engine.cancel();

    const gaps = fireGaps();
    expect(gaps.length).toBe(data.length - 1);
    for (const gap of gaps) {
      expect(Math.abs(gap - 50)).toBeLessThanOrEqual(20);
    }
  });

  test("durations between fires stay on schedule when responses are slow", async () => {
    installFetchStub({ delayedUrls: new Set(["https://host.test/0"]) });
    const data = rowsWithGaps(30, 4);
    const engine = new ReplayEngine();
    engine.setData(data, configFor(1, 0));
    engine.setProgressCallback(() => {});
    engine.start();

    await waitForStatus(engine, "completed");
    engine.cancel();

    const gaps = fireGaps();
    for (const gap of gaps) {
      expect(Math.abs(gap - 30)).toBeLessThanOrEqual(20);
    }
  });
});

describe("Fidelity contract — C3 boundary", () => {
  beforeEach(() => installFetchStub());

  afterEach(() => {
    if (origFetch) {
      globalThis.fetch = origFetch;
      origFetch = null;
    }
  });

  test("2s override + 2x speed on 1s-apart rows -> 6 fires, 0.5s gaps (cycles complete)", async () => {
    const data = rowsWithGaps(1000, 2);
    const engine = new ReplayEngine();
    engine.setData(data, configFor(2, 2000));
    engine.setProgressCallback(() => {});
    engine.start();

    await waitForStatus(engine, "completed");
    engine.cancel();

    expect(fires.length).toBe(6);
    const gaps = fireGaps();
    expect(fires.map((f) => f.url)).toEqual([
      "https://host.test/0",
      "https://host.test/1",
      "https://host.test/0",
      "https://host.test/1",
      "https://host.test/0",
      "https://host.test/1",
    ]);
    for (const gap of gaps) {
      expect(Math.abs(gap - 500)).toBeLessThanOrEqual(100);
    }
  });
});

describe("Fidelity contract — C4 no implicit transforms", () => {
  afterEach(() => {
    if (origFetch) {
      globalThis.fetch = origFetch;
      origFetch = null;
    }
  });

  test("a transport failure is recorded, never retried", async () => {
    installFetchStub({ failUrls: new Set(["https://host.test/boom"]) });
    const data = [
      { datetime: new Date(Date.UTC(2024, 0, 1)), url: "https://host.test/boom" },
    ];
    const engine = new ReplayEngine();
    engine.setData(data, configFor(1, 0));
    engine.setProgressCallback(() => {});
    engine.start();

    await waitForStatus(engine, "completed");
    engine.cancel();

    expect(fires.length).toBe(1); // exactly one attempt
    expect(engine.getState().errors).toBe(1);
  });
});

describe("Phase 1 — drift-free scheduling", () => {
  beforeEach(() => installFetchStub());

  afterEach(() => {
    if (origFetch) {
      globalThis.fetch = origFetch;
      origFetch = null;
    }
  });

  test("no compounding drift over 150 rows (50ms gaps at speed 1)", async () => {
    const data = rowsWithGaps(50, 150);
    const engine = new ReplayEngine();
    engine.setData(data, configFor(1, 0));
    engine.setProgressCallback(() => {});
    engine.start();

    await waitForStatus(engine, "completed", 15000);
    engine.cancel();

    const state = engine.getState();
    expect(state.completedRequests).toBe(150);
    expect(fires.length).toBe(150);
    expect(state.scheduledAt.length).toBe(150);

    // Every fire lands within ±20ms of its precomputed absolute offset; error
    // must not accumulate at row 150 (the chained-setTimeout baseline fails this).
    for (let i = 0; i < 150; i++) {
      const fired = state.actuallyFiredAt[i];
      expect(fired).not.toBeNull();
      expect(Math.abs((fired as number) - state.scheduledAt[i])).toBeLessThanOrEqual(20);
    }

    // Total realized span matches the schedule (149 gaps * 50ms) within 40ms.
    const first = state.actuallyFiredAt[0] as number;
    const last = state.actuallyFiredAt[149] as number;
    expect(Math.abs(last - first - 149 * 50)).toBeLessThanOrEqual(40);
  }, 20000);

  test("pause/resume preserves the absolute schedule; nothing fires while paused", async () => {
    const data = rowsWithGaps(500, 2);
    const engine = new ReplayEngine();
    engine.setData(data, configFor(1, 0));
    engine.setProgressCallback(() => {});
    engine.start();

    // Let row 0 fire, then pause before row 1 is due at 500ms.
    await new Promise((r) => setTimeout(r, 100));
    engine.pause();
    expect(engine.getState().status).toBe("paused");

    // Wall clock advances past row 1's nominal due time, but elapsed is frozen.
    await new Promise((r) => setTimeout(r, 400));
    expect(fires.length).toBe(1);

    engine.resume();
    expect(engine.getState().status).toBe("running");
    await waitForStatus(engine, "completed");
    engine.cancel();

    const state = engine.getState();
    expect(fires.length).toBe(2);
    expect(fires.map((f) => f.url)).toEqual(data.map((d) => d.url));

    // Row 1 still lands at ~its scheduled offset (fires ~400ms after resume,
    // not immediately): the absolute schedule is preserved across the pause.
    const jitter = (state.actuallyFiredAt[1] as number) - state.scheduledAt[1];
    expect(Math.abs(jitter)).toBeLessThanOrEqual(150);
  });

  test("catch-up after a long pause fires all due rows in order, none dropped", async () => {
    const data = rowsWithGaps(200, 3);
    const engine = new ReplayEngine();
    engine.setData(data, configFor(1, 0));
    engine.setProgressCallback(() => {});
    engine.start();

    await new Promise((r) => setTimeout(r, 100)); // row 0 fired
    engine.pause();
    await new Promise((r) => setTimeout(r, 500)); // rows 1, 2 due in wall clock

    engine.resume();
    await waitForStatus(engine, "completed");
    engine.cancel();

    expect(fires.map((f) => f.url)).toEqual(data.map((d) => d.url));
    expect(fires.length).toBe(3); // nothing dropped

    const state = engine.getState();
    for (const fired of state.actuallyFiredAt) {
      expect(fired).not.toBeNull();
    }
  });
});