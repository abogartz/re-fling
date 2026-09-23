/**
 * TDD GREEN Phase for PRD #1 — Network Engine
 *
 * Goal: engine must call real `fetch()` on each URL during running state.
 * All tests should now PASS.
 */

import { test, expect, describe, beforeEach, afterEach, beforeAll } from "bun:test";
import { ReplayEngine, ReplayConfig } from "../replay/engine";

// ------------------------------ Mock Server ---------------------------------
const mockResponse: Record<string, [number, string]> = {
  "/api/users": [200, '{"users":[{"name":"Alice"}]}'],
  "/api/posts": [200, '{"posts":[{"title":"Hello"}]}'],
  "/api/items": [200, '[{"id":1,"name":"widget"}]'],
};

interface MockServerInfo { port: number }
let mockServer: MockServerInfo | null = null;

beforeAll(async () => {
  const server = Bun.serve({
    port: 0,
    fetch(req: Request) {
      const url = new URL(req.url);
      const entry = mockResponse[url.pathname];
      if (!entry) {
        return new Response("Not Found", { status: 404 });
      }
      const [status, body] = entry;
      return new Response(body, {
        status: status ?? 200,
        headers: { "Content-Type": "application/json" },
      });
    },
  });
  mockServer = { port: server.port ?? 0 };
});

function mockUrl(path: string): string {
  if (!mockServer) {
    return "";
  }
  return `http://localhost:${mockServer.port}${path}`;
}

function sampleData(paths: string[]) {
  return paths.map((p, i) => ({
    datetime: new Date(`2024-01-01T10:${i < 10 ? "0" : ""}${i}:00Z`),
    url: mockUrl(p),
  }));
}

// ------------------------------ Tests ---------------------------------------
describe("ReplayEngine — Network Behavior (PRD #1)", () => {
  let engine: ReplayEngine;

  beforeEach(() => {
    engine = new ReplayEngine();
  });

  afterEach(() => {
    if (engine.isRunning()) {
      engine.cancel();
    }
  });

  test("#1 completedRequests advances when URLs are reachable — GREEN target", async () => {
    const data = sampleData(["/api/users", "/api/posts"]);
    const config: ReplayConfig = {
      speed: 10.0,
      duration: 50,
      baseUrl: "", filterPatterns: [],
    };

    engine.setData(data, config);
    engine.setProgressCallback(() => {});
    engine.start();

    // Wait enough ticks for multiple progress updates
    await new Promise((r) => setTimeout(r, 350));

    const state = engine.getState();
    console.warn(
      `[GREEN] completed=${state.completedRequests}/{n=2} | ` +
      `status=${state.status} | elapsed=${state.elapsed}ms`,
    );
    expect(state.completedRequests).toBeGreaterThanOrEqual(1);
  });

  test("#2 engine counts per-request network errors as HTTP failures — GREEN target", async () => {
    const data = sampleData(["http://localhost:59999/dead-port"]); // unreachable — fetch rejects
    const config: ReplayConfig = {
      speed: 10.0,
      duration: 50,
      baseUrl: "", filterPatterns: [],
    };

    engine.setData(data, config);
    engine.setProgressCallback(() => {});
    engine.start();

    // Connection refusal on a dead localhost port surfaces asynchronously;
    // poll rather than guessing a fixed latency (machine-load dependent).
    const t0 = Date.now();
    while (Date.now() - t0 < 2000) {
      if (engine.getState().errors >= 1) {
        break;
      }
      await new Promise((r) => setTimeout(r, 50));
    }

    const state = engine.getState();
    console.warn(`[GREEN] errors=${state.errors} | status=${state.status}`);
    expect(state.errors).toBeGreaterThanOrEqual(1);
  });

  test("#3 engine tracks elapsed time correctly during running — GREEN target", async () => {
    // Use data with small gaps so elapsed progresses within wait window
    const data = [
      { datetime: new Date("2024-01-01T10:00:00.000Z"), url: mockUrl("/api/users") },
      { datetime: new Date("2024-01-01T10:00:00.050Z"), url: mockUrl("/api/posts") },
    ];
    const config: ReplayConfig = {
      speed: 10.0,
      duration: 0,
      baseUrl: "",
      filterPatterns: [],
    };

    engine.setData(data, config);
    engine.setProgressCallback(() => {});
    engine.start();

    // Gap: 50ms / 10x = 5ms. First tick fires immediately (elapsed≈0),
    // second tick after 1ms. Both complete well within 200ms.
    await new Promise((r) => setTimeout(r, 200));

    const finalState = engine.getState();
    console.warn(
      `[GREEN] elapsed=${finalState.elapsed} | status=${finalState.status}`,
    );

    // Engine should have elapsed time > 0 and be in running or completed state
    expect(finalState.elapsed).toBeGreaterThan(0);
    expect(["running", "completed"]).toContain(finalState.status);
  });

  test("#4 engine does not halt on network error — keeps status as running (GREEN target)", async () => {
    const badData = [{ datetime: new Date(), url: "http://192.0.2.1/timeout-test" }];
    // RFC5737 TEST-NET-1; requests will fail. Engine must keep running per agreement.
    const config: ReplayConfig = {
      speed: 1.0,
      duration: 0,
      baseUrl: "",
      filterPatterns: [],
    };

    engine.setData(badData, config);
    engine.setProgressCallback(() => {});
    engine.start();

    await new Promise((r) => setTimeout(r, 350));

    const state = engine.getState();
    console.warn(`[GREEN] status=${state.status} | errors=${state.errors}`);
    expect(state.status).not.toEqual("error");
  });
});
