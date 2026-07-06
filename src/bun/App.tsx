import { useState, useRef, useCallback } from "react";
import { parseCSV, ParsedCSV } from "../csv/parser";
import {
  ReplayEngine,
  ReplayConfig,
  ReplayState,
} from "../replay/engine";
import { Line } from "react-chartjs-2";
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
  ChartOptions,
} from "chart.js";

// Register Chart.js components
ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend
);

type AppView = "upload" | "replay" | "settings";

export default function App() {
  const [view, setView] = useState<AppView>("upload");
  const [parsedCSV, setParsedCSV] = useState<ParsedCSV | null>(null);
  const [replayState, setReplayState] = useState<ReplayState>({
    status: "idle",
    progress: 0,
    totalRequests: 0,
    completedRequests: 0,
    errors: 0,
    config: { speed: 1, iterations: 1, duration: 100, baseUrl: "", filterPatterns: [] },
    timings: [],
    filteredData: [],
    histogram: { labels: [], data: [] },
  });
  const [speed, setSpeed] = useState(1);
  const [duration, setDuration] = useState(100);
  const [iterations, setIterations] = useState(1);
  const [errors, setErrors] = useState<string[]>([]);
  const [filterPatterns, setFilterPatterns] = useState<string[]>([]);
  const engineRef = useRef<ReplayEngine | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileUpload = useCallback(
    (event: React.ChangeEvent<HTMLInputElement>) => {
      const file = event.target.files?.[0];
      if (!file) return;

      const reader = new FileReader();
      reader.onload = (e) => {
        const content = e.target?.result as string;
        const result = parseCSV(content);

        if (result.errors.length > 0) {
          setErrors(result.errors.map((err) => err.message));
        }

        if (result.data.length > 0) {
          setParsedCSV(result);
          setErrors([]);
          setView("replay");

          const config: ReplayConfig = {
            speed,
            iterations,
            duration,
            filterPatterns,
            baseUrl: "",
          };

          const engine = new ReplayEngine();
          engine.setData(result.data, config);
          engine.setProgressCallback((state: ReplayState) => {
            setReplayState(state);
          });
          engineRef.current = engine;
        }
      };
      reader.readAsText(file);
    },
    [speed, duration, iterations, filterPatterns]
  );

  const handleBrowse = () => {
    fileInputRef.current?.click();
  };

  const handleStartReplay = () => {
    if (!engineRef.current) return;
    engineRef.current.start();
  };

  const handlePause = () => {
    if (engineRef.current) {
      engineRef.current.pause();
    }
  };

  const handleResume = () => {
    if (engineRef.current) {
      engineRef.current.resume();
    }
  };

  const handleStop = () => {
    if (engineRef.current) {
      engineRef.current.cancel();
    }
  };

  const handleSpeedChange = (newSpeed: number) => {
    setSpeed(newSpeed);
    if (engineRef.current && parsedCSV) {
      const config: ReplayConfig = {
        speed: newSpeed,
        iterations,
        duration,
        filterPatterns,
        baseUrl: "",
      };
      engineRef.current.setData(parsedCSV.data, config);
    }
  };

  const handleDurationChange = (newDuration: number) => {
    setDuration(newDuration);
    if (engineRef.current && parsedCSV) {
      const config: ReplayConfig = {
        speed,
        iterations,
        duration: newDuration,
        filterPatterns,
        baseUrl: "",
      };
      engineRef.current.setData(parsedCSV.data, config);
    }
  };

  const handleIterationsChange = (newIterations: number) => {
    setIterations(newIterations);
    if (engineRef.current && parsedCSV) {
      const config: ReplayConfig = {
        speed,
        iterations: newIterations,
        duration,
        filterPatterns,
        baseUrl: "",
      };
      engineRef.current.setData(parsedCSV.data, config);
    }
  };

  const handleBaseURLChange = (newBaseUrl: string) => {
    if (engineRef.current && parsedCSV) {
      const config: ReplayConfig = {
        speed,
        iterations,
        duration,
        filterPatterns,
        baseUrl: newBaseUrl,
      };
      engineRef.current.setData(parsedCSV.data, config);
    }
  };

  const handleFilterChange = (newFilter: string) => {
    setFilterPatterns(newFilter ? newFilter.split(",").map((s) => s.trim()) : []);
    if (engineRef.current && parsedCSV) {
      const config: ReplayConfig = {
        speed,
        iterations: 1,
        filterPatterns: newFilter ? newFilter.split(",").map((s) => s.trim()) : [],
        baseUrl: "",
      };
      engineRef.current.setData(parsedCSV.data, config);
    }
  };

  // Generate histogram data from parsed CSV
  const getHistogramData = () => {
    if (!parsedCSV?.data) return null;

    // Sample data for performance (max 1000 points)
    const sampledData =
      parsedCSV.data.length > 1000
        ? parsedCSV.data.filter(
            (_, i) => i % Math.ceil(parsedCSV.data.length / 1000) === 0
          )
        : parsedCSV.data;

    // Group by hour
    const hourMap = new Map<string, number>();
    for (const row of sampledData) {
      const date = row.datetime;
      const hour = date.getHours();
      const key = `${String(hour).padStart(2, "0")}:00`;
      hourMap.set(key, (hourMap.get(key) || 0) + 1);
    }

    const labels = Array.from(hourMap.keys()).sort();
    const data = labels.map((label) => hourMap.get(label) || 0);

    return {
      labels,
      datasets: [
        {
          label: "Requests per Hour",
          data,
          borderColor: "rgba(54, 162, 235, 1)",
          backgroundColor: "rgba(54, 162, 235, 0.1)",
          fill: true,
          tension: 0.3,
          pointRadius: 3,
          pointHoverRadius: 5,
        },
      ],
    };
  };

  const histogramData = getHistogramData();

  const chartOptions: ChartOptions<"line"> = {
    responsive: true,
    plugins: {
      legend: {
        position: "top" as const,
      },
      title: {
        display: true,
        text: "Traffic Distribution (Sampled)",
      },
    },
    scales: {
      y: {
        beginAtZero: true,
        title: {
          display: true,
          text: "Request Count",
        },
      },
      x: {
        title: {
          display: true,
          text: "Hour of Day",
        },
      },
    },
  };

  const isRunning = replayState.status === "running";
  const isPaused = replayState.status === "paused";
  const isCompleted = replayState.status === "completed";

  return (
    <div className="min-h-screen bg-gray-900 text-white">
      <header className="bg-gray-800 border-b border-gray-700">
        <div className="container mx-auto px-4 py-4">
          <h1 className="text-2xl font-bold">ReFling</h1>
          <p className="text-gray-400">
            Historical traffic replay for performance testing
          </p>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8">
        {view === "upload" ? (
          <div className="max-w-2xl mx-auto">
            <div className="bg-gray-800 rounded-lg p-8 border border-gray-700">
              <h2 className="text-xl font-semibold mb-4">
                Upload CSV File
              </h2>
              <p className="text-gray-400 mb-6">
                Select a CSV file to parse and replay. The file should contain
                at least a timestamp and URL column.
              </p>

              <input
                ref={fileInputRef}
                type="file"
                accept=".csv"
                onChange={handleFileUpload}
                className="hidden"
              />

              <button
                onClick={handleBrowse}
                className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-3 rounded-lg font-medium transition-colors"
              >
                Browse CSV File
              </button>

              {errors.length > 0 && (
                <div className="mt-6 bg-red-900/50 border border-red-700 rounded-lg p-4">
                  <h3 className="text-red-400 font-semibold mb-2">
                    Parsing Errors
                  </h3>
                  <ul className="text-red-300 text-sm space-y-1">
                    {errors.map((err, i) => (
                      <li key={i}>{err}</li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          </div>
        ) : (
          <div className="space-y-6">
            {/* Stats Dashboard */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div className="bg-gray-800 rounded-lg p-4 border border-gray-700">
                <div className="text-gray-400 text-sm">Total Requests</div>
                <div className="text-2xl font-bold">
                  {replayState.totalRequests}
                </div>
              </div>
              <div className="bg-gray-800 rounded-lg p-4 border border-gray-700">
                <div className="text-gray-400 text-sm">Completed</div>
                <div className="text-2xl font-bold">
                  {replayState.completedRequests}
                </div>
              </div>
              <div className="bg-gray-800 rounded-lg p-4 border border-gray-700">
                <div className="text-gray-400 text-sm">Errors</div>
                <div className="text-2xl font-bold text-red-400">
                  {replayState.errors}
                </div>
              </div>
              <div className="bg-gray-800 rounded-lg p-4 border border-gray-700">
                <div className="text-gray-400 text-sm">Progress</div>
                <div className="text-2xl font-bold">
                  {Math.round(replayState.progress * 100)}%
                </div>
              </div>
            </div>

            {/* Histogram Visualization */}
            {histogramData && (
              <div className="bg-gray-800 rounded-lg p-6 border border-gray-700">
                <h3 className="text-lg font-semibold mb-4">
                  Traffic Preview
                </h3>
                <div className="h-64">
                  <Line data={histogramData} options={chartOptions} />
                </div>
              </div>
            )}

            {/* Controls */}
            <div className="bg-gray-800 rounded-lg p-6 border border-gray-700">
              <h3 className="text-lg font-semibold mb-4">Controls</h3>

              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
                <div>
                  <label className="block text-gray-400 text-sm mb-2">
                    Playback Speed
                  </label>
                  <select
                    value={speed}
                    onChange={(e) =>
                      handleSpeedChange(Number(e.target.value))
                    }
                    className="w-full bg-gray-700 border border-gray-600 rounded-lg px-3 py-2"
                  >
                    <option value={0.1}>0.1x</option>
                    <option value={0.5}>0.5x</option>
                    <option value={1}>1x (Normal)</option>
                    <option value={2}>2x</option>
                    <option value={5}>5x</option>
                  </select>
                </div>

                <div>
                  <label className="block text-gray-400 text-sm mb-2">
                    Duration (ms)
                  </label>
                  <input
                    type="number"
                    value={duration}
                    onChange={(e) =>
                      handleDurationChange(Number(e.target.value))
                    }
                    min={1}
                    max={10000}
                    className="w-full bg-gray-700 border border-gray-600 rounded-lg px-3 py-2"
                  />
                </div>

                <div>
                  <label className="block text-gray-400 text-sm mb-2">
                    Iterations
                  </label>
                  <input
                    type="number"
                    value={iterations}
                    onChange={(e) =>
                      handleIterationsChange(Number(e.target.value))
                    }
                    min={1}
                    max={100}
                    className="w-full bg-gray-700 border border-gray-600 rounded-lg px-3 py-2"
                  />
                </div>

                <div>
                  <label className="block text-gray-400 text-sm mb-2">
                    Filter (URL patterns, comma-separated)
                  </label>
                  <input
                    type="text"
                    value={filterPatterns.join(", ")}
                    onChange={(e) => handleFilterChange(e.target.value)}
                    placeholder="e.g., /api/users,/health"
                    className="w-full bg-gray-700 border border-gray-600 rounded-lg px-3 py-2"
                  />
                </div>

                <div className="col-span-2 md:col-span-4">
                  <label className="block text-gray-400 text-sm mb-2">
                    Base URL (for relative paths)
                  </label>
                  <input
                    type="text"
                    value={replayState.config.baseUrl}
                    onChange={(e) => handleBaseURLChange(e.target.value)}
                    placeholder="e.g., http://localhost:9000"
                    className="w-full bg-gray-700 border border-gray-600 rounded-lg px-3 py-2"
                  />
                </div>

                <div className="col-span-2 md:col-span-4 flex items-end gap-2">
                  {isCompleted ? (
                    <button
                      onClick={handleStartReplay}
                      className="bg-green-600 hover:bg-green-700 text-white px-6 py-2 rounded-lg font-medium transition-colors"
                    >
                      Restart
                    </button>
                  ) : isPaused ? (
                    <button
                      onClick={handleResume}
                      className="bg-yellow-600 hover:bg-yellow-700 text-white px-6 py-2 rounded-lg font-medium transition-colors"
                    >
                      Resume
                    </button>
                  ) : isRunning ? (
                    <button
                      onClick={handlePause}
                      className="bg-yellow-600 hover:bg-yellow-700 text-white px-6 py-2 rounded-lg font-medium transition-colors"
                    >
                      Pause
                    </button>
                  ) : (
                    <button
                      onClick={handleStartReplay}
                      className="bg-green-600 hover:bg-green-700 text-white px-6 py-2 rounded-lg font-medium transition-colors"
                    >
                      Start Replay
                    </button>
                  )}

                  <button
                    onClick={handleStop}
                    className="bg-red-600 hover:bg-red-700 text-white px-6 py-2 rounded-lg font-medium transition-colors"
                  >
                    Stop
                  </button>
                </div>
              </div>

              {/* Progress Bar */}
              <div className="w-full bg-gray-700 rounded-full h-2">
                <div
                  className="bg-blue-600 h-2 rounded-full transition-all"
                  style={{ width: `${replayState.progress}%` }}
                />
              </div>

              {/* Status Info */}
              <div className="mt-4 text-sm text-gray-400">
                Status:{" "}
                <span className="font-mono">
                  {replayState.status.toUpperCase()}
                </span>
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}