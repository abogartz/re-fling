import { useCallback } from "react";
import { useAppStore } from "../../store/useAppStore";

export function useFilters() {
  const baseUrl = useAppStore((s) => s.baseUrl);
  const filterPatterns = useAppStore((s) => s.filterPatterns);

  const setBaseUrl = useCallback(
    (url: string) => useAppStore.getState().setBaseUrl(url),
    [],
  );
  const setFilterPatterns = useCallback(
    (patterns: string) => useAppStore.getState().setFilterPatterns(patterns),
    [],
  );

  return { baseUrl, filterPatterns, setBaseUrl, setFilterPatterns };
}
