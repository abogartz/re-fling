import React from "react";
import { Card } from "../../components/ui/Card";
import { DurationUnit, formatDuration } from "../../utils/duration";

interface DurationControlsProps {
  speed: number;
  durationEnabled: boolean;
  durationValue: number;
  durationUnit: DurationUnit;
  actualDurationMs: number;
  onSpeedChange: (speed: number) => void;
  onDurationEnabledChange: (checked: boolean) => void;
  onDurationValueChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onDurationUnitChange: (e: React.ChangeEvent<HTMLSelectElement>) => void;
}

const SPEED_PRESETS = [0.5, 1, 2, 3];

export function DurationControls({
  speed,
  durationEnabled,
  durationValue,
  durationUnit,
  actualDurationMs,
  onSpeedChange,
  onDurationEnabledChange,
  onDurationValueChange,
  onDurationUnitChange,
}: DurationControlsProps) {
  return (
    <Card title="Replay Configuration">
      <div className="flex gap-2 items-center">
        <div className="flex-1">
          <label className="block text-[10px] font-medium text-gray-300 mb-0.5">
            Speed
          </label>
          <div className="flex gap-1 items-center">
            {SPEED_PRESETS.map((preset) => (
              <button
                key={preset}
                type="button"
                data-testid={`speed-preset-${preset}`}
                onClick={() => onSpeedChange(preset)}
                className={`px-2 py-0.5 rounded text-xs border transition-colors ${
                  speed === preset
                    ? "bg-blue-600 border-blue-600 text-white"
                    : "bg-[#333] border-gray-600 text-gray-300 hover:bg-[#3d3d3d]"
                }`}
              >
                {preset}×
              </button>
            ))}
            <span className="flex-1 flex items-center gap-1 ml-1">
              <input
                type="number"
                data-testid="speed-input"
                min="0.1"
                max="10"
                step="0.1"
                value={speed}
                onChange={(e) => {
                  const value = parseFloat(e.target.value);
                  if (!isNaN(value) && value > 0) {
                    onSpeedChange(value);
                  }
                }}
                className="w-16 border border-gray-600 bg-[#1a1a1a] text-white rounded px-1.5 py-0.5 text-xs"
              />
              <span className="text-[10px] text-gray-400">×</span>
            </span>
          </div>
        </div>
        <div className="flex-1">
          <label className="flex items-center gap-1 text-[10px] font-medium text-gray-300 mb-0.5">
            <input
              type="checkbox"
              checked={durationEnabled}
              onChange={(e) => onDurationEnabledChange(e.target.checked)}
              className="accent-blue-500 w-3 h-3"
            />
            Override Duration
          </label>
          <div className="flex gap-1">
            <input
              type="number"
              data-testid="duration-input"
              min="1"
              disabled={!durationEnabled}
              value={durationValue}
              onChange={onDurationValueChange}
              className="w-20 border border-gray-600 bg-[#1a1a1a] text-white rounded px-1.5 py-0.5 text-xs disabled:opacity-40 disabled:cursor-not-allowed"
            />
            <select
              value={durationUnit}
              onChange={onDurationUnitChange}
              disabled={!durationEnabled}
              className="flex-1 border border-gray-600 bg-[#1a1a1a] text-white rounded px-1 py-0.5 text-xs disabled:opacity-40 disabled:cursor-not-allowed"
            >
              <option value="seconds">seconds</option>
              <option value="minutes">minutes</option>
              <option value="hours">hours</option>
            </select>
          </div>
        </div>
      </div>
      {actualDurationMs > 0 && (
        <p className="text-[10px] text-gray-400 mt-0.5">
          CSV span: {formatDuration(actualDurationMs)} | Speed: {speed.toFixed(1)}x
        </p>
      )}
    </Card>
  );
}
