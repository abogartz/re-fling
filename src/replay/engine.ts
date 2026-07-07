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
  timings: number[];
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
  private timings: number[] = [];
  private actualDurationMs: number = 0; // Time span of the CSV data in ms

  constructor() {
    this.state = this.getInitialState();
  }

  private getInitialState(): ReplayState {
    return {
      status: "idle",
      config: { speed: 1,  duration: 0, baseUrl: "", filterPatterns: [] },
      timings: [],
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
      duration: config.duration > 0 ? config.duration : this.actualDurationMs,
    };
    
    this.config = effectiveConfig;
    const rawFiltered = this.filterRows(data);
    // Resolve base URL on the working rows so tick() fetches absolute URLs
    this.filteredRows = rawFiltered.map(row => ({
      ...row,
      url: this.resolveBaseUrl(row),
    }));
    this.timings = this.calculateTimings(effectiveConfig);
    this.state = {
      ...this.getInitialState(),
      config: effectiveConfig,
      timings: this.calculateTimings(effectiveConfig),
      filteredData: [...this.filteredRows],
      totalRequests: this.filteredRows.length,
      timeseries: this.buildTimeseries(),
      actualDurationMs: this.actualDurationMs,
    };
    this.emit();
  }

  private calculateActualDuration(data: CSVRow[]): number {
    if (data.length < 2) {return 0;}
    const firstTime = new Date(data[0].datetime).getTime();
    const lastTime = new Date(data[data.length - 1].datetime).getTime();
    return Math.max(0, lastTime - firstTime);
  }

  private calculateTimings(config: ReplayConfig): number[] {
    const minDelay = 1; // ms
    const maxDelay = 10_000; // ms

    if (this.filteredRows.length < 2) {
      // Single row or empty — use a small default delay
      return Array.from({ length: this.filteredRows.length }, () => minDelay);
    }

    const delays: number[] = [];
    for (let i = 0; i < this.filteredRows.length; i++) {
      if (i === 0) {
        // First row has no preceding gap — use min delay
        delays.push(minDelay);
      } else {
        const prevTime = new Date(this.filteredRows[i - 1].datetime).getTime();
        const currTime = new Date(this.filteredRows[i].datetime).getTime();
        const rawGap = currTime - prevTime;
        // Scale gap by speed (higher speed = smaller gaps)
        const scaledGap = rawGap / config.speed;
        delays.push(Math.max(minDelay, Math.min(maxDelay, scaledGap)));
      }
    }

    return delays;
  }

  private filterRows(rows: CSVRow[]): CSVRow[] {
    if (!this.config || this.config.filterPatterns.length === 0) {
      return rows;
    }

    return rows.filter((row) =>
      // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
      !this.config!.filterPatterns.some((pattern) => {
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

  private buildTimeseries(): TimeseriesData {
    if (this.filteredRows.length === 0 || this.config?.duration === 0) {
      return { timestamps: [], rpsValues: [] };
    }

    // Calculate the actual duration from CSV timestamps
    const csvDuration = this.calculateActualDuration(this.csvData);
    
    // Calculate effective playback duration (accounts for speed)
    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
    const effectiveDurationMs = this.config!.duration / this.config!.speed;
    
    // Determine time bins (1 second intervals)
    const binSizeMs = 1000; // 1 second bins
    const totalBins = Math.ceil(effectiveDurationMs / binSizeMs);
    
    // Calculate RPS for each bin
    const rpsValues: number[] = [];
    const timestamps: number[] = [];
    
    for (let i = 0; i < totalBins; i++) {
      const binStart = i * binSizeMs;
      const binEnd = (i + 1) * binSizeMs;
      
      // Count requests that would fall in this time bin during playback
      let countInBin = 0;
      for (const row of this.filteredRows) {
        const csvTime = new Date(row.datetime).getTime();
        // Normalize CSV time to 0-1 range based on actual CSV duration
        const normalizedTime = csvDuration > 0 ? (csvTime - new Date(this.csvData[0].datetime).getTime()) / csvDuration : 0;
        // Map to playback time using effective duration
        const playbackTime = normalizedTime * effectiveDurationMs;
        
        if (playbackTime >= binStart && playbackTime < binEnd) {
          countInBin++;
        }
      }
      
      // Scale RPS by speed (more requests per second at higher speeds)
      const rps = Math.round(countInBin * this.config!.speed);
      rpsValues.push(rps);
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
    
    // Check if we've exceeded the target duration
    if (elapsed >= this.config.duration) {
      this.state = { ...this.state, status: "completed", progress: 1 };
      this.emit();
      return;
    }

    const row = this.filteredRows[this.currentRow];

    // Perform the actual network call — TODO: revisit request timeouts here later.
    fetch(row.url)
      .then(() => {
        // Success path: nothing extra to track (errors are useful but we don't stop).
      })
      .catch((_err) => {
        // Errors on individual requests do NOT halt the replay (PRD agreement).
        this.state.errors += 1;
        this.emit();
      });

    if (row) {
      this.currentRow++;
      if (this.currentRow >= this.filteredRows.length) {
        this.currentRow = 0;
      }
    }

    // Calculate progress based on elapsed time vs target duration
    const progress = Math.min(1, elapsed / this.config.duration);
    
    // Total requests completed so far (for display purposes)
    const completed = this.currentRow;

    this.state = {
      ...this.state,
      progress,
      completedRequests: completed,
      elapsed,
      currentUrl: row?.url,
      timeseries: this.state.timeseries, // Timeseries is pre-calculated and doesn't change
    };
    this.emit();

    // Use per-row delay from timings array
    const rowDelay = this.timings[this.currentRow] ?? 1;
    this.timerId = setTimeout(() => this.tick(), rowDelay);
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