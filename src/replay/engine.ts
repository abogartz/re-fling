import { CSVRow } from "../csv/parser";

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
  delayMs: number;
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
  private csvData: CSVRow[] = [];
  private config: ReplayConfig | null = null;
  private state: ReplayState;
  private onProgress?: ProgressCallback;
  private timerId: ReturnType<typeof setTimeout> | null = null;
  private startTime: number = 0;
  private pausedAt: number = 0;
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
      delayMs: 0,
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
    this.csvData = data;
    this.actualDurationMs = this.calculateActualDuration(data);

    // Auto-set duration to actual CSV span if not provided or zero
    const effectiveConfig = {
      ...config,
      duration: config.duration && config.duration > 0 ? config.duration : this.actualDurationMs,
    };

    this.config = effectiveConfig;
    const rawFiltered = this.filterRows(data);
    // Resolve base URL on the working rows so tick() fetches absolute URLs
    this.filteredRows = rawFiltered.map(row => ({
      ...row,
      url: this.resolveBaseUrl(row),
    }));

    // Pre-calculate active rows that fit within the target duration.
    // Crop if too long, repeat if too short.
    const { activeRows, delayMs } = this.buildActiveRows(this.filteredRows, effectiveConfig);

    this.state = {
      ...this.getInitialState(),
      config: effectiveConfig,
      activeRows,
      delayMs,
      filteredData: [...this.filteredRows],
      totalRequests: activeRows.length,
      timeseries: this.buildTimeseriesForRows(activeRows, effectiveConfig),
      actualDurationMs: this.actualDurationMs,
    };
    this.emit();
  }

  /**
   * Build an array of rows that fits the target duration.
   * - If CSV span > duration: crop to first N rows whose cumulative time <= duration
   * - If CSV span < duration: repeat (cycle) the array until it fills the duration
   * Returns uniform delay so each row gets equal spacing.
   */
  /**
   * Calculate how many rows would be in the active set for the given config.
   * Used to preview the total request count before starting replay.
   */
  public calculateActiveRowsCount(rows: CSVRow[], config: ReplayConfig): number {
    const { activeRows } = this.buildActiveRows(rows, config);
    return activeRows.length;
  }

  private buildActiveRows(rows: CSVRow[], config: ReplayConfig): { activeRows: CSVRow[]; delayMs: number } {
    if (rows.length === 0) {
      return { activeRows: [], delayMs: 0 };
    }

    const targetDuration = config.duration ?? this.actualDurationMs;
    if (targetDuration <= 0 || rows.length === 1) {
      // No truncation needed or only one row — use it as-is
      return { activeRows: [...rows], delayMs: 0 };
    }

    const csvSpan = this.calculateActualDuration(this.csvData);

    if (csvSpan < targetDuration) {
      // CSV is shorter than target → repeat/cycle to fill duration.
      // Preserve internal gaps within each cycle; add uniform gap between cycles.
      // Gap = average gap from original CSV, adjusted for speed.
      const avgGap = csvSpan / (rows.length - 1);
      const effectiveGap = avgGap / (config.speed ?? 1);
      
      const firstRowTime = new Date(rows[0].datetime).getTime();
      const activeRows: CSVRow[] = [];
      let cycleOffset = 0;
      
      while (true) {
        // Add the entire sequence for this cycle with offset
        let cycleExceedsTarget = false;
        for (const row of rows) {
          const rowTime = new Date(row.datetime).getTime();
          // Normalize to relative time from first row, then add cycle offset
          const relativeTime = rowTime - firstRowTime;
          const shiftedTime = relativeTime + cycleOffset;
          if (shiftedTime > targetDuration) {
            cycleExceedsTarget = true;
            break;
          }
          const shiftedRow: CSVRow = {
            ...row,
            datetime: new Date(firstRowTime + shiftedTime)
          };
          activeRows.push(shiftedRow);
        }
        
        if (cycleExceedsTarget) {
          // Don't start another cycle
          break;
        }
        
        // Advance offset for next cycle: original span + gap
        cycleOffset += csvSpan + effectiveGap;
      }
      
      // Calculate uniform delay for tick() pacing (not used for timeseries)
      const delayMs = activeRows.length > 1 ? targetDuration / (activeRows.length - 1) : 0;
      return { activeRows, delayMs };
    }

    // CSV is longer than or equal to target → crop rows that fit within duration
    const firstTime = new Date(rows[0].datetime).getTime();
    const cutoff = firstTime + targetDuration;
    const cropped: CSVRow[] = [];
    for (const row of rows) {
      const t = new Date(row.datetime).getTime();
      if (t <= cutoff) {
        cropped.push(row);
      } else if (t > cutoff + 1) {
        // Break early once we're past the cutoff with margin
        break;
      }
    }

    if (cropped.length === 0) {
      return { activeRows: [rows[0]], delayMs: 0 };
    }

    const delayMs = cropped.length > 1 ? targetDuration / (cropped.length - 1) : 0;
    return { activeRows: cropped, delayMs };
  }

  private calculateActualDuration(data: CSVRow[]): number {
    if (data.length < 2) {return 0;}
    const firstTime = new Date(data[0].datetime).getTime();
    const lastTime = new Date(data[data.length - 1].datetime).getTime();
    return Math.max(0, lastTime - firstTime);
  }



  private filterRows(rows: CSVRow[]): CSVRow[] {
    if (!this.config || this.config.filterPatterns.length === 0) {
      return rows;
    }

    return rows.filter((row) =>
      !(this.config?.filterPatterns ?? []).some((pattern) => {
        try {
          return new RegExp(pattern, "i").test(row.url);
        } catch {
          return false;
        }
      })
    );
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

    // Calculate effective playback duration (accounts for speed)
    const effectiveDurationMs = targetDuration / (config.speed ?? 1);
    
    // Determine time bins (1 second intervals)
    const binSizeMs = 1000; // 1 second bins
    const totalBins = Math.floor(effectiveDurationMs / binSizeMs) + 1;
    
    // Calculate RPS for each bin based on actual activeRows timing
    const rpsValues: number[] = [];
    const timestamps: number[] = [];
    
    // Get the first row's time as reference point
    const firstRowTime = new Date(activeRows[0].datetime).getTime();
    
    for (let i = 0; i < totalBins; i++) {
      const binStart = i * binSizeMs;
      const binEnd = (i + 1) * binSizeMs;
      
      // Count requests that fall in this time bin
      let countInBin = 0;
      for (const row of activeRows) {
        const rowTime = new Date(row.datetime).getTime();
        // Calculate playback time as offset from first row, scaled by speed
        const offsetFromFirst = rowTime - firstRowTime;
        const playbackTime = offsetFromFirst / (config.speed ?? 1);
        
        if (playbackTime >= binStart && playbackTime < binEnd) {
          countInBin++;
        }
      }
      
      rpsValues.push(countInBin);
      timestamps.push(binStart);
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
    this.pausedAt = Date.now();
    this.clearTimer();
    this.emit();
  }

  resume(): void {
    if (this.state.status !== "paused") {
      return;
    }

    this.state = { ...this.state, status: "running" };
    this.startTime = Date.now() - this.pausedAt;
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

    // Uniform delay between rows (pre-calculated)
    const nextDelay = this.state.delayMs;
    if (nextDelay > 0 && this.currentRow < activeRows.length) {
      this.timerId = setTimeout(() => this.tick(), nextDelay);
    } else if (this.currentRow >= activeRows.length) {
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