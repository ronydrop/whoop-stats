/**
 * Shared formatting helpers for WHOOP data presentation.
 */

/** Convert milliseconds to a human-readable duration like "6h 32m" */
export function formatNumber(value: number, digits = 0): string {
  return value.toLocaleString("pt-BR", { minimumFractionDigits: digits, maximumFractionDigits: digits });
}

export function formatDuration(ms: number): string {
  if (!Number.isFinite(ms) || ms < 0) return "—";
  const hours = Math.floor(ms / (1000 * 60 * 60));
  const mins = Math.floor((ms % (1000 * 60 * 60)) / (1000 * 60));
  if (hours === 0) return `${mins}m`;
  return `${hours}h ${mins}m`;
}

export function formatElapsedTime(ms: number): string {
  if (!Number.isFinite(ms) || ms < 0) return "—";
  const seconds = Math.floor(ms / 1000);
  return [Math.floor(seconds / 3600), Math.floor(seconds / 60) % 60, seconds % 60]
    .map(value => String(value).padStart(2, "0")).join(":");
}

/** Format a timestamp to "Mon DD" like "Mar 10" */
export function formatShortDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString("pt-BR", { timeZone: "America/Sao_Paulo", month: "short", day: "numeric" });
}

/** Format a timestamp to "Mon DD, YYYY" */
export function formatFullDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString("pt-BR", { timeZone: "America/Sao_Paulo", month: "short", day: "numeric", year: "numeric" });
}

/** Format a timestamp to "h:mm a" like "7:30 AM" */
export function formatTime(dateStr: string): string {
  return new Date(dateStr).toLocaleTimeString("pt-BR", { timeZone: "America/Sao_Paulo", hour: "2-digit", minute: "2-digit", hour12: false });
}

export function formatRecordInterval(start: string, end?: string | null): string {
  return `${formatFullDate(start)} às ${formatTime(start)} → ${end ? `${formatFullDate(end)} às ${formatTime(end)}` : "em andamento"}`;
}

export function formatCycleLabel(start: string, end?: string | null): string {
  return `${formatShortDate(start)} → ${end ? formatShortDate(end) : "atual"}`;
}

/** Get recovery color class based on score (green/yellow/red) */
export function getRecoveryColor(score: number): "green" | "yellow" | "red" {
  if (score >= 67) return "green";
  if (score >= 34) return "yellow";
  return "red";
}

/** Get recovery CSS color value */
export function getRecoveryColorValue(score: number): string {
  return `var(--color-recovery-${getRecoveryColor(score)})`;
}

/** Get recovery text */
export function getRecoveryLabel(score: number): string {
  return { green: "Recuperação alta", yellow: "Recuperação moderada", red: "Recuperação baixa" }[getRecoveryColor(score)];
}

/** Format distance in meters to km or mi */
export function formatDistance(meters: number): string {
  if (!Number.isFinite(meters) || meters < 0) return "—";
  const km = meters / 1000;
  if (km >= 1) return `${km.toLocaleString("pt-BR", { minimumFractionDigits: 1, maximumFractionDigits: 1 })} km`;
  return `${Math.round(meters)} m`;
}

/** Convert kilojoules (from WHOOP API) to Calories (kcal) and format */
export function formatCalories(kj: number): string {
  if (!Number.isFinite(kj)) return "—";
  const cal = Math.round(kj / 4.184);
  return `${cal.toLocaleString("pt-BR")} kcal`;
}

/** Get raw calorie number from kJ */
export function kjToCal(kj: number): number {
  return kj / 4.184;
}

/** HR zone colors */
export const HR_ZONE_COLORS = [
  "var(--color-zone-0)",
  "var(--color-zone-1)",
  "var(--color-zone-2)",
  "var(--color-zone-3)",
  "var(--color-zone-4)",
  "var(--color-zone-5)",
] as const;

export const HR_ZONE_LABELS = ["Zona 0", "Zona 1", "Zona 2", "Zona 3", "Zona 4", "Zona 5"] as const;
