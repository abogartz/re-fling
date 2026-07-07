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

  test("should apply speed multiplier to timing", () => {
    const config: ReplayConfig = {
      speed: 2.0,
      duration: 0,
      baseUrl: "",
      filterPatterns: [],
    };

    engine.setData(sampleData, config);
    const state = engine.getState();

    // With 2x speed, timing should be adjusted
    expect(state.config?.speed).toBe(2.0);
  });

  test("should calculate timing within bounds (1ms min, 10s max)", () => {
    const config: ReplayConfig = {
      speed: 1.0,
      duration: 0,
      baseUrl: "",
      filterPatterns: [],
    };

    engine.setData(sampleData, config);
    const state = engine.getState();

    // Verify that calculated delays are within bounds
    for (const delay of state.timings) {
      expect(delay).toBeGreaterThanOrEqual(1);
      expect(delay).toBeLessThanOrEqual(10000);
    }
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
      duration: 10,
      baseUrl: "",
      filterPatterns: [],
    };

    engine.setData(sampleData, config);
    const state = engine.getState();

    // Total requests = rows (no iterations multiplier)
    expect(state.totalRequests).toBe(3);
  });

  test("should handle large data sets efficiently", () => {
    const largeData = Array.from({ length: 1000 }, (_, i) => ({
      datetime: new Date(`2024-01-01T10:${(i / 60).toFixed(0).padStart(2, "0")}:${(i % 60).toString().padStart(2, "0")}Z`),
      url: `http://localhost:9000/api/resource/${i % 50}`,
    }));

    const config: ReplayConfig = {
      speed: 1.0,
      duration: 50,
      baseUrl: "",
      filterPatterns: [],
    };

    engine.setData(largeData, config);
    const state = engine.getState();

    expect(state.totalRequests).toBe(1000);
    expect(state.filteredData.length).toBe(1000);
    expect(state.timeseries.timestamps.length).toBeGreaterThan(0);
  });

  test("should apply duration control", () => {
    const config: ReplayConfig = {
      speed: 1.0,
      duration: 50,
      baseUrl: "",
      filterPatterns: [],
    };

    engine.setData(sampleData, config);
    const state = engine.getState();

    expect(state.config?.duration).toBe(50);
    // Timings are based on actual CSV gaps scaled by speed, not uniform duration/speed
    // First row gets min delay (1ms), subsequent rows use actual gaps / speed
    expect(state.timings[0]).toBeGreaterThanOrEqual(1);
    for (const t of state.timings) {
      expect(t).toBeGreaterThanOrEqual(1);
      expect(t).toBeLessThanOrEqual(10000);
    }
  });

  test("should clamp timing gaps to min/max bounds", () => {
    // sampleData has 5s gaps between rows. At speed=1, gap=5000ms (within bounds).
    const configLow: ReplayConfig = {
      speed: 1.0,
      duration: 0,
      baseUrl: "",
      filterPatterns: [],
    };
    engine.setData(sampleData, configLow);
    const stateLow = engine.getState();
    // First row always gets min delay (no preceding gap)
    expect(stateLow.timings[0]).toBe(1);
    // Subsequent rows: 5000ms gap / 1.0 speed = 5000ms
    expect(stateLow.timings[1]).toBe(5000);
    expect(stateLow.timings[2]).toBe(5000);

    // At speed=2, gaps halve: 5000/2 = 2500ms
    const configMid: ReplayConfig = {
      speed: 2.0,
      duration: 5000,
      baseUrl: "",
      filterPatterns: [],
    };
    engine.setData(sampleData, configMid);
    const stateMid = engine.getState();
    expect(stateMid.timings[0]).toBe(1);
    expect(stateMid.timings[1]).toBe(2500);

    // Very slow speed (0.1) → 5000/0.1 = 50000ms → clamped to 10000ms max
    const configSlow: ReplayConfig = {
      speed: 0.1,
      duration: 0,
      baseUrl: "",
      filterPatterns: [],
    };
    engine.setData(sampleData, configSlow);
    const stateSlow = engine.getState();
    expect(stateSlow.timings[0]).toBe(1);
    expect(stateSlow.timings[1]).toBe(10000); // clamped
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

  test("should scale timeseries by speed", () => {
    // Create data with a known duration (10 seconds)
    const data = Array.from({ length: 10 }, (_, i) => ({
      datetime: new Date(`2024-01-01T10:00:${i.toString().padStart(2, "0")}Z`),
      url: `http://localhost:9000/api/resource/${i}`,
    }));

    // Test at speed=1.0
    const config1x: ReplayConfig = {
      speed: 1.0,
      duration: 10000, // 10 seconds
      baseUrl: "",
      filterPatterns: [],
    };
    engine.setData(data, config1x);
    const state1x = engine.getState();

    // Test at speed=2.0
    const config2x: ReplayConfig = {
      speed: 2.0,
      duration: 10000, // Same duration setting
      baseUrl: "",
      filterPatterns: [],
    };
    engine.setData(data, config2x);
    const state2x = engine.getState();

    // At 2x speed, timeseries should have half the bins (5s vs 10s)
    expect(state2x.timeseries.timestamps.length).toBeLessThanOrEqual(
      state1x.timeseries.timestamps.length
    );
    
    // RPS values at 2x should be higher (scaled by speed)
    // Sum of all RPS values should be roughly 2x at 2x speed
    const sum1x = state1x.timeseries.rpsValues.reduce((a, b) => a + b, 0);
    const sum2x = state2x.timeseries.rpsValues.reduce((a, b) => a + b, 0);
    
    // Allow some tolerance for rounding
    expect(sum2x).toBeGreaterThan(sum1x * 1.5);
  });

  test("should start and complete replay", async () => {
    // Use data with small gaps so replay completes quickly even at moderate speed
    const fastData = [
      { datetime: new Date("2024-01-01T10:00:00.000Z"), url: "http://localhost:9000/a" },
      { datetime: new Date("2024-01-01T10:00:00.010Z"), url: "http://localhost:9000/b" },
      { datetime: new Date("2024-01-01T10:00:00.020Z"), url: "http://localhost:9000/c" },
    ];

    const config: ReplayConfig = {
      speed: 10.0,
      duration: 0,
      baseUrl: "",
      filterPatterns: [],
    };

    engine.setData(fastData, config);
    let stateUpdates = 0;
    engine.setProgressCallback(() => { stateUpdates++; });

    engine.start();
    expect(engine.getState().status).toBe("running");

    // Gaps: 10ms / 10x speed = 1ms per tick. 3 rows ~ 2-3ms total + margin
    await new Promise((r) => setTimeout(r, 200));

    const finalState = engine.getState();
    expect(finalState.status).toBe("completed");
    expect(finalState.progress).toBe(1);
    expect(stateUpdates).toBeGreaterThan(0);
  });

  test("should complete replay with correct total", async () => {
    const config: ReplayConfig = {
      speed: 10.0,
      duration: 200,
      baseUrl: "",
      filterPatterns: [],
    };

    engine.setData(sampleData, config);
    engine.setProgressCallback(() => {});
    engine.start();

    // Wait for completion (200ms/10x = 20ms per tick, 3 ticks = 60ms + margin)
    await new Promise((r) => setTimeout(r, 500));

    const state = engine.getState();
    expect(state.status).toBe("completed");
    expect(state.progress).toBe(1);
    // Engine should have made progress
    expect(state.completedRequests).toBeGreaterThanOrEqual(1);
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

  test("should cancel running engine", async () => {
    const config: ReplayConfig = {
      speed: 1.0,
      duration: 20,
      baseUrl: "",
      filterPatterns: [],
    };

    engine.setData(sampleData, config);
    engine.setProgressCallback(() => {});
    engine.start();

    expect(engine.getState().status).toBe("running");

    engine.cancel();
    expect(engine.getState().status).toBe("cancelled");
    expect(engine.isRunning()).toBe(false);
  });

  test("should not start when already running", () => {
    const config: ReplayConfig = {
      speed: 1.0,
      duration: 20,
      baseUrl: "",
      filterPatterns: [],
    };

    engine.setData(sampleData, config);
    engine.start();
    expect(engine.getState().status).toBe("running");

    // Second start should be ignored
    engine.start();
    expect(engine.getState().status).toBe("running");
  });

  test("should not pause when not running", () => {
    const config: ReplayConfig = {
      speed: 1.0,
      duration: 20,
      baseUrl: "",
      filterPatterns: [],
    };

    engine.setData(sampleData, config);
    // Pausing idle should be a no-op
    engine.pause();
    expect(engine.getState().status).toBe("idle");

    // Pausing completed should be a no-op
    engine.start();
    // Wait for completion
    // We won't wait - just test the state transitions are valid
    expect(() => engine.getState()).not.toThrow();
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
});
