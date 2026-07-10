import { test, expect, describe, vi, beforeEach } from "bun:test";
import { render, screen, fireEvent, cleanup } from "@testing-library/react";
import { DurationControls } from "./DurationControls";

describe("DurationControls", () => {
  const defaultProps = {
    speed: 1.0,
    durationEnabled: false,
    durationValue: 100,
    durationUnit: "seconds" as const,
    actualDurationMs: 0,
    onSpeedChange: vi.fn(),
    onDurationEnabledChange: vi.fn(),
    onDurationValueChange: vi.fn(),
    onDurationUnitChange: vi.fn(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
    cleanup();
  });

  test("renders Speed label", () => {
    render(<DurationControls {...defaultProps} />);
    expect(screen.getByText("Speed")).toBeInTheDocument();
  });

  test("renders Override Duration checkbox label", () => {
    render(<DurationControls {...defaultProps} />);
    expect(screen.getByText("Override Duration")).toBeInTheDocument();
  });

  test("renders speed slider input", () => {
    render(<DurationControls {...defaultProps} />);
    const slider = document.querySelector('input[type="range"]') as HTMLInputElement;
    expect(slider).toBeInTheDocument();
    expect(slider.value).toBe("1");
  });

  test("renders duration value number input", () => {
    render(<DurationControls {...defaultProps} />);
    const numberInput = document.querySelector('input[type="number"]') as HTMLInputElement;
    expect(numberInput).toBeInTheDocument();
    expect(numberInput.value).toBe("100");
  });

  test("renders duration unit select", () => {
    render(<DurationControls {...defaultProps} />);
    const select = document.querySelector('select') as HTMLSelectElement;
    expect(select).toBeInTheDocument();
    expect(select.value).toBe("seconds");
  });

  test("calls onSpeedChange when slider changes", () => {
    render(<DurationControls {...defaultProps} />);
    const slider = document.querySelector('input[type="range"]') as HTMLInputElement;
    fireEvent.change(slider, { target: { value: "2" } });
    expect(defaultProps.onSpeedChange).toHaveBeenCalled();
  });

  test("calls onDurationEnabledChange when checkbox changes", () => {
    render(<DurationControls {...defaultProps} />);
    const checkbox = document.querySelector('input[type="checkbox"]') as HTMLInputElement;
    fireEvent.click(checkbox);
    expect(defaultProps.onDurationEnabledChange).toHaveBeenCalledWith(true);
  });

  test("calls onDurationValueChange when number input changes", () => {
    render(<DurationControls {...defaultProps} />);
    const numberInput = document.querySelector('input[type="number"]') as HTMLInputElement;
    fireEvent.change(numberInput, { target: { value: "200" } });
    expect(defaultProps.onDurationValueChange).toHaveBeenCalled();
  });

  test("calls onDurationUnitChange when select changes", () => {
    render(<DurationControls {...defaultProps} />);
    const select = document.querySelector('select') as HTMLSelectElement;
    fireEvent.change(select, { target: { value: "minutes" } });
    expect(defaultProps.onDurationUnitChange).toHaveBeenCalled();
  });

  test("checkbox is unchecked when durationEnabled is false", () => {
    render(<DurationControls {...defaultProps} durationEnabled={false} />);
    const checkbox = document.querySelector('input[type="checkbox"]') as HTMLInputElement;
    expect(checkbox.checked).toBe(false);
  });

  test("checkbox is checked when durationEnabled is true", () => {
    render(<DurationControls {...defaultProps} durationEnabled={true} />);
    const checkbox = document.querySelector('input[type="checkbox"]') as HTMLInputElement;
    expect(checkbox.checked).toBe(true);
  });

  test("number input is disabled when durationEnabled is false", () => {
    render(<DurationControls {...defaultProps} durationEnabled={false} />);
    const numberInput = document.querySelector('input[type="number"]') as HTMLInputElement;
    expect(numberInput.disabled).toBe(true);
  });

  test("number input is enabled when durationEnabled is true", () => {
    render(<DurationControls {...defaultProps} durationEnabled={true} />);
    const numberInput = document.querySelector('input[type="number"]') as HTMLInputElement;
    expect(numberInput.disabled).toBe(false);
  });

  test("select is disabled when durationEnabled is false", () => {
    render(<DurationControls {...defaultProps} durationEnabled={false} />);
    const select = document.querySelector('select') as HTMLSelectElement;
    expect(select.disabled).toBe(true);
  });

  test("select is enabled when durationEnabled is true", () => {
    render(<DurationControls {...defaultProps} durationEnabled={true} />);
    const select = document.querySelector('select') as HTMLSelectElement;
    expect(select.disabled).toBe(false);
  });

  test("displays CSV span and speed when actualDurationMs > 0", () => {
    render(<DurationControls {...defaultProps} actualDurationMs={30000} />);
    expect(screen.getByText(/CSV span: 30s/)).toBeInTheDocument();
    expect(screen.getByText(/Speed: 1\.0x/)).toBeInTheDocument();
  });

  test("does not display CSV span when actualDurationMs is 0", () => {
    const { container } = render(<DurationControls {...defaultProps} actualDurationMs={0} />);
    expect(container.querySelector(".text-\\[10px\\].text-gray-400")).not.toBeInTheDocument();
  });

  test("formats duration correctly for seconds", () => {
    render(<DurationControls {...defaultProps} actualDurationMs={45000} />);
    expect(screen.getByText(/45s/)).toBeInTheDocument();
  });

  test("formats duration correctly for minutes", () => {
    render(<DurationControls {...defaultProps} actualDurationMs={90000} />);
    expect(screen.getByText(/1m 30s/)).toBeInTheDocument();
  });

  test("formats duration correctly for hours", () => {
    render(<DurationControls {...defaultProps} actualDurationMs={3900000} />);
    expect(screen.getByText(/1h 5m/)).toBeInTheDocument();
  });

  test("renders with Card wrapper", () => {
    render(<DurationControls {...defaultProps} />);
    const card = screen.getByText("Replay Configuration").closest(".bg-\\[\\#252525\\]");
    expect(card).toBeInTheDocument();
  });

  test("handles speed at minimum value", () => {
    render(<DurationControls {...defaultProps} speed={0.1} />);
    const slider = document.querySelector('input[type="range"]') as HTMLInputElement;
    expect(slider.value).toBe("0.1");
  });

  test("handles speed at maximum value", () => {
    render(<DurationControls {...defaultProps} speed={3} />);
    const slider = document.querySelector('input[type="range"]') as HTMLInputElement;
    expect(slider.value).toBe("3");
  });

  test("handles duration value of 0", () => {
    render(<DurationControls {...defaultProps} durationValue={0} />);
    const numberInput = document.querySelector('input[type="number"]') as HTMLInputElement;
    expect(numberInput.value).toBe("0");
  });

  test("handles large duration value", () => {
    render(<DurationControls {...defaultProps} durationValue={999999} />);
    const numberInput = document.querySelector('input[type="number"]') as HTMLInputElement;
    expect(numberInput.value).toBe("999999");
  });

  test("handles minutes unit", () => {
    render(<DurationControls {...defaultProps} durationUnit="minutes" />);
    const select = document.querySelector('select') as HTMLSelectElement;
    expect(select.value).toBe("minutes");
  });

  test("handles hours unit", () => {
    render(<DurationControls {...defaultProps} durationUnit="hours" />);
    const select = document.querySelector('select') as HTMLSelectElement;
    expect(select.value).toBe("hours");
  });

  test("renders all three unit options", () => {
    render(<DurationControls {...defaultProps} />);
    const select = screen.getByRole("combobox") as HTMLSelectElement;
    expect(select.options[0].value).toBe("seconds");
    expect(select.options[1].value).toBe("minutes");
    expect(select.options[2].value).toBe("hours");
  });

  test("handles fractional speed values", () => {
    render(<DurationControls {...defaultProps} speed={1.5} />);
    const slider = document.querySelector('input[type="range"]') as HTMLInputElement;
    expect(slider.value).toBe("1.5");
  });

  test("handles negative actualDurationMs gracefully", () => {
    render(<DurationControls {...defaultProps} actualDurationMs={-1000} />);
    // Should not display CSV span info for negative values
    const infoText = screen.queryByText(/CSV span:/);
    expect(infoText).not.toBeInTheDocument();
  });

  test("handles very large actualDurationMs", () => {
    render(<DurationControls {...defaultProps} actualDurationMs={86400000} />);
    expect(screen.getByText(/24h 0m/)).toBeInTheDocument();
  });

  test("rapid slider changes fire multiple callbacks", () => {
    render(<DurationControls {...defaultProps} />);
    const slider = document.querySelector('input[type="range"]') as HTMLInputElement;
    fireEvent.change(slider, { target: { value: "1.5" } });
    fireEvent.change(slider, { target: { value: "2.0" } });
    fireEvent.change(slider, { target: { value: "2.5" } });
    expect(defaultProps.onSpeedChange).toHaveBeenCalledTimes(3);
  });

  test("rapid checkbox toggles fire multiple callbacks", () => {
    render(<DurationControls {...defaultProps} />);
    const checkbox = document.querySelector('input[type="checkbox"]') as HTMLInputElement;
    fireEvent.click(checkbox);
    fireEvent.click(checkbox);
    expect(defaultProps.onDurationEnabledChange).toHaveBeenCalledTimes(2);
  });

  test("rapid number input changes fire multiple callbacks", () => {
    render(<DurationControls {...defaultProps} durationEnabled={true} durationValue={200} />);
    let numberInput = document.querySelector('input[type="number"]') as HTMLInputElement;
    fireEvent.change(numberInput, { target: { value: "50" } });
    expect(defaultProps.onDurationValueChange).toHaveBeenCalledTimes(1);
    numberInput = document.querySelector('input[type="number"]') as HTMLInputElement;
    fireEvent.change(numberInput, { target: { value: "150" } });
    expect(defaultProps.onDurationValueChange).toHaveBeenCalledTimes(2);
  });

  test("rapid unit select changes fire multiple callbacks", () => {
    render(<DurationControls {...defaultProps} />);
    const select = document.querySelector('select') as HTMLSelectElement;
    fireEvent.change(select, { target: { value: "minutes" } });
    fireEvent.change(select, { target: { value: "hours" } });
    expect(defaultProps.onDurationUnitChange).toHaveBeenCalledTimes(2);
  });

  test("handles all unit values", () => {
    const units = ["seconds", "minutes", "hours"] as const;
    for (const unit of units) {
      const { unmount } = render(<DurationControls {...defaultProps} durationUnit={unit} />);
      const select = document.querySelector('select') as HTMLSelectElement;
      expect(select.value).toBe(unit);
      unmount();
    }
  });

  test("handles speed at exact boundary values", () => {
    render(<DurationControls {...defaultProps} speed={0.1} />);
    const slider = document.querySelector('input[type="range"]') as HTMLInputElement;
    expect(slider.min).toBe("0.1");
    expect(slider.max).toBe("3");
    expect(slider.step).toBe("0.1");
  });

  test("renders with actualDurationMs of exactly 1000ms", () => {
    render(<DurationControls {...defaultProps} actualDurationMs={1000} />);
    expect(screen.getByText(/1s/)).toBeInTheDocument();
  });

  test("renders with actualDurationMs of exactly 60000ms", () => {
    render(<DurationControls {...defaultProps} actualDurationMs={60000} />);
    expect(screen.getByText(/1m 0s/)).toBeInTheDocument();
  });

  test("renders with actualDurationMs of exactly 3600000ms", () => {
    render(<DurationControls {...defaultProps} actualDurationMs={3600000} />);
    expect(screen.getByText(/1h 0m/)).toBeInTheDocument();
  });

  test("handles speed with many decimal places", () => {
    render(<DurationControls {...defaultProps} speed={1.123456} />);
    const slider = document.querySelector('input[type="range"]') as HTMLInputElement;
    expect(slider.value).toBe("1.123456");
  });

  test("handles duration value with many digits", () => {
    render(<DurationControls {...defaultProps} durationValue={123456789} />);
    const numberInput = document.querySelector('input[type="number"]') as HTMLInputElement;
    expect(numberInput.value).toBe("123456789");
  });

  test("renders with checkbox checked and duration inputs enabled", () => {
    render(<DurationControls {...defaultProps} durationEnabled={true} durationValue={50} durationUnit="minutes" />);
    const checkbox = document.querySelector('input[type="checkbox"]') as HTMLInputElement;
    const numberInput = document.querySelector('input[type="number"]') as HTMLInputElement;
    const select = document.querySelector('select') as HTMLSelectElement;
    expect(checkbox.checked).toBe(true);
    expect(numberInput.disabled).toBe(false);
    expect(select.disabled).toBe(false);
    expect(numberInput.value).toBe("50");
    expect(select.value).toBe("minutes");
  });

  test("renders with checkbox unchecked and duration inputs disabled", () => {
    render(<DurationControls {...defaultProps} durationEnabled={false} />);
    const checkbox = document.querySelector('input[type="checkbox"]') as HTMLInputElement;
    const numberInput = document.querySelector('input[type="number"]') as HTMLInputElement;
    const select = document.querySelector('select') as HTMLSelectElement;
    expect(checkbox.checked).toBe(false);
    expect(numberInput.disabled).toBe(true);
    expect(select.disabled).toBe(true);
  });

  test("handles actualDurationMs with fractional seconds", () => {
    render(<DurationControls {...defaultProps} actualDurationMs={1500} />);
    // Should show 1s (rounds down)
    expect(screen.getByText(/1s/)).toBeInTheDocument();
  });

  test("handles speed exactly at 1.0", () => {
    render(<DurationControls {...defaultProps} speed={1.0} actualDurationMs={1000} />);
    expect(screen.getByText(/Speed: 1\.0x/)).toBeInTheDocument();
  });

  test("handles speed with one decimal place", () => {
    render(<DurationControls {...defaultProps} speed={2.3} actualDurationMs={1000} />);
    expect(screen.getByText(/Speed: 2\.3x/)).toBeInTheDocument();
  });

  test("handles speed with two decimal places", () => {
    render(<DurationControls {...defaultProps} speed={1.25} actualDurationMs={1000} />);
    const p = document.querySelector("p.text-\\[10px\\].text-gray-400") as HTMLParagraphElement;
    expect(p.textContent).toContain("1.3x");
  });
});
