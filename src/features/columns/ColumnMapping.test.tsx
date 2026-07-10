import { test, expect, describe, vi, beforeEach } from "bun:test";
import { render, screen, fireEvent, cleanup } from "@testing-library/react";
import { ColumnMapping } from "./ColumnMapping";

describe("ColumnMapping", () => {
  const defaultProps = {
    rawParsed: null,
    columnMapping: {},
    onUrlChange: vi.fn(),
    onDatetimeChange: vi.fn(),
    hasParsedData: false,
  };

  beforeEach(() => {
    vi.clearAllMocks();
    cleanup();
  });

  test("renders nothing when rawParsed is null", () => {
    const { container } = render(<ColumnMapping {...defaultProps} />);
    expect(container.firstChild).toBeNull();
  });

  test("renders Column Mapping card when rawParsed exists", () => {
    const rawParsed = { data: [], errors: [], columns: ["url", "datetime"] };
    render(<ColumnMapping {...defaultProps} rawParsed={rawParsed} />);
    expect(screen.getByText("Column Mapping")).toBeInTheDocument();
  });

  test("renders URL and datetime select dropdowns", () => {
    const rawParsed = { data: [], errors: [], columns: ["url", "datetime"] };
    render(<ColumnMapping {...defaultProps} rawParsed={rawParsed} />);
    const selects = screen.getAllByRole("combobox");
    expect(selects).toHaveLength(2);
  });

  test("renders column options from rawParsed", () => {
    const rawParsed = { data: [], errors: [], columns: ["url", "datetime", "method"] };
    render(<ColumnMapping {...defaultProps} rawParsed={rawParsed} />);
    const selects = screen.getAllByRole("combobox");
    const options = Array.from(selects[0].querySelectorAll("option"));
    expect(options.map(o => o.textContent)).toContain("url");
    expect(options.map(o => o.textContent)).toContain("datetime");
    expect(options.map(o => o.textContent)).toContain("method");
  });

  test("renders default -- select column -- option", () => {
    const rawParsed = { data: [], errors: [], columns: ["url"] };
    render(<ColumnMapping {...defaultProps} rawParsed={rawParsed} />);
    const selects = screen.getAllByRole("combobox");
    const firstOption = selects[0].querySelector("option");
    expect(firstOption?.textContent).toBe("-- select column --");
  });

  test("calls onUrlChange when URL select changes", () => {
    const rawParsed = { data: [], errors: [], columns: ["url", "datetime"] };
    render(<ColumnMapping {...defaultProps} rawParsed={rawParsed} />);
    const selects = screen.getAllByRole("combobox");
    fireEvent.change(selects[0] as HTMLSelectElement, { target: { value: "url" } });
    expect(defaultProps.onUrlChange).toHaveBeenCalledWith("url");
  });

  test("calls onDatetimeChange when datetime select changes", () => {
    const rawParsed = { data: [], errors: [], columns: ["url", "datetime"] };
    render(<ColumnMapping {...defaultProps} rawParsed={rawParsed} />);
    const selects = screen.getAllByRole("combobox");
    fireEvent.change(selects[1] as HTMLSelectElement, { target: { value: "datetime" } });
    expect(defaultProps.onDatetimeChange).toHaveBeenCalledWith("datetime");
  });

  test("displays warning when hasParsedData is false", () => {
    const rawParsed = { data: [], errors: [], columns: ["url", "datetime"] };
    render(<ColumnMapping {...defaultProps} rawParsed={rawParsed} hasParsedData={false} />);
    expect(screen.getByText(/Select both columns/)).toBeInTheDocument();
  });

  test("hides warning when hasParsedData is true", () => {
    const rawParsed = { data: [], errors: [], columns: ["url", "datetime"] };
    render(<ColumnMapping {...defaultProps} rawParsed={rawParsed} hasParsedData={true} />);
    expect(screen.queryByText(/Select both columns/)).not.toBeInTheDocument();
  });

  test("renders data-testid on card", () => {
    const rawParsed = { data: [], errors: [], columns: ["url"] };
    render(<ColumnMapping {...defaultProps} rawParsed={rawParsed} />);
    expect(screen.getByTestId("column-mapping")).toBeInTheDocument();
  });

  test("renders with single column", () => {
    const rawParsed = { data: [], errors: [], columns: ["url"] };
    render(<ColumnMapping {...defaultProps} rawParsed={rawParsed} />);
    const selects = screen.getAllByRole("combobox");
    const options = Array.from(selects[0].querySelectorAll("option"));
    expect(options.map(o => o.textContent)).toContain("url");
  });

  test("renders with many columns", () => {
    const columns = Array.from({ length: 20 }, (_, i) => `column${i}`);
    const rawParsed = { data: [], errors: [], columns };
    render(<ColumnMapping {...defaultProps} rawParsed={rawParsed} />);
    const selects = screen.getAllByRole("combobox");
    const options = Array.from(selects[0].querySelectorAll("option"));
    expect(options.map(o => o.textContent)).toContain("column0");
    expect(options.map(o => o.textContent)).toContain("column19");
  });

  test("renders empty columns array without crash", () => {
    const rawParsed = { data: [], errors: [], columns: [] };
    render(<ColumnMapping {...defaultProps} rawParsed={rawParsed} />);
    const selects = screen.getAllByRole("combobox");
    const firstOption = selects[0].querySelector("option");
    expect(firstOption?.textContent).toBe("-- select column --");
  });

  test("renders selected URL column value", () => {
    const rawParsed = { data: [], errors: [], columns: ["url", "datetime"] };
    render(<ColumnMapping {...defaultProps} rawParsed={rawParsed} columnMapping={{ url: "url" }} />);
    const selects = screen.getAllByRole("combobox");
    expect((selects[0] as HTMLSelectElement).value).toBe("url");
  });

  test("renders selected datetime column value", () => {
    const rawParsed = { data: [], errors: [], columns: ["url", "datetime"] };
    render(<ColumnMapping {...defaultProps} rawParsed={rawParsed} columnMapping={{ datetime: "datetime" }} />);
    const selects = screen.getAllByRole("combobox");
    expect((selects[1] as HTMLSelectElement).value).toBe("datetime");
  });

  test("renders empty string when no mapping", () => {
    const rawParsed = { data: [], errors: [], columns: ["url"] };
    render(<ColumnMapping {...defaultProps} rawParsed={rawParsed} columnMapping={{}} />);
    const selects = screen.getAllByRole("combobox");
    expect((selects[0] as HTMLSelectElement).value).toBe("");
  });

  test("handles columns with special characters", () => {
    const rawParsed = { data: [], errors: [], columns: ["url (path)", "datetime [ISO]"] };
    render(<ColumnMapping {...defaultProps} rawParsed={rawParsed} />);
    const selects = screen.getAllByRole("combobox");
    const options = Array.from(selects[0].querySelectorAll("option"));
    expect(options.map(o => o.textContent)).toContain("url (path)");
  });

  test("handles duplicate column names", () => {
    const rawParsed = { data: [], errors: [], columns: ["url", "url", "datetime"] };
    render(<ColumnMapping {...defaultProps} rawParsed={rawParsed} />);
    const selects = screen.getAllByRole("combobox");
    const options = Array.from(selects[0].querySelectorAll("option"));
    expect(options.filter(o => o.textContent === "url")).toHaveLength(2);
  });

  test("handles columns with unicode characters", () => {
    const rawParsed = { data: [], errors: [], columns: ["url-中文", "datetime-日本語"] };
    render(<ColumnMapping {...defaultProps} rawParsed={rawParsed} />);
    const selects = screen.getAllByRole("combobox");
    const options = Array.from(selects[0].querySelectorAll("option"));
    expect(options.map(o => o.textContent)).toContain("url-中文");
  });

  test("handles columns with spaces and leading/trailing whitespace", () => {
    const rawParsed = { data: [], errors: [], columns: [" url ", " datetime "] };
    render(<ColumnMapping {...defaultProps} rawParsed={rawParsed} />);
    const selects = screen.getAllByRole("combobox");
    const options = Array.from(selects[0].querySelectorAll("option"));
    expect(options.map(o => o.textContent)).toContain(" url ");
  });

  test("handles columns with dots and underscores", () => {
    const rawParsed = { data: [], errors: [], columns: ["url.path", "datetime_value"] };
    render(<ColumnMapping {...defaultProps} rawParsed={rawParsed} />);
    const selects = screen.getAllByRole("combobox");
    const options = Array.from(selects[0].querySelectorAll("option"));
    expect(options.map(o => o.textContent)).toContain("url.path");
  });

  test("rapid changes fire multiple callbacks", () => {
    const rawParsed = { data: [], errors: [], columns: ["url", "datetime"] };
    render(<ColumnMapping {...defaultProps} rawParsed={rawParsed} />);
    const selects = screen.getAllByRole("combobox");
    fireEvent.change(selects[0] as HTMLSelectElement, { target: { value: "url" } });
    fireEvent.change(selects[0] as HTMLSelectElement, { target: { value: "datetime" } });
    expect(defaultProps.onUrlChange).toHaveBeenCalledTimes(2);
  });

  test("renders two select elements", () => {
    const rawParsed = { data: [], errors: [], columns: ["url"] };
    render(<ColumnMapping {...defaultProps} rawParsed={rawParsed} />);
    expect(screen.getAllByRole("combobox")).toHaveLength(2);
  });

  test("handles selection to empty string", () => {
    const rawParsed = { data: [], errors: [], columns: ["url"] };
    render(<ColumnMapping {...defaultProps} rawParsed={rawParsed} columnMapping={{ url: "url" }} />);
    const selects = screen.getAllByRole("combobox");
    fireEvent.change(selects[0] as HTMLSelectElement, { target: { value: "" } });
    expect(defaultProps.onUrlChange).toHaveBeenCalledWith("");
  });

  test("handles very long column names", () => {
    const longName = "a".repeat(100);
    const rawParsed = { data: [], errors: [], columns: [longName] };
    render(<ColumnMapping {...defaultProps} rawParsed={rawParsed} />);
    const selects = screen.getAllByRole("combobox");
    const options = Array.from(selects[0].querySelectorAll("option"));
    expect(options.map(o => o.textContent)).toContain(longName);
  });

  test("renders with complex column names", () => {
    const rawParsed = { data: [], errors: [], columns: ["request.url", "response.datetime"] };
    render(<ColumnMapping {...defaultProps} rawParsed={rawParsed} />);
    const selects = screen.getAllByRole("combobox");
    const options = Array.from(selects[0].querySelectorAll("option"));
    expect(options.map(o => o.textContent)).toContain("request.url");
  });

  test("renders with all props set and hasParsedData true hides warning", () => {
    const rawParsed = { data: [], errors: [], columns: ["url", "datetime"] };
    render(
      <ColumnMapping {...defaultProps} rawParsed={rawParsed} columnMapping={{ url: "url", datetime: "datetime" }} hasParsedData={true} />,
    );
    expect(screen.getByText("Column Mapping")).toBeInTheDocument();
    expect(screen.queryByText(/Select both columns/)).not.toBeInTheDocument();
  });

  test("renders with hasParsedData false shows warning even with full mapping", () => {
    const rawParsed = { data: [], errors: [], columns: ["url", "datetime"] };
    render(
      <ColumnMapping {...defaultProps} rawParsed={rawParsed} columnMapping={{ url: "url", datetime: "datetime" }} hasParsedData={false} />,
    );
    expect(screen.getByText(/Select both columns/)).toBeInTheDocument();
  });

  test("handles rawParsed with many rows but no columns", () => {
    const rawParsed = { data: Array.from({ length: 1000 }, () => ({})), errors: [], columns: [] };
    render(<ColumnMapping {...defaultProps} rawParsed={rawParsed} />);
    expect(screen.getByText("Column Mapping")).toBeInTheDocument();
  });

  test("handles rapid changes to both selects", () => {
    const rawParsed = { data: [], errors: [], columns: ["url", "datetime"] };
    render(<ColumnMapping {...defaultProps} rawParsed={rawParsed} />);
    const selects = screen.getAllByRole("combobox");
    fireEvent.change(selects[0] as HTMLSelectElement, { target: { value: "url" } });
    fireEvent.change(selects[1] as HTMLSelectElement, { target: { value: "datetime" } });
    expect(defaultProps.onUrlChange).toHaveBeenCalledWith("url");
    expect(defaultProps.onDatetimeChange).toHaveBeenCalledWith("datetime");
  });
});
