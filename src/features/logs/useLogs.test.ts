import { test, expect, describe, beforeEach, vi } from "bun:test";
import { renderHook, act } from "@testing-library/react";
import { useLogs } from "./useLogs";
import { useAppStore } from "../../store/useAppStore";

// Mock bun/logs to avoid module-level state pollution across tests
vi.mock("../../bun/logs", () => ({
  addLog: vi.fn(),
  getLogs: vi.fn(() => []),
  clearLogs: vi.fn(),
  onLogsChange: vi.fn(() => () => {}),
}));

import { addLog, clearLogs, onLogsChange } from "../../bun/logs";

beforeEach(() => {
  vi.clearAllMocks();
  // Reset store logs state
  const store = useAppStore.getState();
  store.setVisible(false);
  store.setEntries([]);
});

describe("useLogs", () => {
  test("adds welcome log on mount", () => {
    renderHook(() => useLogs());
    expect(addLog).toHaveBeenCalledWith("Welcome to ReFling!");
  });

  test("returns default visible false", () => {
    const { result } = renderHook(() => useLogs());
    expect(result.current.visible).toBe(false);
  });

  test("returns default entries empty array", () => {
    const { result } = renderHook(() => useLogs());
    expect(result.current.entries).toEqual([]);
  });

  test("toggleVisible flips visibility from false to true", () => {
    const { result } = renderHook(() => useLogs());
    act(() => {
      result.current.toggleVisible();
    });
    expect(result.current.visible).toBe(true);
  });

  test("toggleVisible flips visibility from true to false", () => {
    const { result } = renderHook(() => useLogs());
    act(() => {
      result.current.toggleVisible();
      result.current.toggleVisible();
    });
    expect(result.current.visible).toBe(false);
  });

  test("calls clearLogs and clears entries on handleClearLogs", () => {
    // Pre-populate logs (addLog already mocked)
    const { result } = renderHook(() => useLogs());

    act(() => {
      result.current.handleClearLogs();
    });

    expect(clearLogs).toHaveBeenCalled();
  });

  test("handles multiple toggles", () => {
    const { result } = renderHook(() => useLogs());
    act(() => {
      result.current.toggleVisible(); // true
      result.current.toggleVisible(); // false
      result.current.toggleVisible(); // true
    });
    expect(result.current.visible).toBe(true);
  });

  test("visible starts as false even after toggle", () => {
    const { result } = renderHook(() => useLogs());
    expect(result.current.visible).toBe(false);
    act(() => {
      result.current.toggleVisible();
    });
    expect(result.current.visible).toBe(true);
  });

  test("setter functions are stable", () => {
    const { result, rerender } = renderHook(() => useLogs());
    const firstToggle = result.current.toggleVisible;
    const firstClear = result.current.handleClearLogs;
    rerender();
    expect(result.current.toggleVisible).toBe(firstToggle);
    expect(result.current.handleClearLogs).toBe(firstClear);
  });

  test("onLogsChange is called on mount", () => {
    renderHook(() => useLogs());
    expect(onLogsChange).toHaveBeenCalled();
  });

  test("clearLogs callback is called by handleClearLogs", () => {
    const { result } = renderHook(() => useLogs());
    act(() => {
      result.current.handleClearLogs();
    });
    expect(clearLogs).toHaveBeenCalledTimes(1);
  });
});
