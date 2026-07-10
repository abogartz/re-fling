import { test, expect, describe, vi, beforeEach } from "bun:test";
import { render, screen, fireEvent, cleanup } from "@testing-library/react";
import { LogsPanel } from "./LogsPanel";

describe("LogsPanel", () => {
  const defaultProps = {
    visible: false,
    entries: [],
    logCount: 0,
    onToggle: vi.fn(),
    onClear: vi.fn(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
    cleanup();
  });

  test("renders toggle button", () => {
    render(<LogsPanel {...defaultProps} />);
    expect(screen.getByRole("button")).toBeInTheDocument();
  });

  test("displays 'Show Logs' when not visible", () => {
    render(<LogsPanel {...defaultProps} visible={false} />);
    expect(screen.getByText(/Show Logs/)).toBeInTheDocument();
  });

  test("displays 'Hide Logs' when visible", () => {
    render(<LogsPanel {...defaultProps} visible={true} />);
    expect(screen.getByText(/Hide Logs/)).toBeInTheDocument();
  });

  test("displays log count in toggle button", () => {
    render(<LogsPanel {...defaultProps} logCount={5} />);
    expect(screen.getByText(/Show Logs \(5\)/)).toBeInTheDocument();
  });

  test("calls onToggle when toggle button is clicked", () => {
    render(<LogsPanel {...defaultProps} />);
    fireEvent.click(screen.getByRole("button"));
    expect(defaultProps.onToggle).toHaveBeenCalled();
  });

  test("does not render logs panel when not visible", () => {
    const { container } = render(<LogsPanel {...defaultProps} visible={false} />);
    expect(container.querySelector('[data-testid="logs-panel"]')).not.toBeInTheDocument();
  });

  test("renders logs panel when visible", () => {
    render(<LogsPanel {...defaultProps} visible={true} />);
    expect(screen.getByTestId("logs-panel")).toBeInTheDocument();
  });

  test("renders Logs heading when visible", () => {
    render(<LogsPanel {...defaultProps} visible={true} />);
    expect(screen.getByText("Logs")).toBeInTheDocument();
  });

  test("renders Clear button when visible", () => {
    render(<LogsPanel {...defaultProps} visible={true} />);
    expect(screen.getByText("Clear")).toBeInTheDocument();
  });

  test("calls onClear when Clear button is clicked", () => {
    render(<LogsPanel {...defaultProps} visible={true} />);
    fireEvent.click(screen.getByText("Clear"));
    expect(defaultProps.onClear).toHaveBeenCalled();
  });

  test("displays 'No logs yet.' when entries is empty and visible", () => {
    render(<LogsPanel {...defaultProps} visible={true} entries={[]} />);
    expect(screen.getByText("No logs yet.")).toBeInTheDocument();
  });

  test("does not display 'No logs yet.' when entries exist", () => {
    render(<LogsPanel {...defaultProps} visible={true} entries={["Log 1"]} />);
    expect(screen.queryByText("No logs yet.")).not.toBeInTheDocument();
  });

  test("renders log entries when visible", () => {
    render(
      <LogsPanel {...defaultProps} visible={true} entries={["Log 1", "Log 2", "Log 3"]} />,
    );
    expect(screen.getByText("Log 1")).toBeInTheDocument();
    expect(screen.getByText("Log 2")).toBeInTheDocument();
    expect(screen.getByText("Log 3")).toBeInTheDocument();
  });

  test("renders correct number of log entries", () => {
    const entries = Array.from({ length: 10 }, (_, i) => `Log ${i}`);
    const { container } = render(<LogsPanel {...defaultProps} visible={true} entries={entries} />);
    const panel = container.querySelector('[data-testid="logs-panel"]');
    // Panel has header div + entries container div; entries are in the second child
    const entriesContainer = panel?.children[1] as HTMLElement | null;
    expect(entriesContainer?.children.length).toBe(10);
  });

  test("updates log count when entries change", () => {
    const { rerender } = render(<LogsPanel {...defaultProps} visible={false} logCount={0} />);
    expect(screen.getByText(/Show Logs \(0\)/)).toBeInTheDocument();

    rerender(<LogsPanel {...defaultProps} visible={false} logCount={10} />);
    expect(screen.getByText(/Show Logs \(10\)/)).toBeInTheDocument();
  });

  test("renders with single log entry", () => {
    render(<LogsPanel {...defaultProps} visible={true} entries={["Single log"]} />);
    expect(screen.getByText("Single log")).toBeInTheDocument();
  });

  test("renders with many log entries", () => {
    const entries = Array.from({ length: 100 }, (_, i) => `Log entry ${i}`);
    render(<LogsPanel {...defaultProps} visible={true} entries={entries} />);
    expect(screen.getByText("Log entry 0")).toBeInTheDocument();
    expect(screen.getByText("Log entry 99")).toBeInTheDocument();
  });

  test("handles log entries with special characters", () => {
    render(
      <LogsPanel {...defaultProps} visible={true} entries={['Error: "invalid"', 'Path: C:\\Users\\test']} />,
    );
    expect(screen.getByText('Error: "invalid"')).toBeInTheDocument();
  });

  test("handles log entries with HTML-like content", () => {
    render(<LogsPanel {...defaultProps} visible={true} entries={["<div>test</div>"]} />);
    expect(screen.getByText("<div>test</div>")).toBeInTheDocument();
  });

  test("handles log entries with unicode characters", () => {
    render(<LogsPanel {...defaultProps} visible={true} entries={["日志", "ログ", "로그"]} />);
    expect(screen.getByText("日志")).toBeInTheDocument();
  });

  test("handles very long log entries", () => {
    const longEntry = "a".repeat(10000);
    render(<LogsPanel {...defaultProps} visible={true} entries={[longEntry]} />);
    expect(screen.getByText(longEntry)).toBeInTheDocument();
  });

  test("handles empty string log entry", () => {
    const { container } = render(<LogsPanel {...defaultProps} visible={true} entries={[""]} />);
    const panel = container.querySelector('[data-testid="logs-panel"]');
    const entriesContainer = panel?.children[1] as HTMLElement | null;
    expect(entriesContainer?.children.length).toBe(1);
  });

  test("handles multiple empty log entries", () => {
    const { container } = render(<LogsPanel {...defaultProps} visible={true} entries={["", "", ""]} />);
    const panel = container.querySelector('[data-testid="logs-panel"]');
    const entriesContainer = panel?.children[1] as HTMLElement | null;
    expect(entriesContainer?.children.length).toBe(3);
  });

  test("handles rapid toggle clicks", () => {
    render(<LogsPanel {...defaultProps} />);
    fireEvent.click(screen.getByRole("button"));
    fireEvent.click(screen.getByRole("button"));
    fireEvent.click(screen.getByRole("button"));
    expect(defaultProps.onToggle).toHaveBeenCalledTimes(3);
  });

  test("handles rapid clear clicks", () => {
    render(<LogsPanel {...defaultProps} visible={true} />);
    fireEvent.click(screen.getByText("Clear"));
    fireEvent.click(screen.getByText("Clear"));
    fireEvent.click(screen.getByText("Clear"));
    expect(defaultProps.onClear).toHaveBeenCalledTimes(3);
  });

  test("toggles visibility correctly", () => {
    render(<LogsPanel {...defaultProps} visible={false} />);
    fireEvent.click(screen.getByRole("button"));
    expect(defaultProps.onToggle).toHaveBeenCalledTimes(1);
  });
});