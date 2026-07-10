import { test, expect, describe, beforeEach } from "bun:test";
import { renderHook, act } from "@testing-library/react";
import { useDuration } from "./useDuration";
import { useAppStore } from "../../store/useAppStore";

// Reset store between tests to avoid cross-test pollution
beforeEach(() => {
  const store = useAppStore.getState();
  store.setSpeed(1);
  store.setDurationEnabled(false);
  store.setDurationValue(100);
  store.setDurationUnit("seconds");
});

describe("useDuration", () => {
  test("returns default speed of 1.0", () => {
    const { result } = renderHook(() => useDuration());
    expect(result.current.speed).toBe(1.0);
  });

  test("returns default durationEnabled false", () => {
    const { result } = renderHook(() => useDuration());
    expect(result.current.durationEnabled).toBe(false);
  });

  test("returns default durationValue of 100", () => {
    const { result } = renderHook(() => useDuration());
    expect(result.current.durationValue).toBe(100);
  });

  test("returns default durationUnit of seconds", () => {
    const { result } = renderHook(() => useDuration());
    expect(result.current.durationUnit).toBe("seconds");
  });

  test("setSpeed updates speed state", () => {
    const { result } = renderHook(() => useDuration());
    act(() => {
      result.current.setSpeed(2.5);
    });
    expect(result.current.speed).toBe(2.5);
  });

  test("setDurationEnabled updates enabled state", () => {
    const { result } = renderHook(() => useDuration());
    act(() => {
      result.current.setDurationEnabled(true);
    });
    expect(result.current.durationEnabled).toBe(true);
  });

  test("setDurationValue updates value state", () => {
    const { result } = renderHook(() => useDuration());
    act(() => {
      result.current.setDurationValue(200);
    });
    expect(result.current.durationValue).toBe(200);
  });

  test("setDurationUnit updates unit state", () => {
    const { result } = renderHook(() => useDuration());
    act(() => {
      result.current.setDurationUnit("minutes");
    });
    expect(result.current.durationUnit).toBe("minutes");
  });

  test("setDurationUnit accepts hours", () => {
    const { result } = renderHook(() => useDuration());
    act(() => {
      result.current.setDurationUnit("hours");
    });
    expect(result.current.durationUnit).toBe("hours");
  });

  test("state changes reflect across re-renders", () => {
    const { result, rerender } = renderHook(() => useDuration());
    act(() => {
      result.current.setSpeed(3);
    });
    rerender();
    expect(result.current.speed).toBe(3);
  });

  test("setSpeed with zero works", () => {
    const { result } = renderHook(() => useDuration());
    act(() => {
      result.current.setSpeed(0);
    });
    expect(result.current.speed).toBe(0);
  });

  test("setDurationValue with zero works", () => {
    const { result } = renderHook(() => useDuration());
    act(() => {
      result.current.setDurationValue(0);
    });
    expect(result.current.durationValue).toBe(0);
  });

  test("setter functions are stable references", () => {
    const { result, rerender } = renderHook(() => useDuration());
    const firstSetSpeed = result.current.setSpeed;
    rerender();
    expect(result.current.setSpeed).toBe(firstSetSpeed);
  });
});
