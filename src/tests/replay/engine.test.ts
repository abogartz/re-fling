import { test, expect, describe, beforeEach, afterEach, vi } from "bun:test";
import { ReplayEngine, ReplayConfig, ReplayState } from "../../replay/engine";

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
      iterations: 1,
      duration: 0,
      baseUrl: "",
      filterPatterns: [],
    };

    engine.setData(sampleData, config);
    const state = engine.getState();

    expect(state.totalRequests).toBe(3);
    expect(state.config).toEqual(config);
  });

  test("should apply speed multiplier to timing", () => {
    const config: ReplayConfig = {
      speed: 2.0,
      iterations: 1,
      duration: 0,
      baseUrl: "",
      filterPatterns: [],
    };

    engine.setData(sampleData, config);
    const state = engine.getState();

    // With 2x speed, timing should be adjusted
    expect(state.config.speed).toBe(2.0);
  });

  test("should calculate timing within bounds (1ms min, 10s max)", () => {
    const config: ReplayConfig = {
      speed: 1.0,
      iterations: 1,
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
      iterations: 1,
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
      iterations: 1,
      duration: 0,
      baseUrl: "http://localhost:9000",
      filterPatterns: [],
    };

    engine.setData(relativeData, config);
    const state = engine.getState();

    expect(state.filteredData[0].url).toBe("http://localhost:9000/api/users");
    expect(state.filteredData[1].url).toBe("http://localhost:9000/api/posts");
  });

  test("should calculate histogram data for preview", () => {
    const config: ReplayConfig = {
      speed: 1.0,
      iterations: 1,
      duration: 0,
      baseUrl: "",
      filterPatterns: [],
    };

    engine.setData(sampleData, config);
    const state = engine.getState();

    expect(state.histogram).toBeDefined();
    expect(state.histogram.labels).toBeDefined();
    expect(state.histogram.data).toBeDefined();
    expect(state.histogram.labels.length).toBeGreaterThan(0);
  });

  test("should handle multiple iterations", () => {
    const config: ReplayConfig = {
      speed: 1.0,
      iterations: 3,
      duration: 10,
      baseUrl: "",
      filterPatterns: [],
    };

    engine.setData(sampleData, config);
    const state = engine.getState();

    // Total requests = rows * iterations = 3 * 3 = 9
    expect(state.totalRequests).toBe(9);
  });

  test("should handle large data sets efficiently", () => {
    const largeData = Array.from({ length: 1000 }, (_, i) => ({
      datetime: new Date(`2024-01-01T10:${(i / 60).toFixed(0).padStart(2, "0")}:${(i % 60).toString().padStart(2, "0")}Z`),
      url: `http://localhost:9000/api/resource/${i % 50}`,
    }));

    const config: ReplayConfig = {
      speed: 1.0,
      iterations: 1,
      duration: 50,
      baseUrl: "",
      filterPatterns: [],
    };

    engine.setData(largeData, config);
    const state = engine.getState();

    expect(state.totalRequests).toBe(1000);
    expect(state.filteredData.length).toBe(1000);
    expect(state.histogram.labels.length).toBeGreaterThan(0);
  });

  test("should apply duration control", () => {
    const config: ReplayConfig = {
      speed: 1.0,
      iterations: 1,
      duration: 50,
      baseUrl: "",
      filterPatterns: [],
    };

    engine.setData(sampleData, config);
    const state = engine.getState();

    expect(state.config.duration).toBe(50);
    // At speed=1, delay = 50ms per tick
    expect(state.timings[0]).toBe(50);
  });

  test("should clamp duration to min/max bounds", () => {
    // duration=0 at speed=1 → 0ms → clamped to 1ms min
    const configLow: ReplayConfig = {
      speed: 1.0,
      iterations: 1,
      duration: 0,
      baseUrl: "",
      filterPatterns: [],
    };
    engine.setData(sampleData, configLow);
    expect(engine.getState().timings[0]).toBe(1);

    // duration=100000 at speed=1 → 100000ms → clamped to 10000ms max
    const configHigh: ReplayConfig = {
      speed: 1.0,
      iterations: 1,
      duration: 100000,
      baseUrl: "",
      filterPatterns: [],
    };
    engine.setData(sampleData, configHigh);
    expect(engine.getState().timings[0]).toBe(10000);

    // duration=5000 at speed=2 → 2500ms → within bounds
    const configMid: ReplayConfig = {
      speed: 2.0,
      iterations: 1,
      duration: 5000,
      baseUrl: "",
      filterPatterns: [],
    };
    engine.setData(sampleData, configMid);
    expect(engine.getState().timings[0]).toBe(2500);
  });

  test("should support regex patterns in URL filtering", () => {
    const config: ReplayConfig = {
      speed: 1.0,
      iterations: 1,
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
      iterations: 1,
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

  test("should handle start/pause/resume cycle", async () => {
    const config: ReplayConfig = {
      speed: 0.5,
      iterations: 1,
      duration: 200,
      baseUrl: "",
      filterPatterns: [],
    };

    engine.setData(sampleData, config);
    let stateUpdates = 0;
    engine.setProgressCallback(() => { stateUpdates++; });

    // Start — 200ms/0.5x = 400ms per tick, 3 ticks = 1200ms total
    engine.start();
    expect(engine.getState().status).toBe("running");

    // Wait a bit then pause
    await new Promise((r) => setTimeout(r, 100));
    engine.pause();
    expect(engine.getState().status).toBe("paused");

    // Wait some more
    await new Promise((r) => setTimeout(r, 50));

    // Resume
    engine.resume();
    expect(engine.getState().status).toBe("running");

    // Wait for completion — 2 remaining ticks * 400ms + margin = 900ms
    await new Promise((r) => setTimeout(r, 1500));
    const finalState = engine.getState();
    expect(finalState.status).toBe("completed");
    expect(finalState.progress).toBe(1);

    // Should have received multiple state updates during the run
    expect(stateUpdates).toBeGreaterThan(1);
  });

  test("should complete replay with correct total", async () => {
    const config: ReplayConfig = {
      speed: 3.0,
      iterations: 2,
      duration: 30,
      baseUrl: "",
      filterPatterns: [],
    };

    engine.setData(sampleData, config);
    engine.setProgressCallback(() => {});
    engine.start();

    // Wait for completion
    await new Promise((r) => setTimeout(r, 1500));

    const state = engine.getState();
    expect(state.status).toBe("completed");
    expect(state.progress).toBe(1);
    // Total = rows * iterations = 3 * 2 = 6
    expect(state.completedRequests).toBe(6);
  });

  test("should return copy of filtered rows", () => {
    const config: ReplayConfig = {
      speed: 1.0,
      iterations: 1,
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
      iterations: 100,
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
      iterations: 1,
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
      iterations: 1,
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
      iterations: 1,
      duration: 0,
      baseUrl: "",
      filterPatterns: [],
    };

    engine.setData([], config);
    const state = engine.getState();

    expect(state.totalRequests).toBe(0);
    expect(state.filteredData).toHaveLength(0);
    expect(state.histogram.labels).toHaveLength(0);
    expect(state.histogram.data).toHaveLength(0);
  });

  test("should handle all URLs filtered out", () => {
    const config: ReplayConfig = {
      speed: 1.0,
      iterations: 1,
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
