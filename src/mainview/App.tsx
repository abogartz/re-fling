import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  ReplayEngine,
  type ReplayConfig,
  type ReplayState,
} from "../replay/engine";
import { useCsvLoad } from "../features/csv/useCsvLoad";
import { CsvLoader } from "../features/csv/CsvLoader";
import { DurationControls } from "../features/duration/DurationControls";
import {
  useDuration,
  type UseDurationReturn,
} from "../features/duration/useDuration";
import { Filters } from "../features/filters/Filters";
import { useFilters } from "../features/filters/useFilters";
import { ColumnMapping } from "../features/columns/ColumnMapping";
import { LogsPanel } from "../features/logs/LogsPanel";
import { useLogs } from "../features/logs/useLogs";
import { TimeseriesChart } from "./TimeseriesChart";
import { calculateExpectedTimeseries, TimeseriesResult } from "../utils/timeseries";
import { calculateActualDuration, getEffectiveDurationMs } from "../utils/duration";
import { addLog } from "../bun/logs";

function formatRequestsForLog(
  data: Array<{ url: string; datetime: Date }>,
  _speed: number,
  durationMs: number,
): string {
  if (data.length === 0) { return 'requests: []'; }

  const csvDuration = calculateActualDuration(data);
  const effectiveDuration = durationMs > 0 ? durationMs : csvDuration;
  const repeatCount = csvDuration > 0 ? Math.ceil(effectiveDuration / csvDuration) : 1;

  const requests: Array<{ url: string; timing: string }> = [];
  const firstTime = new Date(data[0].datetime).getTime();

  for (let cycle = 0; cycle < repeatCount; cycle++) {
    for (const row of data) {
      const csvTime = new Date(row.datetime).getTime();
      const relativeTime = csvTime - firstTime;
      const playbackTime = csvDuration > 0
        ? (relativeTime * effectiveDuration) / csvDuration
        : 0;
      const absoluteTime = playbackTime + cycle * csvDuration;

      requests.push({
        url: row.url,
        timing: `${(absoluteTime / 1000).toFixed(2)}s`,
      });
    }
  }

  return `requests: ${JSON.stringify(requests)}`;
}

