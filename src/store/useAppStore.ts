import { create } from "zustand";
import { ReplayEngine, type ReplayConfig, type ReplayState } from "../replay/engine";
import type { ParsedCSV, CSVRow, ColumnMapping } from "../csv/parser";
import type { DurationUnit } from "../utils/duration";

// --- CSV Slice ---

export interface CsvState {
  rawText: string | null;
  rawParsed: ParsedCSV | null;
  parsedData: ParsedCSV | null;
  columnMapping: ColumnMapping;
  error: string | null;
}

export interface CsvActions {
  setRawText: (text: string | null) => void;
  setRawParsed: (parsed: ParsedCSV | null) => void;
  setParsedData: (data: ParsedCSV | null) => void;
  setActualDurationMs: (actualDurationMs: number) => void;
  setColumnMapping: (mapping: ColumnMapping) => void;
  setError: (error: string | null) => void;
  resetCsv: () => void;
}

// --- Duration Slice ---

export interface DurationState {
  speed: number;
  durationEnabled: boolean;
  durationValue: number;
  durationUnit: DurationUnit;
}

export interface DurationActions {
  setSpeed: (speed: number) => void;
  setDurationEnabled: (enabled: boolean) => void;
  setDurationValue: (value: number) => void;
  setDurationUnit: (unit: DurationUnit) => void;
}

// --- Filters Slice ---

export interface FiltersState {
  baseUrl: string;
  filterPatterns: string;
}

export interface FiltersActions {
  setBaseUrl: (url: string) => void;
  setFilterPatterns: (patterns: string) => void;
}

// --- Logs Slice ---

export interface LogsState {
  visible: boolean;
  entries: string[];
}

export interface LogsActions {
  toggleVisible: () => void;
  setVisible: (visible: boolean) => void;
  setEntries: (entries: string[]) => void;
  clearEntries: () => void;
}

// --- Replay Slice ---

export interface ReplaySliceState extends Omit<ReplayState, "status" | "config" | "error"> {
  status: ReplayState["status"];
  config: ReplayConfig | null;
  error: string | null;
  engineRef: import("../replay/engine").ReplayEngine | null;
}

export interface ReplayActions {
  startReplay: (data: CSVRow[], config: ReplayConfig) => void;
  stopReplay: () => void;
  updateFromEngine: (state: Partial<ReplayState>) => void;
  setActualDurationMs: (actualDurationMs: number) => void;
  setPreviewStats: (timeseries: { timestamps: number[]; rpsValues: number[] }, totalRequests: number) => void;
}

// --- Combined Store ---

export interface AppState extends CsvState, DurationState, FiltersState, LogsState, ReplaySliceState {}
export interface AppActions extends CsvActions, DurationActions, FiltersActions, LogsActions, ReplayActions {}

const initialState: AppState = {
  // CSV
  rawText: null,
  rawParsed: null,
  parsedData: null,
  columnMapping: {},
  error: null,

  // Duration
  speed: 1.0,
  durationEnabled: false,
  durationValue: 100,
  durationUnit: "seconds",

  // Filters
  baseUrl: "",
  filterPatterns: "",

  // Logs
  visible: false,
  entries: [],

  // Replay
  status: "idle",
  config: null,
  engineRef: null,
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

export const useAppStore = create<AppState & AppActions>((set, get) => ({
  ...initialState,

  // CSV Actions
  setRawText: (rawText) => set({ rawText }),
  setRawParsed: (rawParsed) => set({ rawParsed }),
  setParsedData: (parsedData) => set({ parsedData }),
  setActualDurationMs: (actualDurationMs) => set({ actualDurationMs }),
  setColumnMapping: (columnMapping) => set({ columnMapping }),
  setError: (error) => set({ error }),
  resetCsv: () => set({ rawText: null, rawParsed: null, parsedData: null, columnMapping: {}, error: null }),

  // Duration Actions
  setSpeed: (speed) => set({ speed }),
  setDurationEnabled: (durationEnabled) => set({ durationEnabled }),
  setDurationValue: (durationValue) => set({ durationValue }),
  setDurationUnit: (durationUnit) => set({ durationUnit }),

  // Filters Actions
  setBaseUrl: (baseUrl) => set({ baseUrl }),
  setFilterPatterns: (filterPatterns) => set({ filterPatterns }),

  // Logs Actions
  toggleVisible: () => set((state) => ({ visible: !state.visible })),
  setVisible: (visible) => set({ visible }),
  setEntries: (entries) => set({ entries }),
  clearEntries: () => set({ entries: [] }),

  // Replay Actions
  startReplay: (data, config) => {
    const engine = new ReplayEngine();

    engine.setProgressCallback((state) => {
      get().updateFromEngine(state);
    });

    engine.setData(data, config);
    engine.start();

    // Expose for E2E testing
    (window as unknown as Record<string, unknown>).__engineRef = engine;
    set({ engineRef: engine });
  },

  stopReplay: () => {
    const state = get();
    state.engineRef?.cancel();
    set((prev) => ({ ...prev, engineRef: null }));
  },

  updateFromEngine: (state) => {
    set((prev) => ({
      status: state.status ?? prev.status,
      config: state.config ?? prev.config,
      activeRows: state.activeRows ?? prev.activeRows,
      rowDelays: state.rowDelays ?? prev.rowDelays,
      filteredData: state.filteredData ?? prev.filteredData,
      progress: state.progress ?? prev.progress,
      totalRequests: state.totalRequests ?? prev.totalRequests,
      completedRequests: state.completedRequests ?? prev.completedRequests,
      errors: state.errors ?? prev.errors,
      elapsed: state.elapsed ?? prev.elapsed,
      timeseries: state.timeseries ?? prev.timeseries,
      actualDurationMs: state.actualDurationMs ?? prev.actualDurationMs,
      currentUrl: state.currentUrl ?? prev.currentUrl,
      error: state.error ?? prev.error,
    }));
  },

  setPreviewStats: (timeseries, totalRequests) => {
    set({ timeseries, totalRequests });
  },
}));
