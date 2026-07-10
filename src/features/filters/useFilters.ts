import { useState } from "react";

export function useFilters() {
  const [baseUrl, setBaseUrl] = useState("");
  const [filterPatterns, setFilterPatterns] = useState("");

  return { baseUrl, filterPatterns, setBaseUrl, setFilterPatterns };
}
