import React from "react";
import { DurationUnit } from "../../utils/duration";

interface DurationControlsProps {
  speed: number;
  durationEnabled: boolean;
  durationValue: number;
  durationUnit: DurationUnit;
  actualDurationMs: number;
  onSpeedChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onDurationEnabledChange: (checked: boolean) => void;
  onDurationValueChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onDurationUnitChange: (e: React.ChangeEvent<HTMLSelectElement>) => void;
}

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
    <div className="bg-[#252525] rounded-lg border border-gray-700 p-2 mb-2">
      <h2 className="text-xs font-semibold mb-1 text-white">Replay Configuration</h2>
      <div className="flex gap-2 items-center">
        <div className="flex-1">
          <label className="block text-[10px] font-medium text-gray-300 mb-0.5">
            Speed
          </label>
          <input
            type="range"
            min="0.1"
            max="3"
            step="0.1"
            value={speed}
            onChange={onSpeedChange}
            className="w-full h-3"
          />
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
    </div>
  );
}

function formatDuration(ms: number): string {
  const seconds = Math.floor(ms / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);

  if (hours > 0) {
    return `${hours}h ${minutes % 60}m`;
  }
  if (minutes > 0) {
    return `${minutes}m ${seconds % 60}s`;
  }
  return `${seconds}s`;
}
