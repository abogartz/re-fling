import { test, expect, describe, afterEach } from "bun:test";
import { render, screen, cleanup } from "@testing-library/react";
import { Card } from "./Card";

describe("Card", () => {
  afterEach(() => {
    cleanup();
  });
  test("renders title", () => {
    render(<Card title="Test Title">Content</Card>);
    expect(screen.getByText("Test Title")).toBeInTheDocument();
  });

  test("renders children", () => {
    render(<Card title="Title">Child Content</Card>);
    expect(screen.getByText("Child Content")).toBeInTheDocument();
  });

  test("applies custom className", () => {
    const { container } = render(
      <Card title="Title" className="custom-class">
        Content
      </Card>,
    );
    expect(container.firstChild).toHaveClass("custom-class");
  });

  test("renders with no children", () => {
    const { container } = render(<Card title="Empty Card" />);
    expect(screen.getByText("Empty Card")).toBeInTheDocument();
    expect(container.querySelector(".bg-\\[\\#252525\\]")).toBeInTheDocument();
  });

  test("passes through HTML attributes", () => {
    const { container } = render(
      <Card title="Title" data-testid="test-card">
        Content
      </Card>,
    );
    expect(container.firstChild).toHaveAttribute("data-testid", "test-card");
  });

  test("applies default styling", () => {
    const { container } = render(<Card title="Title">Content</Card>);
    const card = container.firstChild as HTMLElement;
    expect(card.className).toContain("bg-[#252525]");
    expect(card.className).toContain("rounded-lg");
    expect(card.className).toContain("border");
    expect(card.className).toContain("p-2");
  });

  test("renders h2 for title", () => {
    render(<Card title="Title">Content</Card>);
    const heading = screen.getByRole("heading", { level: 2 });
    expect(heading).toBeInTheDocument();
    expect(heading.textContent).toBe("Title");
  });

  test("handles empty string title", () => {
    const { container } = render(<Card title="">Content</Card>);
    const heading = container.querySelector("h2");
    expect(heading).toBeInTheDocument();
    expect(heading?.textContent).toBe("");
  });

  test("renders complex children", () => {
    render(
      <Card title="Complex">
        <div>
          <p>Paragraph</p>
          <span>Span</span>
        </div>
      </Card>,
    );
    expect(screen.getByText("Paragraph")).toBeInTheDocument();
    expect(screen.getByText("Span")).toBeInTheDocument();
  });

  test("renders null children gracefully", () => {
    const { container } = render(<Card title="Title">{null}</Card>);
    expect(screen.getByText("Title")).toBeInTheDocument();
    // Should not crash
    expect(container.firstChild).toBeInTheDocument();
  });

  test("renders undefined children gracefully", () => {
    const { container } = render(<Card title="Title">{undefined}</Card>);
    expect(screen.getByText("Title")).toBeInTheDocument();
    expect(container.firstChild).toBeInTheDocument();
  });
});
