import { Card } from "../../components/ui/Card";

interface FiltersProps {
  baseUrl: string;
  filterPatterns: string;
  onBaseUrlChange: (value: string) => void;
  onFilterPatternsChange: (value: string) => void;
}

export function Filters({
  baseUrl,
  filterPatterns,
  onBaseUrlChange,
  onFilterPatternsChange,
}: FiltersProps) {
  return (
    <Card title="Filters">
      <div className="flex gap-1.5">
        <input
          type="text"
          value={baseUrl}
          onChange={(e) => onBaseUrlChange(e.target.value)}
          placeholder="Base URL"
          title="Optional base URL. Relative paths in the CSV (e.g. /v1/models) are sent to <baseUrl><path>. Leave blank to replay URLs exactly as recorded."
          className="flex-1 border border-gray-600 bg-[#1a1a1a] text-white rounded px-1.5 py-0.5 text-xs"
        />
        <input
          type="text"
          value={filterPatterns}
          onChange={(e) => onFilterPatternsChange(e.target.value)}
          placeholder="Filter patterns"
          title="Comma-separated regex patterns. Any request whose URL matches a pattern is excluded from replay."
          className="flex-1 border border-gray-600 bg-[#1a1a1a] text-white rounded px-1 py-0.5 text-xs"
        />
      </div>
    </Card>
  );
}