function App() {
  const csv = useCsvLoad();
  const dur = useDuration();
  const filt = useFilters();
  const logs = useLogs();

  const engineRef = useRef<ReplayEngine | null>(null);
  const [replayState, setReplayState] = useState<ReplayState>({
    status: "idle",
    progress: 0,
    totalRequests: 0,
    completedRequests: 0,
    errors: 0,
    elapsed: 0,
    config: { speed: 1.0, duration: 0, baseUrl: "", filterPatterns: [] },
    activeRows: [],
    delayMs: 0,
    filteredData: [],
    timeseries: { timestamps: [], rpsValues: [] },
    actualDurationMs: 0,
  });

  const startReplay = useCallback(() => {
    if (!csv.parsedData) { return; }
    const engine = new ReplayEngine();
    engineRef.current = engine;
    (window as unknown as Record<string, unknown>).__engineRef = engine;

    const effectiveDurationMs = getEffectiveDurationMs(
      dur.durationEnabled, dur.durationValue, dur.durationUnit,
    );
    const config: ReplayConfig = {
      speed: dur.speed,
      duration: effectiveDurationMs > 0
        ? effectiveDurationMs
        : calculateActualDuration(csv.parsedData.data),
      baseUrl: filt.baseUrl,
      filterPatterns: filt.filterPatterns
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean),
    };

    engine.setProgressCallback((state) => {
      setReplayState(state);
    });

    engine.setData(
      csv.parsedData.data.map((d) => ({ datetime: d.datetime, url: d.url })),
      config,
    );

    engine.start();
  }, [csv.parsedData, dur.speed, filt.baseUrl, filt.filterPatterns,
    dur.durationEnabled, dur.durationValue, dur.durationUnit]);

  const stopReplay = useCallback(() => {
    engineRef.current?.cancel();
  }, []);

  // Recalculate timeseries when parsed data changes (column mapping update)
  useEffect(() => {
    if (!csv.parsedData) { return; }
    const result = recalcTimeseries(csv.parsedData, dur);
    setReplayState((prev) => ({ ...prev, ...result }));

    if (csv.parsedData.data.length > 0) {
      const effectiveDuration = getEffectiveDurationMs(
        dur.durationEnabledRef.current, dur.durationValueRef.current, dur.durationUnitRef.current,
      ) || calculateActualDuration(csv.parsedData.data);
      addLog(formatRequestsForLog(csv.parsedData.data, dur.speedRef.current, effectiveDuration));
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [csv.parsedData]);

  const handleSpeedChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    dur.handleSpeedChange(e);

    if (csv.parsedData && csv.parsedData.data.length > 0) {
      const newSpeed = parseFloat(e.target.value) || 1;
      const effectiveDuration = getEffectiveDurationMs(
        dur.durationEnabledRef.current, dur.durationValueRef.current, dur.durationUnitRef.current,
      ) || calculateActualDuration(csv.parsedData.data);
      addLog(formatRequestsForLog(csv.parsedData.data, newSpeed, effectiveDuration));
    }

    if (csv.parsedData) {
      const result = recalcTimeseries(csv.parsedData, dur);
      setReplayState((prev) => ({ ...prev, ...result }));
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [csv.parsedData]);

  const handleDurationValueChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    dur.handleDurationValueChange(e);

    if (csv.parsedData && csv.parsedData.data.length > 0 && dur.durationEnabledRef.current) {
      const effectiveDuration = getEffectiveDurationMs(
        dur.durationEnabledRef.current, dur.durationValueRef.current, dur.durationUnitRef.current,
      );
      addLog(formatRequestsForLog(csv.parsedData.data, dur.speedRef.current, effectiveDuration));
    }

    if (csv.parsedData) {
      const result = recalcTimeseries(csv.parsedData, dur);
      setReplayState((prev) => ({ ...prev, ...result }));
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [csv.parsedData]);

  const handleDurationUnitChange = useCallback((e: React.ChangeEvent<HTMLSelectElement>) => {
    dur.handleDurationUnitChange(e);

    if (csv.parsedData && csv.parsedData.data.length > 0 && dur.durationEnabledRef.current) {
      const effectiveDuration = getEffectiveDurationMs(
        dur.durationEnabledRef.current, dur.durationValueRef.current, dur.durationUnitRef.current,
      );
      addLog(formatRequestsForLog(csv.parsedData.data, dur.speedRef.current, effectiveDuration));
    }

    if (csv.parsedData) {
      const result = recalcTimeseries(csv.parsedData, dur);
      setReplayState((prev) => ({ ...prev, ...result }));
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [csv.parsedData]);

  const handleDurationEnabledChange = useCallback((checked: boolean) => {
    dur.durationEnabledRef.current = checked;
    dur.setDurationEnabled(checked);
    if (csv.parsedData) {
      const result = recalcTimeseries(csv.parsedData, dur);
      setReplayState((prev) => ({ ...prev, ...result }));
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [csv.parsedData]);

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
        <LogsPanel
          visible={logs.logsVisible}
          logs={logs.logs}
          logCount={logs.logs.length}
          onToggle={logs.toggleLogs}
          onClear={logs.handleClearLogs}
        />
      </div>

      <div className="max-w-4xl mx-auto">
        {/* CSV Loader */}
        <CsvLoader
          fileInputRef={csv.fileInputRef}
          onFileLoad={csv.handleFileLoad}
          onStart={startReplay}
          onStop={stopReplay}
          isRunning={replayState.status === "running"}
          hasParsedData={!!csv.parsedData}
          columnMapping={csv.columnMapping}
          error={csv.error}
          dataCount={csv.parsedData?.data.length ?? 0}
          totalRequests={replayState.totalRequests}
          durationEnabled={dur.durationEnabled}
          replayStatus={replayState.status}
          progress={replayState.progress}
          completedRequests={replayState.completedRequests}
          actualDurationMs={replayState.actualDurationMs}
          speed={dur.speed}
        />

        {/* Duration Controls */}
        <DurationControls
          speed={dur.speed}
          durationEnabled={dur.durationEnabled}
          durationValue={dur.durationValue}
          durationUnit={dur.durationUnit}
          actualDurationMs={replayState.actualDurationMs}
          onSpeedChange={handleSpeedChange}
          onDurationEnabledChange={handleDurationEnabledChange}
          onDurationValueChange={handleDurationValueChange}
          onDurationUnitChange={handleDurationUnitChange}
        />

        {/* Timeseries Chart */}
        <div className="bg-[#252525] rounded-lg border border-gray-700 p-2 mb-2">
          <h2 className="text-xs font-semibold mb-0.5 text-white">Expected RPS</h2>
          {replayState.timeseries.rpsValues.length > 0 ? (
            <div className="h-24" style={{ marginBottom: "50px" }}>
              <TimeseriesChart
                timestamps={replayState.timeseries.timestamps}
                rpsValues={replayState.timeseries.rpsValues}
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
          onUrlChange={(val) => csv.setColumnMapping((prev) => ({ ...prev, url: val }))}
          onDatetimeChange={(val) =>
            csv.setColumnMapping((prev) => ({ ...prev, datetime: val }))
          }
          hasParsedData={!!csv.parsedData}
        />
      </div>
    </div>
  );
}

// --- Shared helpers ---

function recalcTimeseries(
  parsedData: { data: Array<{ url: string; datetime: Date }> },
  dur: UseDurationReturn,
): Partial<ReplayState> {
  const csvDuration = calculateActualDuration(parsedData.data);
  const overrideMs = getEffectiveDurationMs(
    dur.durationEnabledRef.current, dur.durationValueRef.current, dur.durationUnitRef.current,
  );
  const effectiveDuration = overrideMs > 0 ? overrideMs : csvDuration;
  const ts: TimeseriesResult = calculateExpectedTimeseries(
    parsedData.data, effectiveDuration, dur.speedRef.current,
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
            if (elapsed + maxTime > effectiveDuration && trimmed > 0) { break; }
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
