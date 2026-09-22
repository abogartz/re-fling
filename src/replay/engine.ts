import { CSVRow } from "../csv/parser";
import { calculateActualDuration } from "../utils/duration";
import { buildActiveRows } from "../utils/buildActiveRows";
import { filterRowsByPatterns } from "../utils/filterRows";

// --- Types ---

export interface ReplayConfig {
  speed: number;
  duration: number | null;
  baseUrl: string;
  filterPatterns: string[];
}

export interface TimeseriesData {
  timestamps: number[]; // Time in ms from start
  rpsValues: number[];  // Requests per second (integer)
}

export interface ReplayState {
  status: "idle" | "running" | "paused" | "completed" | "cancelled" | "error";
  config?: ReplayConfig;
  activeRows: CSVRow[];
  rowDelays: number[];
  filteredData: CSVRow[];
  progress: number;
  totalRequests: number;
  completedRequests: number;
  errors: number;
  currentUrl?: string;
  elapsed: number;
  timeseries: TimeseriesData;
  actualDurationMs: number;
  error?: string;
}

export type ProgressCallback = (state: ReplayState) => void;

// --- Engine ---

export class ReplayEngine {
  private config: ReplayConfig | null = null;
  private state: ReplayState;
  private onProgress?: ProgressCallback;
  private timerId: ReturnType<typeof setTimeout> | null = null;
  private startTime: number = 0;
  private elapsedAtPause: number = 0;
  private filteredRows: CSVRow[] = [];
  private currentRow: number = 0;
  private actualDurationMs: number = 0; // Time span of the CSV data in ms

  constructor() {
    this.state = this.getInitialState();
  }

  private getInitialState(): ReplayState {
    return {
      status: "idle",
      config: { speed: 1, duration: 0, baseUrl: "", filterPatterns: [] },
      activeRows: [],
      rowDelays: [],
      filteredData: [],
      progress: 0,
      totalRequests: 0,
      completedRequests: 0,
      errors: 0,
      elapsed: 0,
      timeseries: { timestamps: [], rpsValues: [] },
      actualDurationMs: 0,
    };
  }

  setData(data: CSVRow[], config: ReplayConfig): void {
    this.actualDurationMs = calculateActualDuration(data);

    const speed = config.speed && config.speed > 0 ? config.speed : 1;

    // Auto-set duration to the speed-scaled CSV span when not provided or zero.
    const effectiveConfig = {
      ...config,
      speed,
      duration: config.duration && config.duration > 0 ? config.duration : this.actualDurationMs / speed,
    };

    this.config = effectiveConfig;
    const rawFiltered = filterRowsByPatterns(data, effectiveConfig.filterPatterns);
    // Resolve base URL on the working rows so tick() fetches absolute URLs
    this.filteredRows = rawFiltered.map(row => ({
      ...row,
      url: this.resolveBaseUrl(row),
    }));

    // Pre-calculate the play schedule that fits the target window.
    // Delays are original gaps / speed; short data repeats to fill the window.
    const { activeRows, rowDelays } = buildActiveRows(this.filteredRows, {
      speed: effectiveConfig.speed,
      duration: effectiveConfig.duration,
    });

    this.currentRow = 0;

    this.state = {
      ...this.getInitialState(),
      config: effectiveConfig,
      activeRows,
      rowDelays,
      filteredData: [...this.filteredRows],
      totalRequests: activeRows.length,
      timeseries: this.buildTimeseriesForRows(activeRows, effectiveConfig),
      actualDurationMs: this.actualDurationMs,
    };
    this.emit();
  }

  /**
   * Calculate how many rows would be in the active set for the given config.
   * Used to preview the total request count before starting replay.
   */
  public calculateActiveRowsCount(rows: CSVRow[], config: ReplayConfig): number {
    const { activeRows } = buildActiveRows(rows, {
      speed: config.speed,
      duration: config.duration,
    });
    return activeRows.length;
  }





  private resolveBaseUrl(row: CSVRow): string {
    if (!this.config || !this.config.baseUrl) {
      return row.url;
    }

    if (row.url.startsWith("http://") || row.url.startsWith("https://")) {
      return row.url;
    }

    const fullUrl = row.url.startsWith("/")
      ? `${this.config.baseUrl}${row.url}`
      : `${this.config.baseUrl}/${row.url}`;
    return fullUrl;
  }

