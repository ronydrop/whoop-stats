export type ChartSelection = { start: string; end: string };
export type ChartRecord = { date: string; end?: string | null; value: number | null; updatedAt?: string; note?: string; category?: string; color?: string };
const DAY = 86_400_000;

export function chartTimeline(selection: ChartSelection) {
  const start = civilDayStart(selection.start);
  const end = civilDayStart(addDays(selection.end, 1));
  const days = Math.round((Date.parse(selection.end) - Date.parse(selection.start)) / DAY) + 1;
  const boundary = (day: number) => civilDayStart(addDays(selection.start, day));
  const center = (day: number) => (boundary(day) + boundary(day + 1)) / 2;
  const step = days <= 7 ? 1 : Math.ceil((days - 1) / 8);
  const ticks: number[] = [];
  if (days === 1) {
    for (let hour = 0; hour < 24; hour += 6) ticks.push(start + hour * 3_600_000);
  } else {
    for (let day = 0; day < days; day += step) ticks.push(center(day));
    if (ticks.at(-1) !== center(days - 1)) ticks.push(center(days - 1));
  }
  const boundaries = days > 1 && days <= 14 ? Array.from({ length: days + 1 }, (_, day) => boundary(day)) : [];
  return { start, end, ticks, boundaries, hourly: days === 1 };
}

export function visibleRecord(record: ChartRecord, selection: ChartSelection, interval: boolean) {
  if (record.value == null || !Number.isFinite(record.value)) return null;
  const axis = chartTimeline(selection);
  const from = Date.parse(record.date);
  if (!Number.isFinite(from)) return null;
  if (!interval) return from >= axis.start && from < axis.end ? { start: from, end: from, value: record.value, clipped: false } : null;
  const to = Date.parse(record.end ?? record.updatedAt ?? "");
  if (!Number.isFinite(to) || to <= from || from >= axis.end || to <= axis.start) return null;
  return { start: Math.max(from, axis.start), end: Math.min(to, axis.end), value: record.value, clipped: from < axis.start || to > axis.end };
}
import { addDays, civilDayStart } from "./period.ts";
