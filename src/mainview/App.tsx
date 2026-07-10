import React, { useEffect } from "react";
import { useAppStore } from "../store/useAppStore";
import { getEffectiveDurationMs, calculateActualDuration } from "../utils/duration";
import { calculateExpectedTimeseries } from "../utils/timeseries";
import { addLog } from "../bun/logs";
import { formatRequestsForLog } from "../services/csv-formatter";
import { useCsvLoad } from "../features/csv/useCsvLoad";
import { CsvLoader } from "../features/csv/CsvLoader";
import { DurationControls } from "../features/duration/DurationControls";

import { Filters } from "../features/filters/Filters";
import { useFilters } from "../features/filters/useFilters";
import { ColumnMapping } from "../features/columns/ColumnMapping";
import { LogsPanel } from "../features/logs/LogsPanel";
import { useLogs } from "../features/logs/useLogs";
import { TimeseriesChart } from "./TimeseriesChart";

function App() {
  const csv = useCsvLoad();
  const filt = useFilters();
  const logs = useLogs();

  const startReplay = useAppStore((s) => s.startReplay);
  const stopReplay = useAppStore((s) => s.stopReplay);
  const status = useAppStore((s) => s.status);
  const progress = useAppStore((s) => s.progress);
  const totalRequests = useAppStore((s) => s.totalRequests);
  const completedRequests = useAppStore((s) => s.completedRequests);
  const actualDurationMs = useAppStore((s) => s.actualDurationMs);
  const timeseries = useAppStore((s) => s.timeseries);
  const speed = useAppStore((s) => s.speed);
  const durationEnabled = useAppStore((s) => s.durationEnabled);
  const durationValue = useAppStore((s) => s.durationValue);
  const durationUnit = useAppStore((s) => s.durationUnit);
  const setPreviewStats = useAppStore((s) => s.setPreviewStats);

  // Recalculate timeseries when parsed data changes
  useEffect(() => {
    if (!csv.parsedData) {
      return;
    }
    const state = useAppStore.getState();
    const result = recalcTimeseries(csv.parsedData, state);
    setPreviewStats(result.timeseries, result.totalRequests);

    if (csv.parsedData.data.length > 0) {
      const effectiveDuration = getEffectiveDurationMs(
        state.durationEnabled, state.durationValue, state.durationUnit,
      ) || calculateActualDuration(csv.parsedData.data);
      addLog(formatRequestsForLog(csv.parsedData.data, state.speed, effectiveDuration));
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [csv.parsedData]);

  const handleSpeedChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newSpeed = parseFloat(e.target.value) || 1;
    useAppStore.getState().setSpeed(newSpeed);

    if (csv.parsedData && csv.parsedData.data.length > 0) {
      const state = useAppStore.getState();
      const effectiveDuration = getEffectiveDurationMs(
        state.durationEnabled, state.durationValue, state.durationUnit,
      ) || calculateActualDuration(csv.parsedData.data);
      addLog(formatRequestsForLog(csv.parsedData.data, newSpeed, effectiveDuration));
    }

    if (csv.parsedData) {
      const state = useAppStore.getState();
      const result = recalcTimeseries(csv.parsedData, state);
      setPreviewStats(result.timeseries, result.totalRequests);
    }
  };

  const handleDurationValueChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = parseInt(e.target.value, 10);
    if (!isNaN(val) && val >= 0) {
      useAppStore.getState().setDurationValue(val);
    }

    const state = useAppStore.getState();
    if (csv.parsedData && csv.parsedData.data.length > 0 && state.durationEnabled) {
      const effectiveDuration = getEffectiveDurationMs(
        state.durationEnabled, state.durationValue, state.durationUnit,
      );
      addLog(formatRequestsForLog(csv.parsedData.data, state.speed, effectiveDuration));
    }

    if (csv.parsedData) {
      const result = recalcTimeseries(csv.parsedData, state);
      setPreviewStats(result.timeseries, result.totalRequests);
    }
  };

  const handleDurationUnitChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    useAppStore.getState().setDurationUnit(e.target.value as "seconds" | "minutes" | "hours");

    const state = useAppStore.getState();
    if (csv.parsedData && csv.parsedData.data.length > 0 && state.durationEnabled) {
      const effectiveDuration = getEffectiveDurationMs(
        state.durationEnabled, state.durationValue, state.durationUnit,
      );
      addLog(formatRequestsForLog(csv.parsedData.data, state.speed, effectiveDuration));
    }

    if (csv.parsedData) {
      const result = recalcTimeseries(csv.parsedData, state);
      setPreviewStats(result.timeseries, result.totalRequests);
    }
  };

  const handleDurationEnabledChange = (checked: boolean) => {
    useAppStore.getState().setDurationEnabled(checked);
    if (csv.parsedData) {
      const state = useAppStore.getState();
      const result = recalcTimeseries(csv.parsedData, state);
      setPreviewStats(result.timeseries, result.totalRequests);
    }
  };

  return (
    <div className="min-h-screen bg-[#1a1a1a] p-2">
      {/* Header */}
      <div className="flex items-center justify-between mb-2">
        <div>
          <h1 className="text-lg font-bold text-white">ReFling</h1>
          <p className="text-gray-400 text-xs">
            Replay historical traffic patterns exactly as they occurred.
          </p>
        </div>
      </div>

      {/* Logs Toggle Button */}
      <button
        onClick={logs.toggleVisible}
        data-testid="logs-toggle-btn"
        className="bg-[#252525] border border-gray-700 rounded-lg px-3 py-1.5 hover:bg-[#333] transition-colors text-xs text-gray-300 mb-2"
      >
        {logs.visible ? "Hide Logs" : "Show Logs"} ({logs.entries.length})
      </button>

      <div className="max-w-4xl mx-auto">
        {/* CSV Loader */}
        <CsvLoader
          fileInputRef={csv.fileInputRef}
          onFileLoad={csv.handleFileLoad}
          onStart={() => {
            if (!csv.parsedData) {
              return;
            }
            const effectiveDurationMs = getEffectiveDurationMs(
              durationEnabled, durationValue, durationUnit,
            );
            const config = {
              speed: speed,
              duration: effectiveDurationMs > 0 ? effectiveDurationMs : calculateActualDuration(csv.parsedData.data),
              baseUrl: filt.baseUrl,
              filterPatterns: filt.filterPatterns
                .split(",")
                .map((s) => s.trim())
                .filter(Boolean),
            };
            startReplay(
              csv.parsedData.data.map((d) => ({ datetime: d.datetime, url: d.url })),
              config,
            );
          }}
          onStop={stopReplay}
          isRunning={status === "running"}
          hasParsedData={!!csv.parsedData}
          columnMapping={csv.columnMapping}
          error={csv.error}
          dataCount={csv.parsedData?.data.length ?? 0}
          totalRequests={totalRequests}
          durationEnabled={durationEnabled}
          replayStatus={status}
          progress={progress}
          completedRequests={completedRequests}
          actualDurationMs={actualDurationMs}
          speed={speed}
        />

        {/* Duration Controls */}
        <DurationControls
          speed={speed}
          durationEnabled={durationEnabled}
          durationValue={durationValue}
          durationUnit={durationUnit}
          actualDurationMs={actualDurationMs}
          onSpeedChange={handleSpeedChange}
          onDurationEnabledChange={handleDurationEnabledChange}
          onDurationValueChange={handleDurationValueChange}
          onDurationUnitChange={handleDurationUnitChange}
        />

        {/* Timeseries Chart */}
        <div className="bg-[#252525] rounded-lg border border-gray-700 p-2 mb-2">
          <h2 className="text-xs font-semibold mb-0.5 text-white">Expected RPS</h2>
          {timeseries.rpsValues.length > 0 ? (
            <div className="h-24" style={{ marginBottom: "50px" }}>
              <TimeseriesChart
                timestamps={timeseries.timestamps}
                rpsValues={timeseries.rpsValues}
              />
            </div>
          ) : (
            <div className="h-24 flex items-center justify-center text-gray-500 text-[10px]">
              No data loaded
            </div>
          )}
        </div>

        {/* Filters */}
        <Filters
          baseUrl={filt.baseUrl}
          filterPatterns={filt.filterPatterns}
          onBaseUrlChange={filt.setBaseUrl}
          onFilterPatternsChange={filt.setFilterPatterns}
        />

        {/* Column Mapping */}
        <ColumnMapping
          rawParsed={csv.rawParsed}
          columnMapping={csv.columnMapping}
          onUrlChange={(val) => csv.setColumnMapping({ ...csv.columnMapping, url: val })}
          onDatetimeChange={(val) =>
            csv.setColumnMapping({ ...csv.columnMapping, datetime: val })
          }
          hasParsedData={!!csv.parsedData}
        />

        {/* Logs Panel */}
        <LogsPanel
          visible={logs.visible}
          entries={logs.entries}
          logCount={logs.entries.length}
          onToggle={logs.toggleVisible}
          onClear={logs.handleClearLogs}
        />
      </div>
    </div>
  );
}

