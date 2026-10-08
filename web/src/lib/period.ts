export type SearchParams = Record<string, string | string[] | undefined>;
export type Period = { start: string; end: string; singleDay: boolean; first?: string; compare?: string; error?: string };
export type TimedRecord = { start_time: string; end_time?: string | null };
const dayFormatter = new Intl.DateTimeFormat("en-CA", { timeZone: "America/Sao_Paulo", year: "numeric", month: "2-digit", day: "2-digit" });
const clockFormatter = new Intl.DateTimeFormat("en-CA", { timeZone: "America/Sao_Paulo", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", second: "2-digit", hourCycle: "h23" });

export function civilDayStart(day: string): number {
  const target = Date.parse(`${day}T00:00:00Z`);
  let instant = target + 3 * 3_600_000;
  const visited = new Set<number>();
  for (let i = 0; i < 4; i++) {
    if (visited.has(instant)) return Math.max(...visited);
    visited.add(instant);
    const parts = Object.fromEntries(clockFormatter.formatToParts(instant).map(p => [p.type, p.value]));
    const local = Date.parse(`${parts.year}-${parts.month}-${parts.day}T${parts.hour}:${parts.minute}:${parts.second}Z`);
    const delta = target - local;
    if (!delta) return instant;
    instant += delta;
  }
  return instant;
}

export function dateKey(value: string | Date): string {
  return dayFormatter.format(new Date(value));
}

export function addDays(day: string, amount: number): string {
  const date = new Date(`${day}T12:00:00Z`);
  date.setUTCDate(date.getUTCDate() + amount);
  return date.toISOString().slice(0, 10);
}

function validDay(value: unknown): value is string {
  return typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value) &&
    Number.isFinite(Date.parse(value)) && new Date(value).toISOString().slice(0, 10) === value;
}

export function resolvePeriod(params: SearchParams, now = new Date()): Period {
  const today = dateKey(now);
  const fallback = { start: addDays(today, -29), end: today, singleDay: false };
  if (params.start === undefined && params.end === undefined) return fallback;
  if (!validDay(params.start) || !validDay(params.end)) return { ...fallback, error: "Informe duas datas válidas." };
  if (params.start > params.end) return { ...fallback, error: "A data inicial deve ser anterior ou igual à final." };
  if (params.end > today) return { ...fallback, error: "Selecione um período até hoje." };
  if (Date.parse(params.end) - Date.parse(params.start) > 365 * 86400000) return { ...fallback, error: "Selecione até 366 dias por consulta." };
  for (const value of [params.first, params.compare]) {
    if (value !== undefined && (!validDay(value) || value < params.start || value > params.end)) return { ...fallback, error: "Escolha os dias dentro do período selecionado." };
  }
  if (params.first !== undefined || params.compare !== undefined) {
    if (!validDay(params.first) || !validDay(params.compare)) return { ...fallback, error: "Selecione os dois dias da comparação." };
    return { start: params.start, end: params.end, singleDay: params.start === params.end, first: params.first, compare: params.compare };
  }
  return { start: params.start, end: params.end, singleDay: params.start === params.end };
}

export function periodQuery(period: Pick<Period, "start" | "end" | "first" | "compare">): string {
  const query = new URLSearchParams({ start: period.start, end: period.end });
  if (period.first && period.compare) { query.set("first", period.first); query.set("compare", period.compare); }
  return query.toString();
}

export function overlapsPeriod(record: TimedRecord, period: Period, now = new Date()): boolean {
  const firstDay = dateKey(record.start_time);
  const lastDay = record.end_time ? dateKey(new Date(Date.parse(record.end_time) - 1)) : dateKey(now);
  return firstDay <= period.end && lastDay >= period.start;
}

export async function readPeriodRecords<T>(fetchPage: (cursor: string | undefined, limit: number) => Promise<{ records: T[]; next_cursor: string | null }>, period: Period): Promise<T[]> {
  if (period.error) return [];
  let cursor: string | undefined;
  const result: T[] = [];
  const seen = new Set<string>();
  for (;;) {
    const page = await fetchPage(cursor, 200);
    result.push(...page.records);
    if (!page.next_cursor) return result;
    if (seen.has(page.next_cursor)) throw new Error("A paginação do histórico não avançou.");
    seen.add(page.next_cursor);
    cursor = page.next_cursor;
  }
}
