import { test, expect, describe, beforeEach, afterEach } from "bun:test";
import { ReplayEngine, ReplayConfig } from "../../replay/engine";

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

  test("should have uniform delay across active rows", () => {
    const config: ReplayConfig = {
      speed: 1.0,
      duration: 5000,
      baseUrl: "",
      filterPatterns: [],
    };

    engine.setData(sampleData, config);
    const state = engine.getState();

    // All rows in active array should use same delay
    expect(state.delayMs).toBeGreaterThan(0);
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
      datetime: new Date(`2024-01-01T10:${(i / 60).toFixed(0).padStart(2, "0")}:${(i % 60).toString().padStart(2, "0")}Z`),
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
    // Target duration = 1s → should crop to ~1 row.
    const config: ReplayConfig = {
      speed: 1.0,
      duration: 1000, // 1 second
      baseUrl: "",
      filterPatterns: [],
    };

    engine.setData(sampleData, config);
    const state = engine.getState();

    // activeRows should be cropped to fit within 1s
    expect(state.activeRows.length).toBeLessThanOrEqual(3);
    // delayMs should be uniform
    if (state.activeRows.length > 1) {
      expect(state.delayMs).toBeCloseTo(1000 / (state.activeRows.length - 1), 0);
    }
  });

  test("repeats: activeRows fills duration when CSV is shorter", () => {
    // 2-row data spanning 5s. Target = 20s → should repeat ~4x.
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

    // activeRows should be longer than original (repeated)
    expect(state.activeRows.length).toBeGreaterThan(shortData.length);
    // Uniform delay across all rows
    if (state.activeRows.length > 1) {
      expect(state.delayMs).toBeCloseTo(20000 / (state.activeRows.length - 1), 0);
    }
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
    expect(state.elapsed).toBeLessThanOrEqual(1200); // allow margin
  });
});
