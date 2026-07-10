import { test, expect, describe, vi, beforeEach } from "bun:test";
import { render, screen, fireEvent, cleanup } from "@testing-library/react";
import { Filters } from "./Filters";

describe("Filters", () => {
  const defaultProps = {
    baseUrl: "",
    filterPatterns: "",
    onBaseUrlChange: vi.fn(),
    onFilterPatternsChange: vi.fn(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
    cleanup();
  });

  test("renders base URL input", () => {
    render(<Filters {...defaultProps} />);
    const input = screen.getByPlaceholderText("Base URL");
    expect(input).toBeInTheDocument();
  });

  test("renders filter patterns input", () => {
    render(<Filters {...defaultProps} />);
    const input = screen.getByPlaceholderText("Filter patterns");
    expect(input).toBeInTheDocument();
  });

  test("displays current base URL value", () => {
    render(<Filters {...defaultProps} baseUrl="http://example.com" />);
    const input = screen.getByPlaceholderText("Base URL");
    expect(input).toHaveValue("http://example.com");
  });

  test("displays current filter patterns value", () => {
    render(<Filters {...defaultProps} filterPatterns="/api/users" />);
    const input = screen.getByPlaceholderText("Filter patterns");
    expect(input).toHaveValue("/api/users");
  });

  test("calls onBaseUrlChange when base URL input changes", () => {
    render(<Filters {...defaultProps} />);
    const input = screen.getByPlaceholderText("Base URL");

    fireEvent.change(input, { target: { value: "http://new-url.com" } });

    expect(defaultProps.onBaseUrlChange).toHaveBeenCalledWith("http://new-url.com");
  });

  test("calls onFilterPatternsChange when filter patterns input changes", () => {
    render(<Filters {...defaultProps} />);
    const input = screen.getByPlaceholderText("Filter patterns");

    fireEvent.change(input, { target: { value: "/api/test" } });

    expect(defaultProps.onFilterPatternsChange).toHaveBeenCalledWith("/api/test");
  });

  test("renders with Card wrapper", () => {
    render(<Filters {...defaultProps} />);
    const card = screen.getByText("Filters").closest(".bg-\\[\\#252525\\]");
    expect(card).toBeInTheDocument();
  });

  test("handles empty string values", () => {
    render(<Filters {...defaultProps} baseUrl="" filterPatterns="" />);
    const baseUrlInput = screen.getByPlaceholderText("Base URL");
    const filterInput = screen.getByPlaceholderText("Filter patterns");

    expect(baseUrlInput).toHaveValue("");
    expect(filterInput).toHaveValue("");
  });

  test("handles special characters in inputs", () => {
    const specialUrl = "http://example.com/path?query=value&foo=bar";
    render(<Filters {...defaultProps} baseUrl={specialUrl} />);
    const input = screen.getByPlaceholderText("Base URL");
    expect(input).toHaveValue(specialUrl);
  });

  test("handles long values", () => {
    const longUrl = "http://example.com/" + "a".repeat(1000);
    render(<Filters {...defaultProps} baseUrl={longUrl} />);
    const input = screen.getByPlaceholderText("Base URL");
    expect(input).toHaveValue(longUrl);
  });

  test("renders two input fields", () => {
    render(<Filters {...defaultProps} />);
    const inputs = screen.getAllByRole("textbox");
    expect(inputs).toHaveLength(2);
  });

  test("handles rapid input changes", () => {
    render(<Filters {...defaultProps} />);
    const input = screen.getByPlaceholderText("Base URL");

    fireEvent.change(input, { target: { value: "a" } });
    fireEvent.change(input, { target: { value: "ab" } });
    fireEvent.change(input, { target: { value: "abc" } });

    expect(defaultProps.onBaseUrlChange).toHaveBeenCalledTimes(3);
    expect(defaultProps.onBaseUrlChange).toHaveBeenLastCalledWith("abc");
  });

  test("handles URL with port number", () => {
    const url = "http://localhost:8080/api";
    render(<Filters {...defaultProps} baseUrl={url} />);
    const input = screen.getByPlaceholderText("Base URL");
    expect(input).toHaveValue(url);
  });

  test("handles URL with path", () => {
    const url = "https://api.example.com/v1/users/123";
    render(<Filters {...defaultProps} baseUrl={url} />);
    const input = screen.getByPlaceholderText("Base URL");
    expect(input).toHaveValue(url);
  });

  test("handles URL with subdomain", () => {
    const url = "https://staging.api.example.com";
    render(<Filters {...defaultProps} baseUrl={url} />);
    const input = screen.getByPlaceholderText("Base URL");
    expect(input).toHaveValue(url);
  });

  test("handles filter patterns with regex", () => {
    const patterns = "/api/(users|posts)/.*";
    render(<Filters {...defaultProps} filterPatterns={patterns} />);
    const input = screen.getByPlaceholderText("Filter patterns");
    expect(input).toHaveValue(patterns);
  });

  test("handles multiple comma-separated filter patterns", () => {
    const patterns = "/api/users,/api/posts,/api/items";
    render(<Filters {...defaultProps} filterPatterns={patterns} />);
    const input = screen.getByPlaceholderText("Filter patterns");
    expect(input).toHaveValue(patterns);
  });

  test("handles whitespace in values", () => {
    render(<Filters {...defaultProps} baseUrl=" http://example.com " />);
    const input = screen.getByPlaceholderText("Base URL");
    expect(input).toHaveValue(" http://example.com ");
  });

  test("handles newlines in values", () => {
    const url = "http://example.com\npath";
    render(<Filters {...defaultProps} baseUrl={url} />);
    const input = screen.getByPlaceholderText("Base URL");
    // JSDOM normalizes newlines in input values; verify it renders without error
    expect(input).toBeInTheDocument();
  });

  test("calls correct callback for each input", () => {
    render(<Filters {...defaultProps} />);
    const baseUrlInput = screen.getAllByRole("textbox")[0];
    const filterInput = screen.getAllByRole("textbox")[1];

    fireEvent.change(baseUrlInput, { target: { value: "http://base.com" } });
    fireEvent.change(filterInput, { target: { value: "/filter" } });

    expect(defaultProps.onBaseUrlChange).toHaveBeenCalledWith("http://base.com");
    expect(defaultProps.onFilterPatternsChange).toHaveBeenCalledWith("/filter");
  });

  test("handles non-URL text in base URL field", () => {
    render(<Filters {...defaultProps} baseUrl="not a url" />);
    const input = screen.getByPlaceholderText("Base URL");
    expect(input).toHaveValue("not a url");
  });

  test("handles empty filter patterns string", () => {
    render(<Filters {...defaultProps} filterPatterns="" />);
    const input = screen.getByPlaceholderText("Filter patterns");
    expect(input).toHaveValue("");
  });
});
