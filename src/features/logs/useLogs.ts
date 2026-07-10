import { useEffect, useCallback } from "react";
import { getLogs, clearLogs, onLogsChange, addLog } from "../../bun/logs";
import { useAppStore } from "../../store/useAppStore";

export function useLogs() {
  const visible = useAppStore((s) => s.visible);
  const entries = useAppStore((s) => s.entries);

  // Emit welcome log on mount
  useEffect(() => {
    addLog("Welcome to ReFling!");
  }, []);

  // Sync store entries with logs module on mount and changes
  useEffect(() => {
    const syncEntries = () => {
      useAppStore.getState().setEntries(getLogs());
    };

    syncEntries();
    const unsub = onLogsChange(syncEntries);
    return unsub;
  }, []);

  const toggleVisible = useCallback(
    () => useAppStore.getState().toggleVisible(),
    [],
  );
  const handleClearLogs = useCallback(() => {
    clearLogs();
    useAppStore.getState().clearEntries();
  }, []);

  return { visible, entries, toggleVisible, handleClearLogs };
}
