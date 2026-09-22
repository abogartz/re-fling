/**
 * Type augmentation for the jest-dom matchers that tests/setup.ts extends
 * into bun:test at runtime (import "@testing-library/jest-dom").
 */
declare module "bun:test" {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  interface Matchers<T = unknown> {
    toBeInTheDocument(): void;
    toBeDisabled(): void;
    toHaveValue(value: string | number | string[] | number[] | null): void;
    toHaveAttribute(attr: string, value?: string): void;
    toHaveClass(...classNames: string[]): void;
  }
}