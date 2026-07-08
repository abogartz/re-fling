import { useState, useRef, useCallback, useEffect } from "react";
import { parseCSV, ParsedCSV, CSVRow, ColumnMapping } from "../csv/parser";
import {
  ReplayEngine,
  ReplayConfig,
  ReplayState,
} from "../replay/engine";
import { TimeseriesChart } from "./TimeseriesChart";

function calculateActualDuration(data: CSVRow[]): number {
  if (data.length < 2) {return 0;}
  const firstTime = new Date(data[0].datetime).getTime();
  const lastTime = new Date(data[data.length - 1].datetime).getTime();
  return Math.max(0, lastTime - firstTime);
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

function calculateExpectedTimeseries(
  data: CSVRow[],
  durationMs: number,
  speed: number,
): { timestamps: number[]; rpsValues: number[] } {
  if (data.length === 0 || durationMs === 0) {
    return { timestamps: [], rpsValues: [] };
  }

  // Calculate actual CSV duration
  const csvDuration = calculateActualDuration(data);
  
  // Calculate effective playback duration (accounts for speed)
  const effectiveDurationMs = durationMs / speed;
  
  // Use 1-second bins for accurate RPS calculation
  const binSizeMs = 1000; // 1 second
  const totalBins = Math.floor(effectiveDurationMs / binSizeMs) + 1;
  
  // Calculate RPS for each bin
  const rpsValues: number[] = [];
  const timestamps: number[] = [];
  
  const firstTime = new Date(data[0].datetime).getTime();
  
  for (let i = 0; i < totalBins; i++) {
    const binStart = i * binSizeMs;
    const binEnd = (i + 1) * binSizeMs;
    
    // Count requests that would fall in this time bin
    let countInBin = 0;
    for (const row of data) {
      const csvTime = new Date(row.datetime).getTime();
      // Map CSV time to playback time using effective duration
      const playbackTime = csvDuration > 0 ? (csvTime - firstTime) * effectiveDurationMs / csvDuration : 0;
      
      if (playbackTime >= binStart && playbackTime < binEnd) {
        countInBin++;
      }
    }
    
    // Calculate RPS: requests per second in this bin, scaled by speed
    const rps = Math.round(countInBin * speed);
    rpsValues.push(rps);
    timestamps.push(binStart);
  }
  
  return { timestamps, rpsValues };
}

function App() {
  const [rawText, setRawText] = useState<string | null>(null);
  const [rawParsed, setRawParsed] = useState<ParsedCSV | null>(null);
  const [parsedData, setParsedData] = useState<ParsedCSV | null>(null);
  const [columnMapping, setColumnMapping] = useState<{
    url?: string;
    datetime?: string;
  }>({});
  const [speed, setSpeed] = useState(1.0);
  const [durationEnabled, setDurationEnabled] = useState(false);
  const [durationValue, setDurationValue] = useState(100);
  const [durationUnit, setDurationUnit] = useState<"seconds" | "minutes" | "hours">("seconds");
  
  // Refs for current duration values (avoids stale closure in handlers)
  const durationValueRef = useRef(durationValue);
  const durationUnitRef = useRef(durationUnit);
  const durationEnabledRef = useRef(durationEnabled);
  durationValueRef.current = durationValue;
  durationUnitRef.current = durationUnit;
  durationEnabledRef.current = durationEnabled;
  const [baseUrl, setBaseUrl] = useState("");
  const [filterPatterns, setFilterPatterns] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [replayState, setReplayState] = useState<ReplayState>({
    status: "idle",
    progress: 0,
    totalRequests: 0,
    completedRequests: 0,
    errors: 0,
    elapsed: 0,
    config: {
      speed: 1.0,
      duration: 0,
      baseUrl: "",
      filterPatterns: [],
    },
    timings: [],
    filteredData: [],
    timeseries: { timestamps: [], rpsValues: [] },
    actualDurationMs: 0,
  });
  const engineRef = useRef<ReplayEngine | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileLoad = useCallback(async () => {
    const file = fileInputRef.current?.files?.[0];
    if (!file) {return;}
    setError(null);
    try {
      const text = await file.text();
      setRawText(text);

      // Parse without mapping to get column list
      const rawResult = parseCSV(text);
      setRawParsed(rawResult);

      // Auto-select columns if names match expected fields
      const urlCol = rawResult.columns.find((c) => c.toLowerCase() === "url");
      const dtCol = rawResult.columns.find(
        (c) => c.toLowerCase() === "datetime",
      );
      const mapping: { url?: string; datetime?: string } = {};
      if (urlCol) {
        mapping.url = urlCol;
      }
      if (dtCol) {
        mapping.datetime = dtCol;
      }
      setColumnMapping(mapping);

      // If both auto-selected, parse with mapping immediately
      if (mapping.url && mapping.datetime) {
        const mappedResult = parseCSV(text, {
          url: mapping.url,
          datetime: mapping.datetime,
        });
        if (mappedResult.errors.length > 0) {
          setError(
            `CSV parse errors: ${mappedResult.errors
              .map((e) => e.message)
              .join(", ")}`,
          );
        }
        setParsedData(mappedResult);

        // Set up replay state with mapped data
        const csvDuration = calculateActualDuration(mappedResult.data);
        setReplayState((prev) => ({
          ...prev,
          status: "idle",
          filteredData: mappedResult.data.map((d) => ({
            datetime: d.datetime,
            url: d.url,
          })),
          totalRequests: mappedResult.data.length,
          actualDurationMs: csvDuration,
          timeseries: calculateExpectedTimeseries(mappedResult.data, csvDuration, 1),
        }));
        setDurationValue(Math.max(1, Math.ceil(csvDuration / 1000)));
      } else {
        setParsedData(null);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    }
  }, []);

  const startReplay = useCallback(() => {
    if (!parsedData) {
      return;
    }
    const engine = new ReplayEngine();
    engineRef.current = engine;
    // Expose engine for E2E testing
    (window as unknown as Record<string, unknown>).__engineRef = engine;

    const effectiveDurationMs = getEffectiveDurationMs();
    const config: ReplayConfig = {
      speed,
      duration: effectiveDurationMs > 0 ? effectiveDurationMs : calculateActualDuration(parsedData.data),
      baseUrl,
      filterPatterns: filterPatterns
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean),
    };

    // Set progress callback BEFORE setData so initial state (with histogram) is captured
    engine.setProgressCallback((state) => {
      setReplayState(state);
    });

    engine.setData(
      parsedData.data.map((d) => ({
        datetime: d.datetime,
        url: d.url,
      })),
      config,
    );

    engine.start();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [parsedData, speed, baseUrl, filterPatterns, durationEnabled, durationValue, durationUnit]);

  // Re-parse with column mapping when mapping changes
  useEffect(() => {
    if (!rawText || !columnMapping.url || !columnMapping.datetime) {
      setParsedData(null);
      return;
    }
    const map: ColumnMapping = {
      url: columnMapping.url,
      datetime: columnMapping.datetime,
    };
    try {
      const result = parseCSV(rawText, map);
      if (result.errors.length > 0) {
        setError(
          `CSV parse errors: ${result.errors
            .map((e) => e.message)
            .join(", ")}`,
        );
      }
      setParsedData(result);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    }
  }, [rawText, columnMapping]);

  // Recalculate timeseries when mapped data changes (e.g. mapping update)
  useEffect(() => {
    recalcTimeseries();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [parsedData]);

  // Effective duration in ms from UI controls
  const getEffectiveDurationMs = useCallback((): number => {
    if (!durationEnabledRef.current || durationValueRef.current <= 0) { return 0; }
    const multipliers: Record<string, number> = { seconds: 1000, minutes: 60_000, hours: 3_600_000 };
    return durationValueRef.current * (multipliers[durationUnitRef.current] ?? 1000);
  }, []);

  // Recalculate timeseries when controls change
  const recalcTimeseries = useCallback(() => {
    if (!parsedData) { return; }
    const csvDuration = calculateActualDuration(parsedData.data);
    const overrideMs = getEffectiveDurationMs();
    const effectiveDuration = overrideMs > 0 ? overrideMs : csvDuration;
    const ts = calculateExpectedTimeseries(parsedData.data, effectiveDuration, speedRef.current);
    
    // Calculate how many rows would be in the active set (for preview)
    let previewTotalRequests = parsedData.data.length;
    if (effectiveDuration > 0 && csvDuration > 0) {
      const repeatCount = Math.ceil(effectiveDuration / csvDuration);
      previewTotalRequests = parsedData.data.length * repeatCount;
      
      // Trim overflow from last cycle
      if (repeatCount > 1) {
        const maxTime = new Date(parsedData.data[parsedData.data.length - 1].datetime).getTime() -
                        new Date(parsedData.data[0].datetime).getTime();
        if (maxTime > 0) {
          let trimmed = 0;
          let elapsed = 0;
          for (let r = 0; r < repeatCount; r++) {
            for (const row of parsedData.data) {
              const t = new Date(row.datetime).getTime() - new Date(parsedData.data[0].datetime).getTime();
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
    
    setReplayState(prev => ({
      ...prev,
      timeseries: ts,
      totalRequests: previewTotalRequests,
    }));
  }, [parsedData, getEffectiveDurationMs]);

  const speedRef = useRef(speed);
  speedRef.current = speed;

  const handleSpeedChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newSpeed = parseFloat(e.target.value) || 1;
    setSpeed(newSpeed);
    recalcTimeseries();
  };

  const handleDurationValueChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = parseInt(e.target.value, 10);
    if (isNaN(val) || val < 0) { return; }
    durationValueRef.current = val; // Update ref immediately (before state update)
    setDurationValue(val);
    recalcTimeseries();
  };

  const handleDurationUnitChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    durationUnitRef.current = e.target.value as "seconds" | "minutes" | "hours";
    setDurationUnit(e.target.value as "seconds" | "minutes" | "hours");
    recalcTimeseries();
  };

  const stopReplay = useCallback(() => {
    engineRef.current?.cancel();
  }, []);

  const statusColor: Record<string, string> = {
    idle: "text-gray-500",
    running: "text-blue-600",
    paused: "text-yellow-600",
    completed: "text-green-600",
    cancelled: "text-red-600",
    error: "text-red-600",
  };

  const openLogs = useCallback(() => {
    (window as unknown as { __electrobunBunBridge?: { postMessage: (msg: string) => void } }).__electrobunBunBridge?.postMessage(
      JSON.stringify({ type: "open-logs" }),
    );
  }, []);

  return (
    <div className="min-h-screen bg-[#1a1a1a] p-2">
      {/* Logs button - upper right */}
      <button
        onClick={openLogs}
        title="View logs"
        className="fixed top-3 right-3 z-50 bg-[#252525] border border-gray-700 rounded-lg p-1.5 hover:bg-[#333] transition-colors"
      >
        <svg
          xmlns="http://www.w3.org/2000/svg"
          width="16"
          height="16"
          viewBox="0 0 24 24"
          fill="none"
          stroke="#d4d4d4"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
          <polyline points="14 2 14 8 20 8" />
          <line x1="16" y1="13" x2="8" y2="13" />
          <line x1="16" y1="17" x2="8" y2="17" />
          <polyline points="10 9 9 9 8 9" />
        </svg>
      </button>

      <div className="max-w-4xl mx-auto">
        <h1 className="text-lg font-bold text-white mb-0.5">ReFling</h1>
        <p className="text-gray-400 text-xs mb-2">
          Replay historical traffic patterns exactly as they occurred.
        </p>

        {/* File loading + Start/Stop buttons */}
        <div className="bg-[#252525] rounded-lg border border-gray-700 p-3 mb-2">
          <h2 className="text-sm font-semibold mb-1.5 text-white">Load CSV Data</h2>
          <div className="flex gap-2 items-center">
            <input
              ref={fileInputRef}
              type="file"
              accept=".csv"
              onChange={handleFileLoad}
              className="block flex-1 text-xs text-gray-400 file:mr-2 file:py-1 file:px-2 file:rounded file:border-0 file:text-xs file:font-semibold file:bg-blue-600 file:text-white hover:file:bg-blue-700"
            />
            <button
              onClick={startReplay}
              disabled={
                replayState.status === "running" ||
                !parsedData ||
                !columnMapping.url ||
                !columnMapping.datetime
              }
              className="bg-blue-600 text-white px-2 py-1 rounded text-xs hover:bg-blue-700 disabled:bg-gray-400 disabled:text-gray-200 disabled:cursor-not-allowed disabled:hover:bg-gray-400 whitespace-nowrap"
            >
              Start
            </button>
            <button
              onClick={stopReplay}
              disabled={replayState.status === "idle" || replayState.status === "completed" || replayState.status === "cancelled"}
              className="bg-red-600 text-white px-2 py-1 rounded text-xs hover:bg-red-700 disabled:bg-gray-400 disabled:text-gray-200 disabled:cursor-not-allowed disabled:hover:bg-gray-400 whitespace-nowrap"
            >
              Stop
            </button>
          </div>
          {error && (
            <p className="mt-1 text-red-400 text-xs">{error}</p>
          )}
          {parsedData && (
            <p className="mt-1 text-green-400 text-xs">
              Loaded {parsedData.data.length} rows, {parsedData.columns.length} columns
            </p>
          )}
          {/* Preview total requests when duration is overridden */}
          {durationEnabledRef.current && replayState.totalRequests > 0 && (
            <p className="mt-1 text-blue-400 text-xs">
              Expected: {replayState.totalRequests} requests
            </p>
          )}
          {/* Progress - inline with controls */}
          {(replayState.status !== "idle" || replayState.completedRequests > 0) && (
            <div className="flex items-center gap-1.5 mt-1.5">
              <div className="text-[10px] font-medium text-white" data-testid="replay-status">Status:</div>
              <p className={`text-[10px] font-medium flex-1 ${statusColor[replayState.status]}`}>
                {replayState.status}
              </p>
              <div className="w-24 bg-gray-700 rounded-full h-1.5">
                <div
                  className="bg-blue-600 h-1.5 rounded-full transition-all"
                  style={{ width: `${replayState.progress * 100}%` }}
                />
              </div>
              <p className="text-[10px] text-gray-400">
                {replayState.completedRequests}/{replayState.totalRequests}
              </p>
            </div>
          )}
        </div>

        {/* Replay controls - compact inline */}
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
                  onChange={handleSpeedChange}
                  className="w-full h-3"
                />
              </div>
              <div className="flex-1">
                <label className="flex items-center gap-1 text-[10px] font-medium text-gray-300 mb-0.5">
                  <input
                    type="checkbox"
                    checked={durationEnabled}
                    onChange={(e) => {
                      durationEnabledRef.current = e.target.checked;
                      setDurationEnabled(e.target.checked);
                      recalcTimeseries();
                    }}
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
                    onChange={handleDurationValueChange}
                    className="w-20 border border-gray-600 bg-[#1a1a1a] text-white rounded px-1.5 py-0.5 text-xs disabled:opacity-40 disabled:cursor-not-allowed"
                  />
                  <select
                    value={durationUnit}
                    onChange={handleDurationUnitChange}
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
            {replayState.actualDurationMs > 0 && (
              <p className="text-[10px] text-gray-400 mt-0.5">
                CSV span: {formatDuration(replayState.actualDurationMs)} | Speed: {speed.toFixed(1)}x
              </p>
            )}
          </div>

        {/* Timeseries Chart - shorter */}
        <div className="bg-[#252525] rounded-lg border border-gray-700 p-2 mb-2">
            <h2 className="text-xs font-semibold mb-0.5 text-white">Expected RPS</h2>
            {replayState.timeseries.rpsValues.length > 0 ? (
              <div className="h-24" style={{marginBottom: "50px"}}>
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

        {/* Filters - compact */}
        <div className="bg-[#252525] rounded-lg border border-gray-700 p-2">
            <h2 className="text-xs font-semibold mb-1 text-white">Filters</h2>
            <div className="flex gap-1.5">
              <input
                type="text"
                value={baseUrl}
                onChange={(e) => setBaseUrl(e.target.value)}
                placeholder="Base URL"
                className="flex-1 border border-gray-600 bg-[#1a1a1a] text-white rounded px-1.5 py-0.5 text-xs"
              />
              <input
                type="text"
                value={filterPatterns}
                onChange={(e) => setFilterPatterns(e.target.value)}
                placeholder="Filter patterns"
                className="flex-1 border border-gray-600 bg-[#1a1a1a] text-white rounded px-1.5 py-0.5 text-xs"
              />
            </div>
          </div>

        {/* Column Mapping - shown after file load */}
        {rawParsed && (
          <div className="bg-[#252525] rounded-lg border border-gray-700 p-2 mt-2" data-testid="column-mapping">
            <h2 className="text-xs font-semibold mb-1 text-white">Column Mapping</h2>
            <div className="flex flex-col gap-1">
              <div className="flex items-center gap-2">
                <label className="text-[10px] font-medium text-gray-300 w-16">url</label>
                <select
                  value={columnMapping.url || ""}
                  onChange={(e) =>
                    setColumnMapping((prev) => ({ ...prev, url: e.target.value }))
                  }
                  className="flex-1 border border-gray-600 bg-[#1a1a1a] text-white rounded px-1 py-0.5 text-xs"
                >
                  <option value="">-- select column --</option>
                  {rawParsed.columns.map((col) => (
                    <option key={col} value={col}>
                      {col}
                    </option>
                  ))}
                </select>
              </div>
              <div className="flex items-center gap-2">
                <label className="text-[10px] font-medium text-gray-300 w-16">datetime</label>
                <select
                  value={columnMapping.datetime || ""}
                  onChange={(e) =>
                    setColumnMapping((prev) => ({
                      ...prev,
                      datetime: e.target.value,
                    }))
                  }
                  className="flex-1 border border-gray-600 bg-[#1a1a1a] text-white rounded px-1 py-0.5 text-xs"
                >
                  <option value="">-- select column --</option>
                  {rawParsed.columns.map((col) => (
                    <option key={col} value={col}>
                      {col}
                    </option>
                  ))}
                </select>
              </div>
            </div>
            {!parsedData && (
              <p className="mt-1 text-yellow-400 text-[10px]">
                Select both columns above to enable Start.
              </p>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

export default App;
