import React from "react";
import { Card } from "../../components/ui/Card";

interface CsvLoaderProps {
  fileInputRef: React.RefObject<HTMLInputElement>;
  onFileLoad: () => void;
  onStart: () => void;
  onStop: () => void;
  isRunning: boolean;
  hasParsedData: boolean;
  columnMapping: { url?: string; datetime?: string };
  error: string | null;
  dataCount: number;
  totalRequests: number;
  durationEnabled: boolean;
  replayStatus: string;
  progress: number;
  completedRequests: number;
  actualDurationMs: number;
  speed: number;
}

const STATUS_COLORS: Record<string, string> = {
  idle: "text-gray-500",
  running: "text-blue-600",
  paused: "text-yellow-600",
  completed: "text-green-600",
  cancelled: "text-red-600",
  error: "text-red-600",
};

export function CsvLoader({
  fileInputRef,
  onFileLoad,
  onStart,
  onStop,
  isRunning,
  hasParsedData,
  columnMapping,
  error,
  dataCount,
  totalRequests,
  durationEnabled,
  replayStatus,
  progress,
  completedRequests,
}: CsvLoaderProps) {
  return (
    <Card title="Load CSV Data">
      <div className="flex gap-2 items-center">
        <input
          ref={fileInputRef}
          type="file"
          accept=".csv"
          onChange={onFileLoad}
          className="block flex-1 text-xs text-gray-400 file:mr-2 file:py-1 file:px-2 file:rounded file:border-0 file:text-xs file:font-semibold file:bg-blue-600 file:text-white hover:file:bg-blue-700"
        />
        <button
          onClick={onStart}
          disabled={isRunning || !hasParsedData || !columnMapping.url || !columnMapping.datetime}
          className="bg-blue-600 text-white px-2 py-1 rounded text-xs hover:bg-blue-700 disabled:bg-gray-400 disabled:text-gray-200 disabled:cursor-not-allowed disabled:hover:bg-gray-400 whitespace-nowrap"
        >
          Start
        </button>
        <button
          onClick={onStop}
          disabled={replayStatus === "idle" || replayStatus === "completed" || replayStatus === "cancelled"}
          className="bg-red-600 text-white px-2 py-1 rounded text-xs hover:bg-red-700 disabled:bg-gray-400 disabled:text-gray-200 disabled:cursor-not-allowed disabled:hover:bg-gray-400 whitespace-nowrap"
        >
          Stop
        </button>
      </div>
      {error && (
        <p className="mt-1 text-red-400 text-xs">{error}</p>
      )}
      {dataCount > 0 && (
        <p className="mt-1 text-green-400 text-xs">
          Loaded {dataCount} rows, columns mapped
        </p>
      )}
      {durationEnabled && totalRequests > 0 && (
        <p className="mt-1 text-blue-400 text-xs">
          Expected: {totalRequests} requests
        </p>
      )}
      {(replayStatus !== "idle" || completedRequests > 0) && (
        <div className="flex items-center gap-1.5 mt-1.5">
          <div className="text-[10px] font-medium text-white" data-testid="replay-status">Status:</div>
          <p className={`text-[10px] font-medium flex-1 ${STATUS_COLORS[replayStatus]}`}>
            {replayStatus}
          </p>
          <div className="w-24 bg-gray-700 rounded-full h-1.5">
            <div
              className="bg-blue-600 h-1.5 rounded-full transition-all"
              style={{ width: `${progress * 100}%` }}
            />
          </div>
          <p className="text-[10px] text-gray-400">
            {completedRequests}/{totalRequests}
          </p>
        </div>
      )}
    </Card>
  );
}
