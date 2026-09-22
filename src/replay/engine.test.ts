import { test, expect, describe, beforeEach, afterEach } from "bun:test";
import { ReplayEngine, ReplayConfig } from "../replay/engine";

describe("Replay Engine", () => {
  let engine: ReplayEngine;
  const sampleData = [
    {
      datetime: new Date("2024-01-01T10:00:00Z"),
      url: "http://localhost:9000/api/users",
    },
    {
      datetime: new Date("2024-01-01T10:00:05Z"),
      url: "http://localhost:9000/api/posts",
    },
    {
      datetime: new Date("2024-01-01T10:00:10Z"),
      url: "http://localhost:9000/api/items",
    },
  ];

  beforeEach(() => {
    engine = new ReplayEngine();
  });

  afterEach(() => {
    if (engine.isRunning()) {
      engine.cancel();
    }
  });

  test("should initialize with correct state", () => {
    const state = engine.getState();
    expect(state.status).toBe("idle");
    expect(state.progress).toBe(0);
    expect(state.totalRequests).toBe(0);
    expect(state.completedRequests).toBe(0);
    expect(state.errors).toBe(0);
  });

  test("should set data and config", () => {
    const config: ReplayConfig = {
      speed: 1.0,
      duration: 0,
      baseUrl: "",
      filterPatterns: [],
    };

    engine.setData(sampleData, config);
    const state = engine.getState();

    expect(state.totalRequests).toBe(3);
    expect(state.config?.speed).toBe(1.0);
    expect(state.config?.baseUrl).toBe("");
    expect(state.config?.filterPatterns).toEqual([]);
    // Duration should be auto-set to actual CSV span when 0
    expect(state.config?.duration).toBeGreaterThan(0);
  });

  test("should apply speed multiplier", () => {
    const config: ReplayConfig = {
      speed: 2.0,
      duration: 0,
      baseUrl: "",
      filterPatterns: [],
    };

    engine.setData(sampleData, config);
    const state = engine.getState();

    expect(state.config?.speed).toBe(2.0);
  });

  test("should have row delays across active rows", () => {
    const config: ReplayConfig = {
      speed: 1.0,
      duration: 5000,
      baseUrl: "",
      filterPatterns: [],
    };

    engine.setData(sampleData, config);
    const state = engine.getState();

    // sampleData row gaps are 5000ms → R1@0, R2@5000 (R3@10000 cropped)
    expect(state.rowDelays).toEqual([5000, 0]);
  });

  test("should respect URL filter patterns", () => {
    const config: ReplayConfig = {
      speed: 1.0,
      duration: 0,
      baseUrl: "",
      filterPatterns: ["/api/posts"],
    };

    engine.setData(sampleData, config);
    const state = engine.getState();

    // Filtered URLs should not be in the replay list
    const filteredUrls = state.filteredData.map((d) => d.url);
    expect(filteredUrls).not.toContain("http://localhost:9000/api/posts");
    expect(filteredUrls).toHaveLength(2);
  });

  test("should apply base URL prefix to relative URLs", () => {
    const relativeData = [
      {
        datetime: new Date("2024-01-01T10:00:00Z"),
        url: "/api/users",
      },
      {
        datetime: new Date("2024-01-01T10:00:05Z"),
        url: "/api/posts",
      },
    ];

    const config: ReplayConfig = {
      speed: 1.0,
      duration: 0,
      baseUrl: "http://localhost:9000",
      filterPatterns: [],
    };

    engine.setData(relativeData, config);
    const state = engine.getState();

    expect(state.filteredData[0].url).toBe("http://localhost:9000/api/users");
    expect(state.filteredData[1].url).toBe("http://localhost:9000/api/posts");
  });

  test("should calculate timeseries data for preview", () => {
    const config: ReplayConfig = {
      speed: 1.0,
      duration: 0,
      baseUrl: "",
      filterPatterns: [],
    };

    engine.setData(sampleData, config);
    const state = engine.getState();

    expect(state.timeseries).toBeDefined();
    expect(state.timeseries.timestamps).toBeDefined();
    expect(state.timeseries.rpsValues).toBeDefined();
    expect(state.timeseries.timestamps.length).toBeGreaterThan(0);
  });

  test("should set total requests based on filtered data length", () => {
    const config: ReplayConfig = {
      speed: 1.0,
      duration: 10000, // matches sampleData span exactly
      baseUrl: "",
      filterPatterns: [],
    };

    engine.setData(sampleData, config);
    const state = engine.getState();

    // Total requests = active rows (cropped/repeated to fit duration)
    expect(state.totalRequests).toBe(3);
  });

  test("should handle large data sets efficiently", () => {
    const largeData = Array.from({ length: 1000 }, (_, i) => ({
      datetime: new Date(
        `2024-01-01T10:${String(Math.floor(i / 60)).padStart(2, "0")}:${(i % 60).toString().padStart(2, "0")}Z`,
      ),
      url: `http://localhost:9000/api/resource/${i % 50}`,
    }));

    const config: ReplayConfig = {
      speed: 1.0,
      duration: 0, // auto-set to full CSV span
      baseUrl: "",
      filterPatterns: [],
    };

    engine.setData(largeData, config);
    const state = engine.getState();

    expect(state.totalRequests).toBe(1000);
    expect(state.filteredData.length).toBe(1000);
    expect(state.timeseries.timestamps.length).toBeGreaterThan(0);
  });





  test("should support regex patterns in URL filtering", () => {
    const config: ReplayConfig = {
      speed: 1.0,
      duration: 0,
      baseUrl: "",
      filterPatterns: ["/api/(users|posts)"],
    };

    engine.setData(sampleData, config);
    const state = engine.getState();

    // Should only keep /api/items
    expect(state.filteredData).toHaveLength(1);
    expect(state.filteredData[0].url).toBe("http://localhost:9000/api/items");
  });

  test("should handle absolute URLs with baseUrl", () => {
    const data = [
      { datetime: new Date("2024-01-01T10:00:00Z"), url: "https://example.com/api/data" },
      { datetime: new Date("2024-01-01T10:00:05Z"), url: "/relative/path" },
    ];

    const config: ReplayConfig = {
      speed: 1.0,
      duration: 0,
      baseUrl: "http://localhost:9000",
      filterPatterns: [],
    };

    engine.setData(data, config);
    const state = engine.getState();

    // Absolute URL should remain unchanged
    expect(state.filteredData[0].url).toBe("https://example.com/api/data");
    // Relative URL should get baseUrl prefix
    expect(state.filteredData[1].url).toBe("http://localhost:9000/relative/path");
  });



  test("should start and complete replay", async () => {
    const fastData = [
      { datetime: new Date("2024-01-01T10:00:00.000Z"), url: "http://localhost:9000/a" },
      { datetime: new Date("2024-01-01T10:00:00.010Z"), url: "http://localhost:9000/b" },
      { datetime: new Date("2024-01-01T10:00:00.020Z"), url: "http://localhost:9000/c" },
    ];

    const config: ReplayConfig = {
      speed: 10.0,
      duration: 50,
      baseUrl: "",
      filterPatterns: [],
    };

    engine.setData(fastData, config);
    let stateUpdates = 0;
    engine.setProgressCallback(() => { stateUpdates++; });

    engine.start();
    expect(engine.getState().status).toBe("running");

    await new Promise((r) => setTimeout(r, 200));

    const finalState = engine.getState();
    expect(finalState.status).toBe("completed");
    expect(finalState.progress).toBe(1);
    // activeRows may be repeated (CSV 20ms < target 50ms), so count >= original data length
    expect(finalState.completedRequests).toBeGreaterThanOrEqual(3);
    expect(stateUpdates).toBeGreaterThan(0);
  });



  test("should return copy of filtered rows", () => {
    const config: ReplayConfig = {
      speed: 1.0,
      duration: 0,
      baseUrl: "",
      filterPatterns: [],
    };

    engine.setData(sampleData, config);
    const rows1 = engine.getFilteredRows();
    const rows2 = engine.getFilteredRows();

    // Should be equal in content but not same reference
    expect(rows1).toEqual(rows2);
    expect(rows1).not.toBe(rows2);
  });







  test("timeseries: 2 rows 1s apart with 1s override → 2 bins at 0.0s and 1.0s", () => {
    const data = [
      { datetime: new Date("2024-01-01T10:00:00Z"), url: "http://localhost/a" },
      { datetime: new Date("2024-01-01T10:00:01Z"), url: "http://localhost/b" },
    ];

    const config: ReplayConfig = {
      speed: 1.0,
      duration: 1000, // 1 second override
      baseUrl: "",
      filterPatterns: [],
    };

    engine.setData(data, config);
    const state = engine.getState();

    // Should have exactly 2 bins
    expect(state.timeseries.timestamps).toHaveLength(2);
    expect(state.timeseries.rpsValues).toHaveLength(2);
    // First bin at t=0, second at t=1000ms
    expect(state.timeseries.timestamps[0]).toBe(0);
    expect(state.timeseries.timestamps[1]).toBe(1000);
    // Each bin has 1 request
    expect(state.timeseries.rpsValues[0]).toBe(1);
    expect(state.timeseries.rpsValues[1]).toBe(1);
  });

  test("should handle empty data set", () => {
    const config: ReplayConfig = {
      speed: 1.0,
      duration: 0,
      baseUrl: "",
      filterPatterns: [],
    };

    engine.setData([], config);
    const state = engine.getState();

    expect(state.totalRequests).toBe(0);
    expect(state.filteredData).toHaveLength(0);
    expect(state.timeseries.timestamps).toHaveLength(0);
    expect(state.timeseries.rpsValues).toHaveLength(0);
  });

  test("should handle all URLs filtered out", () => {
    const config: ReplayConfig = {
      speed: 1.0,
      duration: 0,
      baseUrl: "",
      filterPatterns: [".*"], // match everything
    };

    engine.setData(sampleData, config);
    const state = engine.getState();

    expect(state.totalRequests).toBe(0);
    expect(state.filteredData).toHaveLength(0);
  });

  // ---- Duration truncation / repetition tests ----

  test("truncates: activeRows fits within target duration", () => {
    // sampleData spans 10s (3 rows at 5s intervals).
    // Target duration = 1s → should crop to the first row only.
    const config: ReplayConfig = {
      speed: 1.0,
      duration: 1000, // 1 second
      baseUrl: "",
      filterPatterns: [],
    };

    engine.setData(sampleData, config);
    const state = engine.getState();

    // activeRows should be cropped to fit within 1s
    expect(state.activeRows.length).toBe(1);
    expect(state.rowDelays).toEqual([0]);
  });

  test("repeats: activeRows fills duration when CSV is shorter", () => {
    // 2-row data spanning 5s. Target = 20s → repeat every 10s (span + min gap).
    // Rows: 0, 5000 | 10000, 15000 | 20000, 25000 — last cycle (start 20000 ≤ 20s)
    // plays to completion even though its second row lands past the window.
    const shortData = [
      { datetime: new Date("2024-01-01T10:00:00Z"), url: "http://localhost/a" },
      { datetime: new Date("2024-01-01T10:00:05Z"), url: "http://localhost/b" },
    ];

    const config: ReplayConfig = {
      speed: 1.0,
      duration: 20000, // 20 seconds
      baseUrl: "",
      filterPatterns: [],
    };

    engine.setData(shortData, config);
    const state = engine.getState();

    expect(state.activeRows.length).toBe(6);
    expect(state.rowDelays).toEqual([5000, 5000, 5000, 5000, 5000, 0]);
  });

  test("repeat exact boundary: 2 rows 1s apart, duration=2000ms → 4 rows (R1,R2,R1,R2)", () => {
    // The cycle starting at 2000ms fires fully: R1@2000, R2@3000.
    const data = [
      { datetime: new Date("2024-01-01T10:00:00Z"), url: "http://localhost/a" },
      { datetime: new Date("2024-01-01T10:00:01Z"), url: "http://localhost/b" },
    ];
    const config: ReplayConfig = {
      speed: 1.0,
      duration: 2000,
      baseUrl: "",
      filterPatterns: [],
    };

    engine.setData(data, config);
    const state = engine.getState();

    expect(state.activeRows.length).toBe(4); // R1, R2, R1, R2
    expect(state.rowDelays).toEqual([1000, 1000, 1000, 0]);
  });

  test("repeat: timeseries shows the completed-cycle RPS profile", () => {
    // 2 rows 1s apart, duration=2000ms → R1@0, R2@1000, R1@2000, R2@3000.
    // Bins over the 2s window: [1k)=1, [1k,2k)=1, [2k,3k)=2 (both @2000 and @3000).
    const data = [
      { datetime: new Date("2024-01-01T10:00:00Z"), url: "http://localhost/a" },
      { datetime: new Date("2024-01-01T10:00:01Z"), url: "http://localhost/b" },
    ];
    const config: ReplayConfig = {
      speed: 1.0,
      duration: 2000,
      baseUrl: "",
      filterPatterns: [],
    };

    engine.setData(data, config);
    const state = engine.getState();

    expect(state.timeseries.timestamps).toHaveLength(3); // bins at 0, 1000, 2000
    expect(state.timeseries.rpsValues).toEqual([1, 1, 2]);
  });

  test("exact fit: no repetition or cropping needed", () => {
    const config: ReplayConfig = {
      speed: 1.0,
      duration: 10000, // exactly matches sampleData span (10s)
      baseUrl: "",
      filterPatterns: [],
    };

    engine.setData(sampleData, config);
    const state = engine.getState();

    expect(state.activeRows.length).toBe(3);
  });

  test("duration=0 auto-sets to actual CSV span", () => {
    const config: ReplayConfig = {
      speed: 1.0,
      duration: 0,
      baseUrl: "",
      filterPatterns: [],
    };

    engine.setData(sampleData, config);
    const state = engine.getState();

    // Duration auto-set to actual CSV span (10s)
    expect(state.config?.duration).toBe(10000);
    // activeRows should be the full set
    expect(state.activeRows.length).toBe(3);
  });

  test("replay completes within target duration", async () => {
    const config: ReplayConfig = {
      speed: 1.0,
      duration: 500, // 500ms target
      baseUrl: "",
      filterPatterns: [],
    };

    engine.setData(sampleData, config);
    engine.setProgressCallback(() => {});
    engine.start();

    // Wait up to 2x the target duration for completion
    await new Promise((r) => setTimeout(r, 1500));

    const state = engine.getState();
    expect(state.status).toBe("completed");
    // sampleData spans 10s, target=500ms → cropped to ~1 row
    expect(state.completedRequests).toBeGreaterThanOrEqual(1);
    expect(state.elapsed).toBeLessThanOrEqual(1200); // allow margin
  });

  test("pause changes status to paused", () => {
    const config: ReplayConfig = {
      speed: 1.0,
      duration: 10000,
      baseUrl: "",
      filterPatterns: [],
    };

    engine.setData(sampleData, config);
    engine.start();
    expect(engine.getState().status).toBe("running");

    engine.pause();
    expect(engine.getState().status).toBe("paused");
  });

  test("resume changes status back to running", () => {
    const config: ReplayConfig = {
      speed: 1.0,
      duration: 10000,
      baseUrl: "",
      filterPatterns: [],
    };

    engine.setData(sampleData, config);
    engine.start();
    engine.pause();
    expect(engine.getState().status).toBe("paused");

    engine.resume();
    expect(engine.getState().status).toBe("running");
  });

  test("cancel changes status to cancelled", () => {
    const config: ReplayConfig = {
      speed: 1.0,
      duration: 10000,
      baseUrl: "",
      filterPatterns: [],
    };

    engine.setData(sampleData, config);
    engine.start();
    engine.cancel();
    expect(engine.getState().status).toBe("cancelled");
  });

  test("pause on non-running state is a no-op", () => {
    const config: ReplayConfig = {
      speed: 1.0,
      duration: 0,
      baseUrl: "",
      filterPatterns: [],
    };

    engine.setData(sampleData, config);
    engine.pause(); // idle → no-op
    expect(engine.getState().status).toBe("idle");
  });

  test("resume on non-paused state is a no-op", () => {
    const config: ReplayConfig = {
      speed: 1.0,
      duration: 0,
      baseUrl: "",
      filterPatterns: [],
    };

    engine.setData(sampleData, config);
    engine.resume(); // idle → no-op
    expect(engine.getState().status).toBe("idle");
  });

  test("cancel on idle is a no-op", () => {
    const config: ReplayConfig = {
      speed: 1.0,
      duration: 0,
      baseUrl: "",
      filterPatterns: [],
    };

    engine.setData(sampleData, config);
    engine.cancel(); // idle → no-op
    expect(engine.getState().status).toBe("idle");
  });

  test("start on running state is a no-op", () => {
    const config: ReplayConfig = {
      speed: 1.0,
      duration: 10000,
      baseUrl: "",
      filterPatterns: [],
    };

    engine.setData(sampleData, config);
    engine.start();
    engine.start(); // already running → no-op
    expect(engine.getState().status).toBe("running");
  });

  test("isRunning returns correct boolean", () => {
    const config: ReplayConfig = {
      speed: 1.0,
      duration: 10000,
      baseUrl: "",
      filterPatterns: [],
    };

    engine.setData(sampleData, config);
    expect(engine.isRunning()).toBe(false);

    engine.start();
    expect(engine.isRunning()).toBe(true);

    engine.pause();
    expect(engine.isRunning()).toBe(false);
  });

  test("timeseries RPS values are correct when data is repeated with gaps between cycles", () => {
    // 2 rows 1s apart, duration=3000ms → cycles at R1@0/R2@1000, R1@2000/R2@3000.
    // bin2 [2000,3000) contains only R1 → 1
    const data = [
      { datetime: new Date("2024-01-01T10:00:00Z"), url: "http://localhost/a" },
      { datetime: new Date("2024-01-01T10:00:01Z"), url: "http://localhost/b" },
    ];
    const config: ReplayConfig = {
      speed: 1.0,
      duration: 3000,
      baseUrl: "",
      filterPatterns: [],
    };

    engine.setData(data, config);
    const state = engine.getState();

    // Cycle 0: R1@0, R2@1000
    // Cycle 1: R1@2000, R2@3000
    // bin2 [2000,3000) contains only R1 → 1
    expect(state.timeseries.rpsValues[2]).toBe(1);
  });

  test("activeRows timing repeats with the tightest gap between cycles", () => {
    // 2 rows 1s apart, duration=3000ms
    // Rows: R1@0, R2@1000, R1@2000, R2@3000 (cycleAdvance = span + minGap)
    const data = [
      { datetime: new Date("2024-01-01T10:00:00Z"), url: "http://localhost/a" },
      { datetime: new Date("2024-01-01T10:00:01Z"), url: "http://localhost/b" },
    ];
    const config: ReplayConfig = {
      speed: 1.0,
      duration: 3000,
      baseUrl: "",
      filterPatterns: [],
    };

    engine.setData(data, config);
    const state = engine.getState();

    // Check timing of repeated rows
    // Row 2 should be at 2000ms (after gap), not 1000ms
    const row2Time = new Date(state.activeRows[2].datetime).getTime();
    const firstRowTime = new Date(state.activeRows[0].datetime).getTime();
    expect(row2Time - firstRowTime).toBe(2000); // Should be 2000ms, currently fails with 1000
  });

  test("speed scales row delays: 2 rows 5s apart, speed 2 → 2500ms", () => {
    const data = [
      { datetime: new Date("2024-01-01T10:00:00Z"), url: "http://localhost/a" },
      { datetime: new Date("2024-01-01T10:00:05Z"), url: "http://localhost/b" },
    ];
    const config: ReplayConfig = {
      speed: 2.0,
      duration: 0, // natural: span / speed = 5000 / 2 = 2500ms window
      baseUrl: "",
      filterPatterns: [],
    };

    engine.setData(data, config);
    const state = engine.getState();

    // Original 5s gap / speed 2 = 2.5s between the two rows
    expect(state.rowDelays[0]).toBe(2500);
    expect(state.config?.duration).toBe(2500); // auto-set to natural scaled span
  });

  test("speed changes repeat fill count: 2 rows 10s apart, override 20s", () => {
    const data = [
      { datetime: new Date("2024-01-01T10:00:00Z"), url: "http://localhost/a" },
      { datetime: new Date("2024-01-01T10:00:10Z"), url: "http://localhost/b" },
    ];

    const config1: ReplayConfig = {
      speed: 1.0,
      duration: 20000,
      baseUrl: "",
      filterPatterns: [],
    };
    engine.setData(data, config1);
    // cycles at 0 (@0,@10000) and 20000 (@20000,@30000 complete) → 4 rows
    expect(engine.getState().activeRows.length).toBe(4);

    const config2: ReplayConfig = {
      speed: 2.0,
      duration: 20000,
      baseUrl: "",
      filterPatterns: [],
    };
    engine.setData(data, config2);
    // gap/speed = 5s per step; cycles at 0,10000,20000 → 6 rows (0,5,10,15,20,25)
    expect(engine.getState().activeRows.length).toBe(6);
  });

  test("natural duration repeats to fill a longer window", () => {
    // 3 rows at 0, 5s, 6s with speed 1 → natural window = 6s, minGap = 1s.
    // Override 20s → rows at 0,5,6 | 7,12,13 | 14,19,20 (9 rows).
    const data = [
      { datetime: new Date("2024-01-01T10:00:00Z"), url: "http://localhost/a" },
      { datetime: new Date("2024-01-01T10:00:05Z"), url: "http://localhost/b" },
      { datetime: new Date("2024-01-01T10:00:06Z"), url: "http://localhost/c" },
    ];
    const config: ReplayConfig = {
      speed: 1.0,
      duration: 20000,
      baseUrl: "",
      filterPatterns: [],
    };

    engine.setData(data, config);
    const state = engine.getState();

    expect(state.activeRows.length).toBe(9);
    // gaps: 5s,1s within cycle; 1s wrap (min gap); repeats + 0 for last
    expect(state.rowDelays).toEqual([5000, 1000, 1000, 5000, 1000, 1000, 5000, 1000, 0]);
  });
});
