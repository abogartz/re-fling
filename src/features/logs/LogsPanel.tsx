interface LogsPanelProps {
  visible: boolean;
  logs: string[];
  logCount: number;
  onToggle: () => void;
  onClear: () => void;
}

export function LogsPanel({
  visible,
  logs,
  logCount,
  onToggle,
  onClear,
}: LogsPanelProps) {
  return (
    <>
      <button
        onClick={onToggle}
        title="Toggle logs"
        className="bg-[#252525] border border-gray-700 rounded-lg px-3 py-1.5 hover:bg-[#333] transition-colors text-xs text-gray-300"
      >
        {visible ? "Hide Logs" : "Show Logs"} ({logCount})
      </button>

      {visible && (
        <div className="bg-[#252525] rounded-lg border border-gray-700 p-2 mt-2" data-testid="logs-panel">
          <div className="flex items-center justify-between mb-1">
            <h2 className="text-xs font-semibold text-white">Logs</h2>
            <button
              onClick={onClear}
              className="text-[10px] text-gray-400 hover:text-white transition-colors"
            >
              Clear
            </button>
          </div>
          <div className="max-h-48 overflow-y-auto font-mono text-[10px] text-gray-400 space-y-0.5">
            {logs.length === 0 ? (
              <p className="text-gray-600 italic">No logs yet.</p>
            ) : (
              logs.map((line, i) => (
                <div key={i} className="break-all whitespace-pre-wrap">{line}</div>
              ))
            )}
          </div>
        </div>
      )}
    </>
  );
}
