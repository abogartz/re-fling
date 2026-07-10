import { useState, useEffect, useCallback } from "react";
import { getLogs, clearLogs, onLogsChange, addLog } from "../../bun/logs";

export function useLogs() {
  const [logsVisible, setLogsVisible] = useState(false);
  const [logs, setLogs] = useState<string[]>([]);

  // Emit welcome log on mount
  useEffect(() => {
    addLog("Welcome to ReFling!");
  }, []);

  // Subscribe to log changes
  useEffect(() => {
    setLogs(getLogs());
    const unsub = onLogsChange(() => setLogs(getLogs()));
    return unsub;
  }, []);

  const toggleLogs = useCallback(() => {
    setLogsVisible((prev) => !prev);
  }, []);

  const handleClearLogs = useCallback(() => {
    clearLogs();
    setLogs([]);
  }, []);

  return {
    logsVisible,
    logs,
    toggleLogs,
    handleClearLogs,
  };
}
