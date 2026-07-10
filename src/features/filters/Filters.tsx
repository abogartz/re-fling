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
    <div className="bg-[#252525] rounded-lg border border-gray-700 p-2">
      <h2 className="text-xs font-semibold mb-1 text-white">Filters</h2>
      <div className="flex gap-1.5">
        <input
          type="text"
          value={baseUrl}
          onChange={(e) => onBaseUrlChange(e.target.value)}
          placeholder="Base URL"
          className="flex-1 border border-gray-600 bg-[#1a1a1a] text-white rounded px-1.5 py-0.5 text-xs"
        />
        <input
          type="text"
          value={filterPatterns}
          onChange={(e) => onFilterPatternsChange(e.target.value)}
          placeholder="Filter patterns"
          className="flex-1 border border-gray-600 bg-[#1a1a1a] text-white rounded px-1 py-0.5 text-xs"
        />
      </div>
    </div>
  );
}
