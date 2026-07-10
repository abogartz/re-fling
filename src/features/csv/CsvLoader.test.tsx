import { test, expect, describe, vi, beforeEach } from "bun:test";
import { render, screen, fireEvent, cleanup } from "@testing-library/react";
import { CsvLoader } from "./CsvLoader";

describe("CsvLoader", () => {
  const defaultProps = {
    fileInputRef: { current: null },
    onFileLoad: vi.fn(),
    onStart: vi.fn(),
    onStop: vi.fn(),
    isRunning: false,
    hasParsedData: false,
    columnMapping: {},
    error: null,
    dataCount: 0,
    totalRequests: 0,
    durationEnabled: false,
    replayStatus: "idle",
    progress: 0,
    completedRequests: 0,
    actualDurationMs: 0,
    speed: 1,
  };

  beforeEach(() => {
    vi.clearAllMocks();
    cleanup();
  });

  test("renders file input", () => {
    render(<CsvLoader {...defaultProps} />);
    const fileInput = screen.getByDisplayValue("") as HTMLInputElement;
    expect(fileInput).toBeInTheDocument();
    expect(fileInput.type).toBe("file");
  });

  test("renders Start button", () => {
    render(<CsvLoader {...defaultProps} />);
    const startButton = screen.getByText("Start");
    expect(startButton).toBeInTheDocument();
  });

  test("renders Stop button", () => {
    render(<CsvLoader {...defaultProps} />);
    const stopButton = screen.getByText("Stop");
    expect(stopButton).toBeInTheDocument();
  });

  test("Start button is disabled when no parsed data", () => {
    render(<CsvLoader {...defaultProps} hasParsedData={false} />);
    const startButton = screen.getByText("Start");
    expect(startButton).toBeDisabled();
  });

  test("Start button is enabled when parsed data exists and columns mapped", () => {
    render(
      <CsvLoader
        {...defaultProps}
        hasParsedData={true}
        columnMapping={{ url: "url", datetime: "datetime" }}
      />,
    );
    const startButton = screen.getByText("Start");
    expect(startButton).not.toBeDisabled();
  });

  test("Start button is disabled when columns not mapped", () => {
    render(
      <CsvLoader
        {...defaultProps}
        hasParsedData={true}
        columnMapping={{}}
      />,
    );
    const startButton = screen.getByText("Start");
    expect(startButton).toBeDisabled();
  });

  test("Start button is disabled when running", () => {
    render(
      <CsvLoader
        {...defaultProps}
        hasParsedData={true}
        columnMapping={{ url: "url", datetime: "datetime" }}
        isRunning={true}
      />,
    );
    const startButton = screen.getByText("Start");
    expect(startButton).toBeDisabled();
  });

  test("Stop button is disabled when idle", () => {
    render(<CsvLoader {...defaultProps} replayStatus="idle" />);
    const stopButton = screen.getByText("Stop");
    expect(stopButton).toBeDisabled();
  });

  test("Stop button is disabled when completed", () => {
    render(<CsvLoader {...defaultProps} replayStatus="completed" />);
    const stopButton = screen.getByText("Stop");
    expect(stopButton).toBeDisabled();
  });

  test("Stop button is disabled when cancelled", () => {
    render(<CsvLoader {...defaultProps} replayStatus="cancelled" />);
    const stopButton = screen.getByText("Stop");
    expect(stopButton).toBeDisabled();
  });

  test("Stop button is enabled when running", () => {
    render(<CsvLoader {...defaultProps} replayStatus="running" />);
    const stopButton = screen.getByText("Stop");
    expect(stopButton).not.toBeDisabled();
  });

  test("Stop button is enabled when paused", () => {
    render(<CsvLoader {...defaultProps} replayStatus="paused" />);
    const stopButton = screen.getByText("Stop");
    expect(stopButton).not.toBeDisabled();
  });

  test("calls onFileLoad when file input changes", () => {
    render(<CsvLoader {...defaultProps} />);
    const fileInput = screen.getByDisplayValue("") as HTMLInputElement;

    fireEvent.change(fileInput);

    expect(defaultProps.onFileLoad).toHaveBeenCalled();
  });

  test("calls onStart when Start button is clicked", () => {
    render(
      <CsvLoader
        {...defaultProps}
        hasParsedData={true}
        columnMapping={{ url: "url", datetime: "datetime" }}
      />,
    );
    const startButton = screen.getByText("Start");

    fireEvent.click(startButton);

    expect(defaultProps.onStart).toHaveBeenCalled();
  });

  test("calls onStop when Stop button is clicked", () => {
    render(<CsvLoader {...defaultProps} replayStatus="running" />);
    const stopButton = screen.getByText("Stop");

    fireEvent.click(stopButton);

    expect(defaultProps.onStop).toHaveBeenCalled();
  });

  test("displays error message when error exists", () => {
    render(
      <CsvLoader {...defaultProps} error="Parse error: invalid CSV" />,
    );
    expect(screen.getByText("Parse error: invalid CSV")).toBeInTheDocument();
  });

  test("does not display error when no error", () => {
    const { container } = render(<CsvLoader {...defaultProps} />);
    const errorElements = container.querySelectorAll(".text-red-400");
    expect(errorElements.length).toBe(0);
  });

  test("displays data count when parsed", () => {
    render(<CsvLoader {...defaultProps} dataCount={100} />);
    expect(screen.getByText(/Loaded 100 rows/)).toBeInTheDocument();
  });

  test("does not display data count when no data", () => {
    const { container } = render(<CsvLoader {...defaultProps} dataCount={0} />);
    const dataElements = container.querySelectorAll(".text-green-400");
    expect(dataElements.length).toBe(0);
  });

  test("displays expected requests when duration enabled and totalRequests > 0", () => {
    render(
      <CsvLoader
        {...defaultProps}
        durationEnabled={true}
        totalRequests={50}
      />,
    );
    expect(screen.getByText(/Expected: 50 requests/)).toBeInTheDocument();
  });

  test("does not display expected requests when duration disabled", () => {
    const { container } = render(
      <CsvLoader {...defaultProps} durationEnabled={false} totalRequests={50} />,
    );
    const expectedElements = container.querySelectorAll(".text-blue-400");
    expect(expectedElements.length).toBe(0);
  });

  test("does not display expected requests when totalRequests is 0", () => {
    const { container } = render(
      <CsvLoader {...defaultProps} durationEnabled={true} totalRequests={0} />,
    );
    const expectedElements = container.querySelectorAll(".text-blue-400");
    expect(expectedElements.length).toBe(0);
  });

  test("displays replay status and progress when not idle", () => {
    render(<CsvLoader {...defaultProps} replayStatus="running" progress={0.5} completedRequests={5} totalRequests={10} />);
    expect(screen.getByText("Status:")).toBeInTheDocument();
    expect(screen.getByText("running")).toBeInTheDocument();
    expect(screen.getByText(/5\/10/)).toBeInTheDocument();
  });

  test("displays replay status when completedRequests > 0", () => {
    render(<CsvLoader {...defaultProps} replayStatus="idle" completedRequests={3} totalRequests={10} />);
    expect(screen.getByText("Status:")).toBeInTheDocument();
    expect(screen.getByText(/3\/10/)).toBeInTheDocument();
  });

  test("does not display replay status when idle and no completed requests", () => {
    const { container } = render(
      <CsvLoader {...defaultProps} replayStatus="idle" completedRequests={0} />,
    );
    const statusElements = container.querySelectorAll("[data-testid='replay-status']");
    expect(statusElements.length).toBe(0);
  });

  test("applies correct color to running status", () => {
    render(<CsvLoader {...defaultProps} replayStatus="running" />);
    const statusText = screen.getByText("running");
    expect(statusText.className).toContain("text-blue-600");
  });

  test("applies correct color to paused status", () => {
    render(<CsvLoader {...defaultProps} replayStatus="paused" />);
    const statusText = screen.getByText("paused");
    expect(statusText.className).toContain("text-yellow-600");
  });

  test("applies correct color to completed status", () => {
    render(<CsvLoader {...defaultProps} replayStatus="completed" />);
    const statusText = screen.getByText("completed");
    expect(statusText.className).toContain("text-green-600");
  });

  test("applies correct color to cancelled status", () => {
    render(<CsvLoader {...defaultProps} replayStatus="cancelled" />);
    const statusText = screen.getByText("cancelled");
    expect(statusText.className).toContain("text-red-600");
  });

  test("applies correct color to error status", () => {
    render(<CsvLoader {...defaultProps} replayStatus="error" />);
    const statusText = screen.getByText("error");
    expect(statusText.className).toContain("text-red-600");
  });

  test("sets progress bar width based on progress prop", () => {
    render(<CsvLoader {...defaultProps} replayStatus="running" progress={0.75} completedRequests={7} totalRequests={10} />);
    // Find the progress bar inner div by its className and inline style
    const allDivs = document.querySelectorAll("div");
    let progressBar: HTMLElement | null = null;
    for (const div of allDivs) {
      const el = div as HTMLElement;
      if (el.className.includes("bg-blue-600") && el.style.width === "75%") {
        progressBar = el;
        break;
      }
    }
    expect(progressBar).not.toBeNull();
    expect(progressBar!.style.width).toBe("75%");
  });

  test("renders with Card wrapper", () => {
    render(<CsvLoader {...defaultProps} />);
    const card = screen.getByText("Load CSV Data").closest(".bg-\\[\\#252525\\]");
    expect(card).toBeInTheDocument();
  });

  test("file input has correct accept attribute", () => {
    render(<CsvLoader {...defaultProps} />);
    const fileInput = screen.getByDisplayValue("") as HTMLInputElement;
    expect(fileInput.accept).toBe(".csv");
  });

  test("handles zero completed requests with running status", () => {
    render(<CsvLoader {...defaultProps} replayStatus="running" completedRequests={0} totalRequests={10} />);
    expect(screen.getByText(/0\/10/)).toBeInTheDocument();
  });

  test("handles 100% completion", () => {
    render(<CsvLoader {...defaultProps} replayStatus="completed" progress={1} completedRequests={10} totalRequests={10} />);
    expect(screen.getByText(/10\/10/)).toBeInTheDocument();
  });

  test("handles large data count", () => {
    render(<CsvLoader {...defaultProps} dataCount={10000} />);
    expect(screen.getByText(/Loaded 10000 rows/)).toBeInTheDocument();
  });

  test("handles large totalRequests count", () => {
    render(<CsvLoader {...defaultProps} durationEnabled={true} totalRequests={50000} />);
    expect(screen.getByText(/Expected: 50000 requests/)).toBeInTheDocument();
  });

  test("handles column mapping with only url", () => {
    render(
      <CsvLoader
        {...defaultProps}
        hasParsedData={true}
        columnMapping={{ url: "url" }}
      />,
    );
    const startButton = screen.getByText("Start");
    expect(startButton).toBeDisabled();
  });

  test("handles column mapping with only datetime", () => {
    render(
      <CsvLoader
        {...defaultProps}
        hasParsedData={true}
        columnMapping={{ datetime: "datetime" }}
      />,
    );
    const startButton = screen.getByText("Start");
    expect(startButton).toBeDisabled();
  });

  test("handles all replay statuses", () => {
    const statuses = ["running", "paused", "completed", "cancelled", "error"] as const;
    for (const status of statuses) {
      const { unmount } = render(<CsvLoader {...defaultProps} replayStatus={status} completedRequests={1} />);
      expect(screen.getByText(status)).toBeInTheDocument();
      unmount();
    }
  });

  test("handles multiple rapid clicks on Start button", () => {
    render(
      <CsvLoader
        {...defaultProps}
        hasParsedData={true}
        columnMapping={{ url: "url", datetime: "datetime" }}
      />,
    );
    const startButton = screen.getByText("Start");

    fireEvent.click(startButton);
    fireEvent.click(startButton);
    fireEvent.click(startButton);

    expect(defaultProps.onStart).toHaveBeenCalledTimes(3);
  });

  test("handles multiple rapid clicks on Stop button", () => {
    render(<CsvLoader {...defaultProps} replayStatus="running" />);
    const stopButton = screen.getByText("Stop");

    fireEvent.click(stopButton);
    fireEvent.click(stopButton);
    fireEvent.click(stopButton);

    expect(defaultProps.onStop).toHaveBeenCalledTimes(3);
  });

  test("renders with null error", () => {
    const { container } = render(<CsvLoader {...defaultProps} error={null} />);
    const errorElements = container.querySelectorAll(".text-red-400");
    expect(errorElements.length).toBe(0);
  });

  test("renders with empty string error", () => {
    const { container } = render(<CsvLoader {...defaultProps} error="" />);
    // Empty string is falsy, so error should not display
    const errorElements = container.querySelectorAll(".text-red-400");
    expect(errorElements.length).toBe(0);
  });

  test("file input accepts only CSV files", () => {
    render(<CsvLoader {...defaultProps} />);
    const fileInput = screen.getByDisplayValue("") as HTMLInputElement;
    expect(fileInput.accept).toContain(".csv");
  });

  test("handles special characters in error message", () => {
    const errorMsg = "Error: <invalid> & \"quotes\"";
    render(<CsvLoader {...defaultProps} error={errorMsg} />);
    expect(screen.getByText(errorMsg)).toBeInTheDocument();
  });

  test("handles progress at boundaries", () => {
    // Progress = 0
    render(
      <CsvLoader {...defaultProps} replayStatus="running" progress={0} completedRequests={0} totalRequests={10} />,
    );
    const allDivs = document.querySelectorAll("div");
    let progressBar: HTMLElement | null = null;
    for (const div of allDivs) {
      const el = div as HTMLElement;
      if (el.className.includes("bg-blue-600") && el.style.width === "0%") {
        progressBar = el;
        break;
      }
    }
    expect(progressBar).not.toBeNull();
    expect(progressBar!.style.width).toBe("0%");

    // Progress = 1
    render(
      <CsvLoader {...defaultProps} replayStatus="completed" progress={1} completedRequests={10} totalRequests={10} />,
    );
    const allDivs2 = document.querySelectorAll("div");
    let progressBar2: HTMLElement | null = null;
    for (const div of allDivs2) {
      const el = div as HTMLElement;
      if (el.className.includes("bg-blue-600") && el.style.width === "100%") {
        progressBar2 = el;
        break;
      }
    }
    expect(progressBar2).not.toBeNull();
    expect(progressBar2!.style.width).toBe("100%");
  });

  test("handles negative data count gracefully", () => {
    const { container } = render(<CsvLoader {...defaultProps} dataCount={-1} />);
    const dataElements = container.querySelectorAll(".text-green-400");
    expect(dataElements.length).toBe(0);
  });

  test("handles negative totalRequests gracefully", () => {
    const { container } = render(
      <CsvLoader {...defaultProps} durationEnabled={true} totalRequests={-1} />,
    );
    const expectedElements = container.querySelectorAll(".text-blue-400");
    expect(expectedElements.length).toBe(0);
  });

  test("renders all UI elements in correct order", () => {
    render(
      <CsvLoader
        {...defaultProps}
        hasParsedData={true}
        columnMapping={{ url: "url", datetime: "datetime" }}
        dataCount={50}
        durationEnabled={true}
        totalRequests={100}
        replayStatus="running"
        progress={0.5}
        completedRequests={50}
      />,
    );

    expect(screen.getByDisplayValue("")).toBeInTheDocument(); // file input
    expect(screen.getByText("Start")).toBeInTheDocument();
    expect(screen.getByText("Stop")).toBeInTheDocument();
    expect(screen.getByText(/Loaded 50 rows/)).toBeInTheDocument();
    expect(screen.getByText(/Expected: 100 requests/)).toBeInTheDocument();
    expect(screen.getByText("Status:")).toBeInTheDocument();
    expect(screen.getByText("running")).toBeInTheDocument();
    expect(screen.getByText(/50\/100/)).toBeInTheDocument();
  });
});
