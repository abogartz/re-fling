import React, { useState, useCallback, useRef } from "react";
import { parseCSV, ParsedCSV, ColumnMapping, CSVRow } from "../../csv/parser";
import { addLog } from "../../bun/logs";

export interface CsvLoadState {
  rawText: string | null;
  rawParsed: ParsedCSV | null;
  parsedData: ParsedCSV | null;
  columnMapping: { url?: string; datetime?: string };
  error: string | null;
  fileInputRef: React.RefObject<HTMLInputElement | null>;
}

export function useCsvLoad() {
  const [rawText, setRawText] = useState<string | null>(null);
  const [rawParsed, setRawParsed] = useState<ParsedCSV | null>(null);
  const [parsedData, setParsedData] = useState<ParsedCSV | null>(null);
  const [columnMapping, setColumnMapping] = useState<{
    url?: string;
    datetime?: string;
  }>({});
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const handleFileLoad = useCallback(async () => {
    const file = fileInputRef.current?.files?.[0];
    if (!file) { return; }
    setError(null);
    try {
      const text = await file.text();
      setRawText(text);

      const rawResult = parseCSV(text);
      setRawParsed(rawResult);

      const urlCol = rawResult.columns.find((c) => c.toLowerCase() === "url");
      const dtCol = rawResult.columns.find(
        (c) => c.toLowerCase() === "datetime",
      );
      const mapping: { url?: string; datetime?: string } = {};
      if (urlCol) { mapping.url = urlCol; }
      if (dtCol) { mapping.datetime = dtCol; }
      setColumnMapping(mapping);

      if (mapping.url && mapping.datetime) {
        const mappedResult = parseCSV(text, {
          url: mapping.url,
          datetime: mapping.datetime,
        });
        if (mappedResult.errors.length > 0) {
          setError(
            `CSV parse errors: ${mappedResult.errors.map((e) => e.message).join(", ")}`,
          );
        }
        setParsedData(mappedResult);

        const logMessage = formatRequestsForLog(mappedResult.data, 1, 0);
        addLog(logMessage);
      } else {
        setParsedData(null);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    }
  }, []);

  // Re-parse with column mapping when mapping changes
  React.useEffect(() => {
    if (!rawText || !columnMapping.url || !columnMapping.datetime) {
      setParsedData(null);
      return;
    }
    const map: ColumnMapping = {
      url: columnMapping.url,
      datetime: columnMapping.datetime,
    };
    try {
      const result = parseCSV(rawText, map);
      if (result.errors.length > 0) {
        setError(
          `CSV parse errors: ${result.errors.map((e) => e.message).join(", ")}`,
        );
      }
      setParsedData(result);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    }
  }, [rawText, columnMapping]);

  return {
    rawText,
    rawParsed,
    parsedData,
    columnMapping,
    setColumnMapping,
    error,
    fileInputRef,
    handleFileLoad,
  };
}

function formatRequestsForLog(
  data: CSVRow[],
  _speed: number,
  durationMs: number,
): string {
  if (data.length === 0) {
    return 'requests: []';
  }

  const csvDuration = calculateActualDuration(data);
  const effectiveDuration = durationMs > 0 ? durationMs : csvDuration;
  const repeatCount = csvDuration > 0 ? Math.ceil(effectiveDuration / csvDuration) : 1;

  const requests: Array<{ url: string; timing: string }> = [];
  const firstTime = new Date(data[0].datetime).getTime();

  for (let cycle = 0; cycle < repeatCount; cycle++) {
    for (const row of data) {
      const csvTime = new Date(row.datetime).getTime();
      const relativeTime = csvTime - firstTime;
      const playbackTime = csvDuration > 0
        ? (relativeTime * effectiveDuration) / csvDuration
        : 0;
      const absoluteTime = playbackTime + cycle * csvDuration;

      requests.push({
        url: row.url,
        timing: `${(absoluteTime / 1000).toFixed(2)}s`,
      });
    }
  }

  return `requests: ${JSON.stringify(requests)}`;
}

function calculateActualDuration(data: CSVRow[]): number {
  if (data.length < 2) { return 0; }
  const firstTime = new Date(data[0].datetime).getTime();
  const lastTime = new Date(data[data.length - 1].datetime).getTime();
  return Math.max(0, lastTime - firstTime);
}
