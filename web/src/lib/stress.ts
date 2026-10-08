import { addDays, civilDayStart, dateKey } from "./period.ts";

export type StressPoint = { minute: number; level: number | null };
export type StressDay = {
  version: 2;
  date: string;
  fetchedAt: string;
  score: number | null;
  min: number | null;
  peak: number | null;
  calibrating: boolean;
  points: StressPoint[];
};
export type StressView = { connected: boolean; stale: boolean; data: StressDay | null; message: string };
export type StressAuthResult = { ok: boolean; message: string; challengeId?: string; challengeLabel?: string };

export function object(value: unknown): Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value) ? value as Record<string, unknown> : {};
}

export function validStressDate(value: unknown): value is string {
  return typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value) &&
    Number.isFinite(Date.parse(value)) && new Date(value).toISOString().slice(0, 10) === value;
}

function score(value: unknown): number | null {
  if (typeof value !== "number" && (typeof value !== "string" || !/^\d(?:[.,]\d+)?$/.test(value.trim()))) return null;
  const number = Number(typeof value === "string" ? value.replace(",", ".") : value);
  return Number.isFinite(number) && number >= 0 && number <= 3 ? number : null;
}

export function stressMinute(value: unknown): number | null {
  if (typeof value !== "string") return null;
  const match = value.trim().match(/^(\d{1,2}):(\d{2})\s*(AM|PM)?$/i);
  if (!match) return null;
  let hour = Number(match[1]);
  const minutes = Number(match[2]);
  if (minutes > 59 || hour > 23) return null;
  if (match[3]) {
    if (hour < 1 || hour > 12) return null;
    hour = hour % 12 + (match[3].toUpperCase() === "PM" ? 12 : 0);
  }
  return hour * 60 + minutes;
}

export function localStressMinute(instant: string): number {
  const parts = new Intl.DateTimeFormat("en-GB", { timeZone: "America/Sao_Paulo", hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).format(new Date(instant));
  return stressMinute(parts)!;
}

export function historicalStressEnd(raw: unknown, date: string, cycles: { start_time: string; end_time: string | null }[]): string {
  const root = object(raw);
  const last = stressMinute(root.last_updated_display);
  if (last === null) throw new Error("Não foi possível confirmar as datas do histórico de estresse.");
  const start = civilDayStart(date);
  const end = civilDayStart(addDays(date, 1));
  const candidates = cycles.flatMap(cycle => {
    if (!cycle.end_time || Date.parse(cycle.start_time) >= end || Date.parse(cycle.end_time) <= start) return [];
    const gap = (localStressMinute(cycle.end_time) - last + 1440) % 1440;
    return gap <= 15 ? [{ end: cycle.end_time, gap }] : [];
  }).sort((a, b) => a.gap - b.gap);
  if (!candidates.length || (candidates[1]?.gap === candidates[0].gap && Date.parse(candidates[1].end) !== Date.parse(candidates[0].end))) {
    throw new Error("Não foi possível confirmar as datas do histórico de estresse.");
  }
  return candidates[0].end;
}

export function parseStress(raw: unknown, date: string, fetchedAt: string, windowEnd = fetchedAt): StressDay {
  const root = object(raw);
  const graph = object(object(root.extended24_hour_graph ?? root.stress_graph).graph);
  const calibrating = root.stress_state === "CALIBRATING" || Boolean(root.calibration_text_display);
  if (!("gauge" in root) && !("stress_graph" in root) && !("extended24_hour_graph" in root) && !calibrating) {
    throw new Error("O formato do estresse mudou na WHOOP. A integração precisa ser revisada.");
  }
  const readings: { minute: number; level: number | null; position: number }[] = [];
  const array = (value: unknown): unknown[] => Array.isArray(value) ? value : [];
  for (const plot of array(graph.plots)) {
    for (const segment of array(object(object(plot).plot).segments)) {
      for (const point of array(object(segment).points)) {
        const details = object(object(point).data_scrubber_details);
        const time = stressMinute(details.primary_contextual_display);
        if (time !== null) {
          const position = object(point).position_x;
          if (typeof position !== "number" || !Number.isFinite(position)) throw new Error("O formato do estresse mudou na WHOOP. A integração precisa ser revisada.");
          readings.push({ minute: time, level: score(details.value_display), position });
        }
      }
    }
  }
  readings.sort((a, b) => a.position - b.position);
  const samples = new Map<number, number | null>();
  let readingDate = dateKey(windowEnd);
  let nextMinute = localStressMinute(windowEnd);
  for (let index = readings.length - 1; index >= 0; index--) {
    const reading = readings[index];
    if (reading.minute > nextMinute) readingDate = addDays(readingDate, -1);
    nextMinute = reading.minute;
    if (readingDate !== date || readingDate > dateKey(fetchedAt) || (readingDate === dateKey(fetchedAt) && reading.minute > localStressMinute(fetchedAt))) continue;
    if (!samples.has(reading.minute) || samples.get(reading.minute) === null) samples.set(reading.minute, reading.level);
  }
  const points = [...samples].sort(([a], [b]) => a - b).map(([minute, level]) => ({ minute, level }));
  const levels = points.flatMap(p => p.level === null ? [] : [p.level]);
  return {
    version: 2, date, fetchedAt, calibrating, points,
    score: levels.at(-1) ?? null,
    min: levels.length ? Math.min(...levels) : null,
    peak: levels.length ? Math.max(...levels) : null,
  };
}

export function stressClock(minute: number): string {
  return `${Math.floor(minute / 60).toString().padStart(2, "0")}:${(minute % 60).toString().padStart(2, "0")}`;
}

export function stressChartPoints(points: StressPoint[]): StressPoint[] {
  return points.flatMap((point, index) => index && point.minute - points[index - 1].minute > 10
    ? [{ minute: points[index - 1].minute + 1, level: null }, point] : [point]);
}
