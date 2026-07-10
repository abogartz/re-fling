import { useCallback } from "react";
import { getEffectiveDurationMs, type DurationUnit } from "../../utils/duration";
import { useAppStore } from "../../store/useAppStore";

export interface UseDurationReturn {
  speed: number;
  durationEnabled: boolean;
  durationValue: number;
  durationUnit: DurationUnit;
  setSpeed: (speed: number) => void;
  setDurationEnabled: (enabled: boolean) => void;
  setDurationValue: (value: number) => void;
  setDurationUnit: (unit: DurationUnit) => void;
}

export function useDuration(): UseDurationReturn {
  const speed = useAppStore((s) => s.speed);
  const durationEnabled = useAppStore((s) => s.durationEnabled);
  const durationValue = useAppStore((s) => s.durationValue);
  const durationUnit = useAppStore((s) => s.durationUnit);

  const setSpeed = useCallback(
    (speed: number) => useAppStore.getState().setSpeed(speed),
    [],
  );
  const setDurationEnabled = useCallback(
    (enabled: boolean) => useAppStore.getState().setDurationEnabled(enabled),
    [],
  );
  const setDurationValue = useCallback(
    (value: number) => useAppStore.getState().setDurationValue(value),
    [],
  );
  const setDurationUnit = useCallback(
    (unit: DurationUnit) => useAppStore.getState().setDurationUnit(unit),
    [],
  );

  return {
    speed,
    durationEnabled,
    durationValue,
    durationUnit,
    setSpeed,
    setDurationEnabled,
    setDurationValue,
    setDurationUnit,
  };
}

export { getEffectiveDurationMs };
