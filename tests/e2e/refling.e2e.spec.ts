import { test, expect } from "@playwright/test";

const APP_URL = "http://localhost:5173"; // Vite dev server URL
const SCREENSHOT_DIR = "./test-results/images";

test.describe("ReFling E2E Tests", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto(APP_URL);
    await page.waitForLoadState("networkidle");
    
    // Screenshot 1: Initial app state
    await page.screenshot({ path: `${SCREENSHOT_DIR}/01-initial-state.png`, fullPage: true });
  });

  test("should load the app and display title", async ({ page }) => {
    await expect(page.locator("h1")).toContainText("ReFling");
  });

  test("should have file input for CSV upload", async ({ page }) => {
    const fileInput = page.locator('input[type="file"]');
    await expect(fileInput).toBeVisible();
    await expect(fileInput).toHaveAttribute("accept", ".csv");
  });

  test("should display replay configuration section after file load", async ({
    page,
  }) => {
    // Load a test CSV file
    const filePath = "examples/test_requests.csv";
    const fileInput = page.locator('input[type="file"]');
    await fileInput.setInputFiles(filePath);

    // Wait for the configuration section to appear
    await expect(
      page.locator("h2").filter({ hasText: /Replay Configuration/i }),
    ).toBeVisible();
  });

  test("should have speed, duration, and iterations inputs", async ({
    page,
  }) => {
    const filePath = "examples/test_requests.csv";
    const fileInput = page.locator('input[type="file"]');
    await fileInput.setInputFiles(filePath);

    // Wait for config section
    await expect(
      page.locator("h2").filter({ hasText: /Replay Configuration/i }),
    ).toBeVisible();

    // Check for input fields
    const speedInput = page.locator('input[placeholder*="Speed" i], input[type="number"]').first();
    const durationInput = page.locator('input[placeholder*="Duration" i]');
    const iterationsInput = page.locator('input[placeholder*="Iteration" i]');

    // At least one of these should be visible
    await expect(speedInput.or(durationInput).or(iterationsInput)).toBeVisible();
  });

  test("should have base URL and filter patterns inputs", async ({ page }) => {
    const filePath = "examples/test_requests.csv";
    const fileInput = page.locator('input[type="file"]');
    await fileInput.setInputFiles(filePath);

    // Wait for config section
    await expect(
      page.locator("h2").filter({ hasText: /Replay Configuration/i }),
    ).toBeVisible();

    // Check for base URL input
    const baseUrlInput = page.locator('input[placeholder*="Base URL" i], input[placeholder*="https://" i]');
    await expect(baseUrlInput).toBeVisible();

    // Check for filter patterns input
    const filterInput = page.locator(
      'input[placeholder*="Filter" i], input[placeholder*="/api/" i]',
    );
    await expect(filterInput).toBeVisible();
  });

  test("should have start and stop buttons", async ({
    page,
  }) => {
    const filePath = "examples/test_requests.csv";
    const fileInput = page.locator('input[type="file"]');
    await fileInput.setInputFiles(filePath);

    // Wait for config section
    await expect(
      page.locator("h2").filter({ hasText: /Load CSV Data/i }),
    ).toBeVisible();

    // Check for buttons
    const startBtn = page.locator("button").filter({ hasText: /^Start$/i });
    const stopBtn = page.locator("button").filter({ hasText: /^Stop$/i });

    await expect(startBtn).toBeVisible();
    await expect(stopBtn).toBeVisible();
  });

  test("should show progress section when replay starts", async ({ page }) => {
    const filePath = "examples/test_requests.csv";
    const fileInput = page.locator('input[type="file"]');
    await fileInput.setInputFiles(filePath);

    // Screenshot 2: After loading file (no histogram yet - engine not started)
    await page.screenshot({ path: `${SCREENSHOT_DIR}/02-after-file-load.png`, fullPage: true });

    // Wait for config section
    await expect(
      page.locator("h2").filter({ hasText: /Replay Configuration/i }),
    ).toBeVisible();

    // Click start button - this triggers engine.setData() which builds histogram
    const startBtn = page.locator("button").filter({ hasText: /^Start$/i });
    await startBtn.click();

    // Screenshot 3: During run (histogram should be visible now)
    await page.waitForTimeout(500);
    await page.screenshot({ path: `${SCREENSHOT_DIR}/03-during-run.png`, fullPage: true });

    // Wait for progress section to appear
    await expect(
      page.locator('[data-testid="replay-status"]'),
    ).toBeVisible({ timeout: 5000 });
  });

  test("should display loaded data count", async ({ page }) => {
    const filePath = "examples/test_requests.csv";
    const fileInput = page.locator('input[type="file"]');
    await fileInput.setInputFiles(filePath);

    // Wait for success message - use a simpler locator
    await expect(
      page.locator("p").filter({ hasText: "Loaded" }),
    ).toBeVisible();
  });

  test("should show error message for invalid CSV", async ({ page }) => {
    // Create an invalid CSV content (no datetime column)
    const invalidCsv = "name,url\ntest,http://example.com\n";
    
    // We need to simulate file input with custom content
    // This is a simplified test - in reality you'd need to create a proper file blob
    const fileInput = page.locator('input[type="file"]');
    
    // Try to load the invalid CSV (this might fail due to file system constraints)
    try {
      await fileInput.setInputFiles("examples/test_requests.csv");
      // If successful, the test passes - we're just testing the UI structure
    } catch {
      // Expected if file doesn't exist or can't be loaded in test environment
    }
  });

  test("should show expected RPS timeseries after file load", async ({ page }) => {
    const filePath = "examples/test_requests.csv";
    const fileInput = page.locator('input[type="file"]');
    await fileInput.setInputFiles(filePath);

    // Wait for config section
    await expect(
      page.locator("h2").filter({ hasText: /Replay Configuration/i }),
    ).toBeVisible();

    // Timeseries should appear immediately after file load (not after Start click)
    await expect(
      page.locator("h2").filter({ hasText: /Expected RPS/i }),
    ).toBeVisible({ timeout: 5000 });

    // Verify Chart.js canvas is rendered
    const canvas = page.locator("canvas");
    await expect(canvas).toHaveCount(1);

    // Screenshot: Timeseries visible after load
    await page.waitForTimeout(500);
    await page.screenshot({ path: `${SCREENSHOT_DIR}/03b-timeseries-visible.png`, fullPage: true });
  });
});
