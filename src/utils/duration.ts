export function calculateActualDuration(data: Array<{ datetime: Date }>): number {
  if (data.length < 2) { return 0; }
  const firstTime = new Date(data[0].datetime).getTime();
  const lastTime = new Date(data[data.length - 1].datetime).getTime();
  return Math.max(0, lastTime - firstTime);
}

export function formatDuration(ms: number): string {
  const seconds = Math.floor(ms / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);

  if (hours > 0) {
    return `${hours}h ${minutes % 60}m`;
  }
  if (minutes > 0) {
    return `${minutes}m ${seconds % 60}s`;
  }
  return `${seconds}s`;
}

export type DurationUnit = "seconds" | "minutes" | "hours";

const UNIT_MULTIPLIERS: Record<DurationUnit, number> = {
  seconds: 1000,
  minutes: 60_000,
  hours: 3_600_000,
};

export function getEffectiveDurationMs(
  enabled: boolean,
  value: number,
  unit: DurationUnit,
): number {
  if (!enabled || value <= 0) { return 0; }
  return value * (UNIT_MULTIPLIERS[unit] ?? 1000);
}
