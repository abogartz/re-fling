import { useCallback } from "react";
import { useAppStore } from "../../store/useAppStore";
import type { CSVRow } from "../../csv/parser";
import type { ReplayConfig } from "../../replay/engine";

export interface UseReplayReturn {
  status: string;
  progress: number;
  totalRequests: number;
  completedRequests: number;
  actualDurationMs: number;
  timeseries: { timestamps: number[]; rpsValues: number[] };
  startReplay: (data: CSVRow[], config: ReplayConfig) => void;
  stopReplay: () => void;
}

export function useReplay(): UseReplayReturn {
  const status = useAppStore((s) => s.status);
  const progress = useAppStore((s) => s.progress);
  const totalRequests = useAppStore((s) => s.totalRequests);
  const completedRequests = useAppStore((s) => s.completedRequests);
  const actualDurationMs = useAppStore((s) => s.actualDurationMs);
  const timeseries = useAppStore((s) => s.timeseries);
  const startReplay = useCallback(
    (data: CSVRow[], config: ReplayConfig) =>
      useAppStore.getState().startReplay(data, config),
    [],
  );
  const stopReplay = useCallback(
    () => useAppStore.getState().stopReplay(),
    [],
  );

  return {
    status,
    progress,
    totalRequests,
    completedRequests,
    actualDurationMs,
    timeseries,
    startReplay,
    stopReplay,
  };
}
