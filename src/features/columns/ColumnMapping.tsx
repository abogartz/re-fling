import { ParsedCSV } from "../../csv/parser";
import { Card } from "../../components/ui/Card";

interface ColumnMappingProps {
  rawParsed: ParsedCSV | null;
  columnMapping: { url?: string; datetime?: string };
  onUrlChange: (value: string) => void;
  onDatetimeChange: (value: string) => void;
  hasParsedData: boolean;
}

export function ColumnMapping({
  rawParsed,
  columnMapping,
  onUrlChange,
  onDatetimeChange,
  hasParsedData,
}: ColumnMappingProps) {
  if (!rawParsed) {
    return null;
  }

  return (
    <Card title="Column Mapping" className="mt-2" data-testid="column-mapping">
      <div className="flex flex-col gap-1">
        <div className="flex items-center gap-2">
          <label className="text-[10px] font-medium text-gray-300 w-16">url</label>
          <select
            value={columnMapping.url || ""}
            onChange={(e) => onUrlChange(e.target.value)}
            className="flex-1 border border-gray-600 bg-[#1a1a1a] text-white rounded px-1 py-0.5 text-xs"
          >
            <option value="">-- select column --</option>
            {rawParsed.columns.map((col) => (
              <option key={col} value={col}>
                {col}
              </option>
            ))}
          </select>
        </div>
        <div className="flex items-center gap-2">
          <label className="text-[10px] font-medium text-gray-300 w-16">datetime</label>
          <select
            value={columnMapping.datetime || ""}
            onChange={(e) => onDatetimeChange(e.target.value)}
            className="flex-1 border border-gray-600 bg-[#1a1a1a] text-white rounded px-1 py-0.5 text-xs"
          >
            <option value="">-- select column --</option>
            {rawParsed.columns.map((col) => (
              <option key={col} value={col}>
                {col}
              </option>
            ))}
          </select>
        </div>
      </div>
      {!hasParsedData && (
        <p className="mt-1 text-yellow-400 text-[10px]">
          Select both columns above to enable Start.
        </p>
      )}
    </Card>
  );
}
