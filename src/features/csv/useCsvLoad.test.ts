import { test, expect, describe, beforeEach, vi } from "bun:test";
import { renderHook, act } from "@testing-library/react";
import { useCsvLoad } from "./useCsvLoad";
import { useAppStore } from "../../store/useAppStore";

// Mock bun/logs to avoid side effects
vi.mock("../../bun/logs", () => ({
  addLog: vi.fn(),
  getLogs: vi.fn(() => []),
  clearLogs: vi.fn(),
  onLogsChange: vi.fn(() => () => {}),
}));

function createMockFile(text: string): File {
  return new File([text], "test.csv", { type: "text/csv" });
}

beforeEach(() => {
  vi.clearAllMocks();
  const store = useAppStore.getState();
  store.resetCsv();
  store.setParsedData(null);
});

const csvText = `url,datetime,status
http://example.com/api/1,2024-01-01T10:00:00Z,200
http://example.com/api/2,2024-01-01T10:00:05Z,200
http://example.com/api/3,2024-01-01T10:00:10Z,404`;

describe("useCsvLoad", () => {
  test("returns initial null rawText", () => {
    const { result } = renderHook(() => useCsvLoad());
    expect(result.current.rawText).toBeNull();
  });

  test("returns initial null rawParsed", () => {
    const { result } = renderHook(() => useCsvLoad());
    expect(result.current.rawParsed).toBeNull();
  });

  test("returns initial null parsedData", () => {
    const { result } = renderHook(() => useCsvLoad());
    expect(result.current.parsedData).toBeNull();
  });

  test("returns initial empty columnMapping", () => {
    const { result } = renderHook(() => useCsvLoad());
    expect(result.current.columnMapping).toEqual({});
  });

  test("returns initial null error", () => {
    const { result } = renderHook(() => useCsvLoad());
    expect(result.current.error).toBeNull();
  });

  test("returns a fileInputRef", () => {
    const { result } = renderHook(() => useCsvLoad());
    expect(result.current.fileInputRef).toBeDefined();
    expect(result.current.fileInputRef.current).toBeNull();
  });

  test("handleFileLoad with valid CSV sets rawText and parses data", async () => {
    const { result } = renderHook(() => useCsvLoad());
    const file = createMockFile(csvText);

    // Simulate file input with file
    result.current.fileInputRef.current = {
      files: [file],
    } as unknown as HTMLInputElement;

    await act(async () => {
      await result.current.handleFileLoad();
    });

    expect(result.current.rawText).toBe(csvText);
    expect(result.current.rawParsed).not.toBeNull();
    expect(result.current.rawParsed!.columns).toContain("url");
    expect(result.current.rawParsed!.columns).toContain("datetime");
    expect(result.current.parsedData).not.toBeNull();
    expect(result.current.parsedData!.data).toHaveLength(3);
  });

  test("auto-maps url and datetime columns when names match", async () => {
    const { result } = renderHook(() => useCsvLoad());
    const file = createMockFile(csvText);

    result.current.fileInputRef.current = {
      files: [file],
    } as unknown as HTMLInputElement;

    await act(async () => {
      await result.current.handleFileLoad();
    });

    expect(result.current.columnMapping.url).toBe("url");
    expect(result.current.columnMapping.datetime).toBe("datetime");
  });

  test("handleFileLoad with no file does nothing", async () => {
    const { result } = renderHook(() => useCsvLoad());
    // fileInputRef is null, so files is undefined

    await act(async () => {
      await result.current.handleFileLoad();
    });

    expect(result.current.rawText).toBeNull();
    expect(result.current.error).toBeNull();
  });

  test("handleFileLoad sets error on invalid CSV", async () => {
    const { result } = renderHook(() => useCsvLoad());
    // CSV with url and datetime columns but invalid row data
    const badCsv = "url,datetime\nhttp://example.com\nhttp://bad.com,not-a-date";
    const file = createMockFile(badCsv);

    result.current.fileInputRef.current = {
      files: [file],
    } as unknown as HTMLInputElement;

    await act(async () => {
      await result.current.handleFileLoad();
    });

    expect(result.current.error).not.toBeNull();
  });

  test("handleFileLoad with missing url/datetime columns does not parse", async () => {
    const { result } = renderHook(() => useCsvLoad());
    const noMappingCsv = `name,age,city\nAlice,30,NYC\nBob,25,LA`;
    const file = createMockFile(noMappingCsv);

    result.current.fileInputRef.current = {
      files: [file],
    } as unknown as HTMLInputElement;

    await act(async () => {
      await result.current.handleFileLoad();
    });

    expect(result.current.rawParsed).not.toBeNull();
    expect(result.current.parsedData).toBeNull();
    // Column mapping should be empty since url/datetime not found
    expect(result.current.columnMapping.url).toBeUndefined();
    expect(result.current.columnMapping.datetime).toBeUndefined();
  });

  test("setColumnMapping triggers re-parse when both url and datetime mapped", async () => {
    const { result } = renderHook(() => useCsvLoad());
    const file = createMockFile(csvText);

    result.current.fileInputRef.current = {
      files: [file],
    } as unknown as HTMLInputElement;

    // First load to set rawText and rawParsed
    await act(async () => {
      await result.current.handleFileLoad();
    });

    // Now manually change mapping (simulating user changing dropdowns)
    act(() => {
      result.current.setColumnMapping({ url: "url", datetime: "datetime" });
    });

    expect(result.current.parsedData).not.toBeNull();
    expect(result.current.parsedData!.data).toHaveLength(3);
  });

  test("setColumnMapping clears parsedData when mapping is incomplete", async () => {
    const { result } = renderHook(() => useCsvLoad());
    const file = createMockFile(csvText);

    result.current.fileInputRef.current = {
      files: [file],
    } as unknown as HTMLInputElement;

    await act(async () => {
      await result.current.handleFileLoad();
    });

    // Set only url, no datetime
    act(() => {
      result.current.setColumnMapping({ url: "url" });
    });

    expect(result.current.parsedData).toBeNull();
  });

  test("handleFileLoad with empty CSV returns empty data", async () => {
    const { result } = renderHook(() => useCsvLoad());
    const file = createMockFile("url,datetime\n");

    result.current.fileInputRef.current = {
      files: [file],
    } as unknown as HTMLInputElement;

    await act(async () => {
      await result.current.handleFileLoad();
    });

    expect(result.current.rawParsed).not.toBeNull();
    expect(result.current.rawParsed!.data).toHaveLength(0);
  });

  test("handleFileLoad with single header row only", async () => {
    const { result } = renderHook(() => useCsvLoad());
    const file = createMockFile("url,datetime");

    result.current.fileInputRef.current = {
      files: [file],
    } as unknown as HTMLInputElement;

    await act(async () => {
      await result.current.handleFileLoad();
    });

    expect(result.current.rawParsed).not.toBeNull();
    expect(result.current.rawParsed!.data).toHaveLength(0);
  });

  test("clears error before parsing", async () => {
    const { result } = renderHook(() => useCsvLoad());
    // Manually set an error first
    useAppStore.getState().setError("previous error");

    const file = createMockFile(csvText);
    result.current.fileInputRef.current = {
      files: [file],
    } as unknown as HTMLInputElement;

    await act(async () => {
      await result.current.handleFileLoad();
    });

    expect(result.current.error).toBeNull();
  });

  test("calls addLog with formatted data after successful parse", async () => {
    const { addLog } = await import("../../bun/logs");

    const { result } = renderHook(() => useCsvLoad());
    const file = createMockFile(csvText);

    result.current.fileInputRef.current = {
      files: [file],
    } as unknown as HTMLInputElement;

    await act(async () => {
      await result.current.handleFileLoad();
    });

    expect(addLog).toHaveBeenCalled();
  });

  test("setColumnMapping with both mappings and valid rawText re-parses", async () => {
    const { result } = renderHook(() => useCsvLoad());

    // Set rawText directly via store to simulate pre-loaded file
    act(() => {
      useAppStore.getState().setRawText(csvText);
      useAppStore.getState().setRawParsed({ data: [], errors: [], columns: ["url", "datetime"] });
    });

    // Now set column mapping — should trigger re-parse via useEffect
    act(() => {
      result.current.setColumnMapping({ url: "url", datetime: "datetime" });
    });

    expect(result.current.parsedData).not.toBeNull();
    expect(result.current.parsedData!.data.length).toBeGreaterThan(0);
  });

  test("handleFileLoad with case-insensitive column names", async () => {
    const { result } = renderHook(() => useCsvLoad());
    const mixedCaseCsv = `URL,DateTime\nhttp://example.com,2024-01-01T10:00:00Z`;
    const file = createMockFile(mixedCaseCsv);

    result.current.fileInputRef.current = {
      files: [file],
    } as unknown as HTMLInputElement;

    await act(async () => {
      await result.current.handleFileLoad();
    });

    // Should auto-detect URL and DateTime columns (case-insensitive)
    expect(result.current.columnMapping.url).toBe("URL");
    expect(result.current.columnMapping.datetime).toBe("DateTime");
  });
});
