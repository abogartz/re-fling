import { test, expect, describe } from "bun:test";
import { parseCSV, ColumnMapping } from "../../csv/parser";

describe("CSV Parser", () => {
  test("should parse basic CSV with datetime and url columns", () => {
    const csv = `datetime,url
2024-01-01T10:00:00Z,/api/users
2024-01-01T10:00:05Z,/api/posts`;

    const result = parseCSV(csv);

    expect(result.data).toHaveLength(2);
    expect(result.data[0].datetime).toEqual(new Date("2024-01-01T10:00:00Z"));
    expect(result.data[0].url).toBe("/api/users");
    expect(result.data[1].datetime).toEqual(new Date("2024-01-01T10:00:05Z"));
    expect(result.data[1].url).toBe("/api/posts");
  });

  test("should handle column mapping", () => {
    const csv = `timestamp,weburl
2024-01-01T10:00:00Z,/api/users
2024-01-01T10:00:05Z,/api/posts`;

    const mapping: ColumnMapping = {
      datetime: "timestamp",
      url: "weburl",
    };

    const result = parseCSV(csv, mapping);

    expect(result.data).toHaveLength(2);
    expect(result.data[0].url).toBe("/api/users");
  });

  test("should skip invalid rows and report errors", () => {
    const csv = `datetime,url
2024-01-01T10:00:00Z,/api/users
invalid-timestamp,/api/posts
2024-01-01T10:00:10Z,/api/items`;

    const result = parseCSV(csv);

    expect(result.errors).toHaveLength(1);
    expect(result.errors[0].row).toBe(3);
    expect(result.data).toHaveLength(2);
  });

  test("should handle Unix timestamps", () => {
    const csv = `datetime,url
1704067200000,/api/users`;

    const result = parseCSV(csv);

    expect(result.data).toHaveLength(1);
    expect(result.data[0].datetime.getTime()).toBe(1704067200000);
  });

  test("should respect max memory limit", () => {
    const csv = `datetime,url
2024-01-01T10:00:00Z,/api/users
2024-01-01T10:00:01Z,/api/posts`;

    // Set a very low memory limit (1 byte) to trigger the check
    const result = parseCSV(csv, undefined, 1);

    expect(result.data).toHaveLength(0);
    expect(result.errors).toHaveLength(1);
    expect(result.errors[0].message).toContain("memory limit");
  });
});