// --- Shared helpers ---

function recalcTimeseries(
  parsedData: { data: Array<{ url: string; datetime: Date }> },
  state: {
    speed: number;
    durationEnabled: boolean;
    durationValue: number;
    durationUnit: "seconds" | "minutes" | "hours";
  },
): { timeseries: { timestamps: number[]; rpsValues: number[] }; totalRequests: number } {
  const csvDuration = calculateActualDuration(parsedData.data);
  const overrideMs = getEffectiveDurationMs(
    state.durationEnabled, state.durationValue, state.durationUnit,
  );
  const effectiveDuration = overrideMs > 0 ? overrideMs : csvDuration;
  const ts = calculateExpectedTimeseries(
    parsedData.data, effectiveDuration, state.speed,
  );

  let previewTotalRequests = parsedData.data.length;
  if (effectiveDuration > 0 && csvDuration > 0) {
    const repeatCount = Math.ceil(effectiveDuration / csvDuration);
    previewTotalRequests = parsedData.data.length * repeatCount;

    if (repeatCount > 1) {
      const maxTime = new Date(
        parsedData.data[parsedData.data.length - 1].datetime,
      ).getTime() - new Date(parsedData.data[0].datetime).getTime();
      if (maxTime > 0) {
        let trimmed = 0;
        let elapsed = 0;
        for (let r = 0; r < repeatCount; r++) {
          for (const row of parsedData.data) {
            const t = new Date(row.datetime).getTime() -
                      new Date(parsedData.data[0].datetime).getTime();
            if (elapsed + maxTime > effectiveDuration && trimmed > 0) {
              break;
            }
            trimmed++;
            elapsed = t;
          }
        }
        previewTotalRequests = trimmed;
      }
    }
  }

  return { timeseries: ts, totalRequests: previewTotalRequests };
}

export default App;
