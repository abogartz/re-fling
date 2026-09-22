import React, { useEffect, useCallback } from "react";
import { useAppStore } from "../store/useAppStore";
import { getEffectiveDurationMs, calculateActualDuration } from "../utils/duration";
import { recalcPreviewStats } from "../utils/timeseries";
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
import replayIcon from "../ui/replay.svg?raw";

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
  const setActualDurationMs = useAppStore((s) => s.setActualDurationMs);
  const setDurationValue = useAppStore((s) => s.setDurationValue);
  const setDurationUnit = useAppStore((s) => s.setDurationUnit);

  // Recalculate timeseries when parsed data changes
  useEffect(() => {
    if (!csv.parsedData) {
      return;
    }

    const csvDur = calculateActualDuration(csv.parsedData.data);
    if (csv.parsedData.data.length > 0) {
      setActualDurationMs(csvDur);
      // Override duration defaults to the length of the loaded CSV.
      setDurationValue(Math.max(1, Math.ceil(csvDur / 1000)));
      setDurationUnit("seconds");
    }

    const state = useAppStore.getState();
    const result = recalcPreviewStats(csv.parsedData.data, state);
    setPreviewStats(result.timeseries, result.totalRequests);

    if (csv.parsedData.data.length > 0) {
      const effectiveDuration = getEffectiveDurationMs(
        state.durationEnabled,
        state.durationValue,
        state.durationUnit,
      );
      addLog(formatRequestsForLog(csv.parsedData.data, state.speed, effectiveDuration));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [csv.parsedData]);

  const updateTimeseriesAndLog = useCallback(
    (newSpeed?: number) => {
      if (!csv.parsedData || csv.parsedData.data.length === 0) {
        return;
      }
      const state = useAppStore.getState();
      const speedVal = newSpeed ?? state.speed;
      const effectiveDuration =
        getEffectiveDurationMs(
          state.durationEnabled,
          state.durationValue,
          state.durationUnit,
        );

      if (state.durationEnabled) {
        addLog(formatRequestsForLog(csv.parsedData.data, speedVal, effectiveDuration));
      }

      const result = recalcPreviewStats(csv.parsedData.data, {
        speed: speedVal,
        durationEnabled: state.durationEnabled,
        durationValue: state.durationValue,
        durationUnit: state.durationUnit,
      });
      setPreviewStats(result.timeseries, result.totalRequests);
    },
    [csv.parsedData, setPreviewStats],
  );

  const handleSpeedChange = (newSpeed: number) => {
    useAppStore.getState().setSpeed(newSpeed);
    updateTimeseriesAndLog(newSpeed);
  };

  const handleDurationValueChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = parseInt(e.target.value, 10);
    if (!isNaN(val) && val >= 0) {
      useAppStore.getState().setDurationValue(val);
    }
    updateTimeseriesAndLog();
  };

  const handleDurationUnitChange = (
    e: React.ChangeEvent<HTMLSelectElement>,
  ) => {
    useAppStore.getState().setDurationUnit(
      e.target.value as "seconds" | "minutes" | "hours",
    );
    updateTimeseriesAndLog();
  };

  const handleDurationEnabledChange = (checked: boolean) => {
    useAppStore.getState().setDurationEnabled(checked);
    if (csv.parsedData) {
      const state = useAppStore.getState();
      const result = recalcPreviewStats(csv.parsedData.data, state);
      setPreviewStats(result.timeseries, result.totalRequests);
    }
  };

  const handleStart = () => {
    if (!csv.parsedData) {
      return;
    }
    const effectiveDurationMs = getEffectiveDurationMs(
      durationEnabled,
      durationValue,
      durationUnit,
    );
    const config = {
      speed,
      duration:
        effectiveDurationMs > 0 ? effectiveDurationMs : 0,
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
  };

  return (
    <div className="min-h-screen bg-[#1a1a1a] p-2">
      {/* Header */}
      <div className="flex items-center justify-between mb-2">
        <div>
          <h1 className="text-lg font-bold text-white flex items-center gap-1.5">
            <span
              className="inline-flex w-5 h-5 text-gray-400"
              data-testid="app-icon"
              dangerouslySetInnerHTML={{ __html: replayIcon }}
            />
            ReFling
          </h1>
          <p className="text-gray-400 text-xs">
            Replay historical traffic patterns exactly as they occurred.
          </p>
        </div>
      </div>

      <div className="max-w-4xl mx-auto">
        {/* CSV Loader */}
        <CsvLoader
          fileInputRef={csv.fileInputRef}
          onFileLoad={csv.handleFileLoad}
          onStart={handleStart}
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

export default App;
