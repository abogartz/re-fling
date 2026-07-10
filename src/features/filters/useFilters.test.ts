import { test, expect, describe, beforeEach } from "bun:test";
import { renderHook, act } from "@testing-library/react";
import { useFilters } from "./useFilters";
import { useAppStore } from "../../store/useAppStore";

beforeEach(() => {
  const store = useAppStore.getState();
  store.setBaseUrl("");
  store.setFilterPatterns("");
});

describe("useFilters", () => {
  test("returns default baseUrl empty string", () => {
    const { result } = renderHook(() => useFilters());
    expect(result.current.baseUrl).toBe("");
  });

  test("returns default filterPatterns empty string", () => {
    const { result } = renderHook(() => useFilters());
    expect(result.current.filterPatterns).toBe("");
  });

  test("setBaseUrl updates baseUrl state", () => {
    const { result } = renderHook(() => useFilters());
    act(() => {
      result.current.setBaseUrl("http://example.com");
    });
    expect(result.current.baseUrl).toBe("http://example.com");
  });

  test("setFilterPatterns updates filterPatterns state", () => {
    const { result } = renderHook(() => useFilters());
    act(() => {
      result.current.setFilterPatterns("/api/users");
    });
    expect(result.current.filterPatterns).toBe("/api/users");
  });

  test("setBaseUrl with localhost URL works", () => {
    const { result } = renderHook(() => useFilters());
    act(() => {
      result.current.setBaseUrl("http://localhost:3000");
    });
    expect(result.current.baseUrl).toBe("http://localhost:3000");
  });

  test("setFilterPatterns with regex works", () => {
    const { result } = renderHook(() => useFilters());
    act(() => {
      result.current.setFilterPatterns("/api/(users|posts)/.*");
    });
    expect(result.current.filterPatterns).toBe("/api/(users|posts)/.*");
  });

  test("setFilterPatterns with comma-separated patterns works", () => {
    const { result } = renderHook(() => useFilters());
    act(() => {
      result.current.setFilterPatterns("/api/users,/api/posts");
    });
    expect(result.current.filterPatterns).toBe("/api/users,/api/posts");
  });

  test("state changes persist across re-renders", () => {
    const { result, rerender } = renderHook(() => useFilters());
    act(() => {
      result.current.setBaseUrl("http://test.com");
    });
    rerender();
    expect(result.current.baseUrl).toBe("http://test.com");
  });

  test("setter functions are stable references", () => {
    const { result, rerender } = renderHook(() => useFilters());
    const firstSetBaseUrl = result.current.setBaseUrl;
    rerender();
    expect(result.current.setBaseUrl).toBe(firstSetBaseUrl);
  });

  test("can set empty string to clear values", () => {
    const { result } = renderHook(() => useFilters());
    act(() => {
      result.current.setBaseUrl("http://example.com");
      result.current.setFilterPatterns("/api");
    });
    expect(result.current.baseUrl).toBe("http://example.com");
    expect(result.current.filterPatterns).toBe("/api");

    act(() => {
      result.current.setBaseUrl("");
      result.current.setFilterPatterns("");
    });
    expect(result.current.baseUrl).toBe("");
    expect(result.current.filterPatterns).toBe("");
  });
});