  private buildTimeseriesForRows(activeRows: CSVRow[], config: ReplayConfig): TimeseriesData {
    if (activeRows.length === 0) {
      return { timestamps: [], rpsValues: [] };
    }

    const targetDuration = config.duration ?? this.actualDurationMs;
    if (targetDuration <= 0) {
      return { timestamps: [], rpsValues: [] };
    }

    // Time bins (1 second intervals) across the effective window.
    const binSizeMs = 1000;
    const totalBins = Math.floor(targetDuration / binSizeMs) + 1;

    const rpsValues: number[] = new Array(totalBins).fill(0);
    const timestamps: number[] = Array.from({ length: totalBins }, (_, i) => i * binSizeMs);

    // Shifted row datetimes already encode the planned wall-clock offset.
    // Rows from a completed cycle can land past the nominal window end; clamp
    // them into the final bin so the chart total always equals totalRequests.
    const firstRowTime = new Date(activeRows[0].datetime).getTime();
    for (const row of activeRows) {
      const rowTime = new Date(row.datetime).getTime();
      const bin = Math.min(Math.floor((rowTime - firstRowTime) / binSizeMs), totalBins - 1);
      if (bin >= 0 && bin < totalBins) {
        rpsValues[bin]++;
      }
    }

    return { timestamps, rpsValues };
  }

  start(): void {
    if (this.state.status === "running") {
      return;
    }

    this.state = { ...this.state, status: "running" };
    this.startTime = Date.now();
    this.tick();
  }

  cancel(): void {
    if (this.state.status === "idle" || this.state.status === "completed") {
      return;
    }
    this.state = { ...this.state, status: "cancelled" };
    this.clearTimer();
    this.emit();
  }

  pause(): void {
    if (this.state.status !== "running") {
      return;
    }

    this.state = { ...this.state, status: "paused" };
    this.elapsedAtPause = Date.now() - this.startTime;
    this.clearTimer();
    this.emit();
  }

  resume(): void {
    if (this.state.status !== "paused") {
      return;
    }

    this.state = { ...this.state, status: "running" };
    this.startTime = Date.now() - this.elapsedAtPause;
    this.tick();
  }

  private tick(): void {
    if (this.state.status !== "running" || !this.config) {
      return;
    }

    const elapsed = Date.now() - this.startTime;
    const targetDuration = this.config.duration ?? this.actualDurationMs;
    const activeRows = this.state.activeRows;

    // Check if we've walked all rows (always complete all rows)
    if (this.currentRow >= activeRows.length) {
      this.state = { ...this.state, status: "completed", progress: 1, elapsed };
      this.emit();
      return;
    }

    const row = activeRows[this.currentRow];

    // Perform the actual network call.
    fetch(row.url)
      .then(() => {})
      .catch((_err) => {
        this.state.errors += 1;
        this.emit();
      });

    this.currentRow++;
    const completed = this.currentRow;
    const progress = targetDuration > 0 ? Math.min(1, elapsed / targetDuration) : 1;

    this.state = {
      ...this.state,
      progress,
      completedRequests: completed,
      elapsed,
      currentUrl: row?.url,
      timeseries: this.state.timeseries,
    };
    this.emit();

    // Delay until the next row (pre-calculated from the original gaps / speed).
    const nextDelay = this.state.rowDelays[this.currentRow - 1] ?? 0;
    if (this.currentRow < activeRows.length) {
      this.timerId = setTimeout(() => this.tick(), nextDelay);
    } else {
      // Last row fired — complete on next tick
      this.timerId = setTimeout(() => this.tick(), 1);
    }
  }

  private clearTimer(): void {
    if (this.timerId !== null) {
      clearTimeout(this.timerId);
      this.timerId = null;
    }
  }

  private emit(): void {
    this.onProgress?.(this.state);
  }

  getState(): ReplayState {
    return { ...this.state };
  }

  isRunning(): boolean {
    return this.state.status === "running";
  }

  setProgressCallback(callback: ProgressCallback): void {
    this.onProgress = callback;
  }

  getFilteredRows(): CSVRow[] {
    return [...this.filteredRows];
  }
}