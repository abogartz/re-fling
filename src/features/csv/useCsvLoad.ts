import React, { useCallback, useRef } from "react";
import { parseCSV } from "../../csv/parser";
import { useAppStore } from "../../store/useAppStore";

export function useCsvLoad() {
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const {
    rawText,
    setRawText,
    rawParsed,
    setRawParsed,
    parsedData,
    setParsedData,
    columnMapping,
    setColumnMapping,
    error,
    setError,
  } = useAppStore();

  const handleFileLoad = useCallback(async () => {
    const file = fileInputRef.current?.files?.[0];
    if (!file) {
      return;
    }

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
      if (urlCol) {
        mapping.url = urlCol;
      }
      if (dtCol) {
        mapping.datetime = dtCol;
      }
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
      } else {
        setParsedData(null);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    }
  }, [setError, setRawText, setRawParsed, setColumnMapping, setParsedData]);

  // Re-parse with column mapping when mapping changes
  React.useEffect(() => {
    if (!rawText || !columnMapping.url || !columnMapping.datetime) {
      setParsedData(null);
      return;
    }
    const map = {
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
  }, [rawText, columnMapping, setError, setParsedData]);

  return {
    rawText,
    rawParsed,
    parsedData,
    columnMapping,
    error,
    fileInputRef,
    handleFileLoad,
    setColumnMapping,
  };
}
