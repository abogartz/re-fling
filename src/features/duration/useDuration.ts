import { useState, useRef, useCallback } from "react";
import { DurationUnit, getEffectiveDurationMs } from "../../utils/duration";

export interface UseDurationReturn {
  speed: number;
  durationEnabled: boolean;
  durationValue: number;
  durationUnit: DurationUnit;
  speedRef: React.MutableRefObject<number>;
  durationValueRef: React.MutableRefObject<number>;
  durationUnitRef: React.MutableRefObject<DurationUnit>;
  durationEnabledRef: React.MutableRefObject<boolean>;
  setDurationEnabled: (v: boolean) => void;
  handleSpeedChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  handleDurationValueChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  handleDurationUnitChange: (e: React.ChangeEvent<HTMLSelectElement>) => void;
}

export function useDuration(): UseDurationReturn {
  const [speed, setSpeed] = useState(1.0);
  const [durationEnabled, setDurationEnabled] = useState(false);
  const [durationValue, setDurationValue] = useState(100);
  const [durationUnit, setDurationUnit] = useState<DurationUnit>("seconds");

  const speedRef = useRef(speed);
  speedRef.current = speed;

  const durationValueRef = useRef(durationValue);
  durationValueRef.current = durationValue;

  const durationUnitRef = useRef(durationUnit);
  durationUnitRef.current = durationUnit;

  const durationEnabledRef = useRef(durationEnabled);
  durationEnabledRef.current = durationEnabled;

  const handleSpeedChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const newSpeed = parseFloat(e.target.value) || 1;
    setSpeed(newSpeed);
  }, []);

  const handleDurationValueChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const val = parseInt(e.target.value, 10);
    if (isNaN(val) || val < 0) { return; }
    durationValueRef.current = val;
    setDurationValue(val);
  }, []);

  const handleDurationUnitChange = useCallback((e: React.ChangeEvent<HTMLSelectElement>) => {
    durationUnitRef.current = e.target.value as DurationUnit;
    setDurationUnit(e.target.value as DurationUnit);
  }, []);

  return {
    speed,
    durationEnabled,
    durationValue,
    durationUnit,
    speedRef,
    durationValueRef,
    durationUnitRef,
    durationEnabledRef,
    setDurationEnabled,
    handleSpeedChange,
    handleDurationValueChange,
    handleDurationUnitChange,
  };
}

export { getEffectiveDurationMs };
