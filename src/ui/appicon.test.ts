import { test, expect, describe } from "bun:test";
import { readdirSync, statSync } from "node:fs";

describe("Mac app icon", () => {
  const required = [
    "icon_16x16.png",
    "icon_16x16@2x.png",
    "icon_32x32.png",
    "icon_32x32@2x.png",
    "icon_128x128.png",
    "icon_128x128@2x.png",
    "icon_256x256.png",
    "icon_256x256@2x.png",
    "icon_512x512.png",
    "icon_512x512@2x.png",
  ];

  test("icon.iconset contains all 10 iconutil-required sizes", () => {
    const files = readdirSync("icon.iconset");
    for (const name of required) {
      expect(files).toContain(name);
      expect(statSync(`icon.iconset/${name}`).size).toBeGreaterThan(0);
    }
  });

  test("electrobun config points mac build at icon.iconset", async () => {
    const cfg = (await import("../../electrobun.config.ts")).default;
    expect(cfg.build?.mac?.icons).toBe("icon.iconset");
  });
});