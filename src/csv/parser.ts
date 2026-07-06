export interface ParsedCSV {
  data: Array<{
    datetime: Date;
    url: string;
    [key: string]: string | Date;
  }>;
  errors: Array<{
    row: number;
    message: string;
  }>;
  columns: string[];
}

export type ColumnMapping = {
  [expected: string]: string;
};

const MAX_FILE_SIZE = 1024 * 1024 * 1024; // 1GB in bytes

export function parseCSV(
  csv: string,
  mapping?: ColumnMapping,
  maxSize?: number,
): ParsedCSV {
  const errors: ParsedCSV["errors"] = [];
  const data: ParsedCSV["data"] = [];

  // Check file size if maxSize provided
  if (maxSize !== undefined && csv.length > maxSize) {
    errors.push({
      row: 0,
      message: `File size (${csv.length} bytes) exceeds memory limit (${maxSize} bytes). Max supported file size is 1GB.`,
    });
    return { data, errors, columns: [] };
  }

  const lines = csv.split("\n").filter((line) => line.trim());
  if (lines.length === 0) {
    return { data, errors, columns: [] };
  }

  const headerLine = lines[0];
  const headers = headerLine.split(",").map((h) => h.trim());
  const columns = headers;

  // Process each data row
  for (let i = 1; i < lines.length; i++) {
    const line = lines[i];
    const values = line.split(",").map((v) => v.trim());

    if (values.length !== headers.length) {
      errors.push({
        row: i + 1,
        message: `Row has ${values.length} columns, expected ${headers.length}`,
      });
      continue;
    }

    try {
      // Create a mapping object to map actual column names to expected names
      const mappedValues: Record<string, string> = {};
      for (let j = 0; j < headers.length; j++) {
        const header = headers[j].toLowerCase();
        // Check if this header maps to an expected field
        let expectedName = header;
        for (const [expected, actual] of Object.entries(mapping || {})) {
          if (actual.toLowerCase() === header) {
            expectedName = expected;
            break;
          }
        }
        mappedValues[expectedName] = values[j];
      }

      // Parse datetime
      let datetime: Date;
      const datetimeStr = mappedValues["datetime"];
      if (!datetimeStr) {
        throw new Error("Missing datetime column");
      }

      // Try to parse as Unix timestamp (number)
      if (/^\d+$/.test(datetimeStr)) {
        datetime = new Date(parseInt(datetimeStr, 10));
      } else {
        datetime = new Date(datetimeStr);
      }

      if (isNaN(datetime.getTime())) {
        throw new Error(`Invalid datetime: ${datetimeStr}`);
      }

      // Parse URL
      const url = mappedValues["url"] || "";

      // Create the row object with all mapped values
      const row: Record<string, string | Date> = {
        datetime,
        url,
      };

      // Add any additional columns
      for (const key of Object.keys(mappedValues)) {
        if (key !== "datetime" && key !== "url") {
          row[key] = mappedValues[key];
        }
      }

      data.push(row);
    } catch (error) {
      errors.push({
        row: i + 1,
        message: error instanceof Error ? error.message : String(error),
      });
    }
  }

  return { data, errors, columns };
}
