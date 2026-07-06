# ReFling Test Suite

This project includes two types of tests:

## 1. Unit Tests (Bun Test)

Fast unit tests for the core engine and CSV parser.

```bash
bun test
# or
bun run test
```

**Location:** `src/tests/`

**Coverage:**
- CSV Parser: Parsing, column mapping, error handling, Unix timestamps, memory limits
- Replay Engine: State management, timing calculations, URL filtering, base URL resolution, histogram building, start/pause/resume/cancel, network behavior

## 2. E2E Tests (Playwright)

End-to-end tests for the UI using Playwright with Chromium.

```bash
# Run all E2E tests (headless)
bun run test:e2e

# Run with visible browser window
bun run test:e2e:headed
```

**Location:** `tests/e2e/`

**Coverage:**
- App loads and displays title
- File input for CSV upload
- Replay configuration section appears after file load
- Speed, duration, and iterations inputs present
- Base URL and filter patterns inputs present
- Start, pause, resume, and stop buttons present
- Progress section appears when replay starts
- Loaded data count displayed
- Histogram section appears after replay starts

## Setup

Playwright browsers are installed automatically on first run. If you need to reinstall:

```bash
npx playwright install chromium
```

## Configuration

- **Playwright config:** `playwright.config.ts`
- **Electrobun remote debugging:** Enabled via `chromiumFlags.remote-debugging-port: "9333"` in `electrobun.config.ts`
- **Vite dev server:** Runs on port 5173 for E2E tests

## Notes

- Unit tests use Bun's built-in test runner
- E2E tests use Playwright and launch a Vite dev server automatically
- The `.e2e.spec.ts` extension is used for Playwright tests to avoid conflicts with Bun's test runner (which looks for `.test.ts` files)
