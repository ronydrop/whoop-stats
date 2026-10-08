import { object } from "./stress.ts";
import { addDays, dateKey } from "./period.ts";

export const list = (value: unknown): unknown[] => Array.isArray(value) ? value : [];
export const text = (value: unknown): string | null => typeof value === "string" && value.trim() ? value.trim() : null;
export function numeric(value: unknown): number | null {
  if (typeof value === "number") return Number.isFinite(value) ? value : null;
  if (typeof value !== "string" || !/^[+-]?[\d,.]+\s*%?$/.test(value.trim())) return null;
  const result = Number(value.replace(/,/g, "").replace(/%$/, "").trim());
  return Number.isFinite(result) ? result : null;
}
export function durationMs(value: unknown): number | null {
  const match = typeof value === "string" ? /^(\d+):(\d{2})$/.exec(value.trim()) : null;
  return match && Number(match[2]) < 60 ? (Number(match[1]) * 60 + Number(match[2])) * 60_000 : null;
}
export function nodes(value: unknown): Record<string, unknown>[] {
  if (Array.isArray(value)) return value.flatMap(nodes);
  if (!value || typeof value !== "object") return [];
  const node = object(value);
  return [node, ...Object.values(node).flatMap(nodes)];
}

const behaviorLabels: Record<string, string> = {
  relationship_stress: "Estresse no relacionamento", stress: "Estresse", sex: "Atividade sexual", sexual_activity: "Atividade sexual",
  caffeine: "Cafeína", alcohol: "Álcool", meditation: "Meditação", hydration: "Hidratação", screen_time: "Tempo de tela",
  creatine: "Creatina", magnesium: "Magnésio", melatonin: "Melatonina", late_meal: "Refeição tardia", late_eating: "Refeição tardia",
  daylight_eating: "Alimentação durante o dia", sleep_mask: "Máscara para dormir", reading: "Leitura", supplements: "Suplementos",
  learning: "Aprendizado", cbd: "CBD", early_workout: "Treino cedo", late_workout: "Treino tardio",
};
export function behaviorLabel(name: unknown, title: unknown): string {
  const normalize = (value: unknown) => String(value).toLowerCase().replace(/[ -]+/g, "_");
  const label = text(title);
  return behaviorLabels[normalize(name)] ?? behaviorLabels[normalize(title)] ?? label?.replace(/^(\d+)%\+ of the Day in High Stress Zone$/i, "$1% ou mais do dia em estresse alto").replace(/^(\d+)%\+ Sleep Performance$/i, "Desempenho do sono de $1% ou mais").replace(/^(\d+)\+ Strain$/i, "Esforço de $1 ou mais") ?? "Hábito sem nome informado";
}
export type JournalEntry = { id: number; name: string; answer: boolean | null; amount: number | null; detail: string | null; time: string | null };
export type JournalData = { entries: JournalEntry[]; start: string | null; end: string | null; reviewed: boolean | null };
export function parseJournal(raw: unknown): JournalData {
  const root = object(raw), journal = object(root.journal), bounds = object(object(root.metadata).journal_bounds);
  if (!Array.isArray(journal.tracked_behaviors)) throw new Error("Formato do Diário não reconhecido");
  const entries = list(journal.tracked_behaviors).flatMap(item => {
    const row = object(item), tracker = object(row.behavior_tracker), input = object(row.tracker_input);
    const id = numeric(tracker.id);
    if (id === null) return [];
    const label = text(input.magnitude_input_label), timestamp = numeric(input.time_input_value);
    const labels: Record<string, string> = { low: "Baixo", moderate: "Moderado", high: "Alto" };
    return [{ id, name: behaviorLabel(tracker.internal_name, tracker.title), answer: typeof input.answered_yes === "boolean" ? input.answered_yes : null,
      amount: numeric(input.magnitude_input_value), detail: label && numeric(label) === null ? labels[label] ?? label : null,
      time: timestamp !== null && timestamp >= 1_000_000_000_000 && timestamp < 10_000_000_000_000 ? new Date(timestamp).toISOString() : text(input.time_input_label) }];
  });
  return { entries, start: text(bounds.current_cycle_sleep_lower), end: text(bounds.next_cycle_sleep_lower), reviewed: typeof journal.user_reviewed === "boolean" ? journal.user_reviewed : null };
}
export type BehaviorImpact = { id: string; name: string; sufficient: boolean; display: string | null; yes: number | null; no: number | null; direction: string };
export function parseImpacts(raw: unknown): BehaviorImpact[] {
  if (!Array.isArray(object(raw).tiles)) throw new Error("Formato dos impactos não reconhecido");
  return list(object(raw).tiles).flatMap(item => {
    const tile = object(item);
    return list(object(tile.content).impact_cards).flatMap(item => {
      const card = object(item), id = text(card.impact_uuid);
      return id && /^[a-f0-9-]{36}$/.test(id) ? [{ id, name: behaviorLabel(String(card.impact_card_title_display).toLowerCase().replaceAll(" ", "_"), card.impact_card_title_display),
        sufficient: tile.type === "IMPACT_TILE", display: text(card.impact_percentage_display), yes: numeric(card.yes_answer_count), no: numeric(card.no_answer_count), direction: String(card.impact_style) }] : [];
    });
  });
}
export function parseImpactDetail(raw: unknown) {
  const seen = new Set<string>();
  const metricNames: Record<string, string> = { "RECOVERY IMPACT": "Recuperação", "HRV IMPACT": "VFC", "SLEEP IMPACT": "Sono", "SLEEP PERFORMANCE IMPACT": "Desempenho do sono", "RHR IMPACT": "FC em repouso" };
  return nodes(raw).flatMap(card => {
    const name = text(card.title_display), value = numeric(card.impact_percentage_value);
    if (!name || value === null || seen.has(name)) return [];
    seen.add(name);
    return [{ name: metricNames[name] ?? name, value, unit: text(card.impact_percentage_symbol) ?? "", direction: text(card.impact_style) }];
  });
}

export type TrendMetric = "VO2_MAX" | "STRESS" | "STRESS_DURING_SLEEP" | "STRESS_DURING_NON_STRAIN";
export type TrendWindow = "week" | "month" | "six_month";
export type ExtraTrend = { window: TrendWindow; start: string; end: string; average: number | null; unit: string; series: { label: string; color: string; points: { date: string; value: number | null }[] }[] };
const months = ["JAN", "FEB", "MAR", "APR", "MAY", "JUN", "JUL", "AUG", "SEP", "OCT", "NOV", "DEC"];
export function trendDate(display: unknown, end: string): string | null {
  if (typeof display !== "string") return null;
  const match = /\b(JAN|FEB|MAR|APR|MAY|JUN|JUL|AUG|SEP|OCT|NOV|DEC)\s+(\d{1,2})\b/.exec(display.toUpperCase());
  if (!match) return null;
  const month = String(months.indexOf(match[1]) + 1).padStart(2, "0"), day = match[2].padStart(2, "0");
  if (Number(day) < 1 || Number(day) > 31) return null;
  let year = Number(end.slice(0, 4));
  if (`${year}-${month}-${day}` > end) year--;
  const date = `${year}-${month}-${day}`;
  return new Date(`${date}T12:00:00Z`).toISOString().slice(0, 10) === date ? date : null;
}
export function parseTrends(raw: unknown, metric: TrendMetric, end: string): ExtraTrend[] {
  const root = object(raw);
  if (!["week", "month", "six_month"].some(window => root[`${window}_time_segment`])) throw new Error("Formato das tendências não reconhecido");
  return (["week", "month", "six_month"] as const).flatMap(window => {
    const segment = object(root[`${window}_time_segment`]);
    if (!Object.keys(segment).length || segment.is_hidden === true) return [];
    const primary = object(list(segment.metrics)[0]), duration = metric !== "VO2_MAX";
    const start = addDays(end, -({ week: 6, month: 29, six_month: 179 }[window]));
    const series = new Map<string, { label: string; color: string; points: { date: string; value: number | null }[] }>();
    for (const item of list(object(segment.graph).plots)) {
      const rootPlot = object(item), plot = object(rootPlot.plot);
      if (rootPlot.type !== "LINE_PLOT" && rootPlot.type !== "BAR_PLOT") continue;
      const samples = [...list(plot.segments).flatMap(seg => list(object(seg).points)), ...list(plot.bar_groups).flatMap(group => list(object(group).bars))];
      for (const sample of samples) {
        const details = object(object(sample).data_scrubber_details), day = trendDate(details.primary_contextual_display, end);
        if (!day || day < start || day > end) continue;
        const category = String(details.secondary_contextual_display ?? "");
        const label = metric === "VO2_MAX" ? "VO₂ Max" : /HIGH/.test(category) ? "Estresse alto" : /MEDIUM/.test(category) ? "Estresse moderado" : /LOW/.test(category) ? "Estresse baixo" : "Estresse";
        const color = label === "Estresse alto" ? "#FF7878" : label === "Estresse moderado" ? "#FFB347" : label === "Estresse baixo" ? "#69D39B" : "var(--color-strain)";
        const value = duration ? durationMs(details.value_display) : numeric(details.value_display);
        if (!series.has(label)) series.set(label, { label, color, points: [] });
        const points = series.get(label)!.points;
        if (!points.some(point => dateKey(point.date) === day)) points.push({ date: `${day}T12:00:00-03:00`, value: value === null ? null : duration ? value / 3_600_000 : value });
      }
    }
    const avg = numeric(primary.current_metric_value);
    return [{ window, start, end, average: avg === null ? null : duration ? avg / 3_600_000 : avg,
      unit: duration ? "h" : "mL/kg/min", series: [...series.values()].map(s => ({ ...s, points: s.points.sort((a, b) => a.date.localeCompare(b.date)) })) }];
  });
}
export function vo2Calibration(raw: unknown): string | null {
  for (const callout of list(object(raw).info_callouts)) {
    const description = text(object(callout).description);
    const remaining = description?.match(/Log (\d+) more sleeps/i);
    if (remaining) return `O VO₂ Max está em calibração na WHOOP. Faltam ${remaining[1]} sonos registrados para liberar a estimativa.`;
    if (/calibrat/i.test(description ?? "")) return "O VO₂ Max está em calibração na WHOOP.";
  }
  return null;
}

export type SleepStage = "AWAKE" | "LIGHT_SLEEP" | "REM_SLEEP" | "SWS_SLEEP";
export type SleepExtra = { start: string | null; end: string | null; intervals: { start: string; end: string; stage: SleepStage }[]; stress: { label: string; minutes: number | null; percent: number | null; color: string }[]; restorativeMs: number | null };
export function parseSleepExtra(raw: unknown): SleepExtra {
  const bounds = object(object(object(raw).header_section).destination).parameters;
  const start = text(object(bounds).start_time), end = text(object(bounds).end_time);
  if (!start || !end) throw new Error("Horários do sono não disponíveis");
  const first = start ? Date.parse(start) : NaN, last = end ? Date.parse(end) : NaN;
  const all = nodes(raw), bars = all.filter(node => node.type === "BAR_GRAPH_CARD");
  const intervals: SleepExtra["intervals"] = [], stress: SleepExtra["stress"] = [];
  let rem: number | null = null, deep: number | null = null;
  for (const bar of bars) for (const item of list(object(bar.content).heart_rate_zones)) {
    const row = object(item), id = text(row.id);
    if (!id) continue;
    if (id === "REM_SLEEP") rem = durationMs(row.bar_graph_tile_time_display);
    if (id === "SWS_SLEEP") deep = durationMs(row.bar_graph_tile_time_display);
    if (["HIGH_STRESS", "MEDIUM_STRESS", "LOW_STRESS"].includes(id)) {
      const ms = durationMs(row.bar_graph_tile_time_display);
      stress.push({ label: id === "HIGH_STRESS" ? "Alto" : id === "MEDIUM_STRESS" ? "Moderado" : "Baixo", minutes: ms === null ? null : ms / 60_000,
        percent: numeric(row.bar_graph_tile_percentage_display), color: id === "HIGH_STRESS" ? "#FF7878" : id === "MEDIUM_STRESS" ? "#FFB347" : "#69D39B" });
    }
    if (!Number.isFinite(first) || !Number.isFinite(last) || last <= first || !["AWAKE", "LIGHT_SLEEP", "REM_SLEEP", "SWS_SLEEP"].includes(id)) continue;
    for (const range of list(object(row.bar_graph).time_bound_ranges)) {
      const lower = numeric(object(range).lower_endpoint), upper = numeric(object(range).upper_endpoint);
      if (lower === null || upper === null || lower < 0 || upper > 1 || upper <= lower) continue;
      intervals.push({ start: new Date(first + lower * (last - first)).toISOString(), end: new Date(first + upper * (last - first)).toISOString(), stage: id as SleepStage });
    }
  }
  return { start, end, intervals: intervals.sort((a, b) => a.start.localeCompare(b.start)), stress, restorativeMs: rem === null || deep === null ? null : rem + deep };
}

export type SleepPlan = { needMs: number | null; baselineMs: number | null; debtMs: number | null; strainMs: number | null; napMs: number | null; wake: string | null; goals: { goal: string; inBedMs: number | null; sleepMs: number | null }[]; alarm: string | null };
export function parseSleepPlan(raw: unknown): SleepPlan {
  const root = object(raw), need = object(root.need_breakdown), choices = object(root.recommended_time_in_bed_formatted);
  if (!Object.keys(need).length) throw new Error("Formato da necessidade de sono não reconhecido");
  const goals = ["70", "85", "100"].flatMap(goal => {
    const item = object(choices[goal]);
    return Object.keys(item).length ? [{ goal, inBedMs: numeric(item.recommended_time_in_bed), sleepMs: durationMs(item.sleep_need_time_string) }] : [];
  });
  return { needMs: numeric(need.total), baselineMs: numeric(need.baseline), debtMs: numeric(need.debt), strainMs: numeric(need.strain), napMs: numeric(need.naps),
    wake: text(object(object(choices["100"]).optimal_endpoints_formatted).end)?.slice(0, 5) ?? null, goals, alarm: text(root.alarm_schedule_state) };
}
export function plannedBedtime(wake: string, inBedMs: number | null): string | null {
  if (!/^\d{2}:\d{2}$/.test(wake) || inBedMs === null || inBedMs < 0) return null;
  const [h, m] = wake.split(":").map(Number);
  if (h > 23 || m > 59) return null;
  const minutes = ((h * 60 + m - Math.round(inBedMs / 60_000)) % 1440 + 1440) % 1440;
  return `${String(Math.floor(minutes / 60)).padStart(2, "0")}:${String(minutes % 60).padStart(2, "0")}`;
}
export type LiveHeart = { bpm: number | null; zone: number | null; timestamp: string | null; streaming: boolean; fresh: boolean };
export function parseLiveHeart(raw: unknown, fetchedAt: string): LiveHeart {
  const root = object(raw), tile = nodes(root).find(node => ["LIVE_HR", "HEART_RATE_LIVE", "LIVE_HEART_RATE_TILE"].includes(String(node.type)));
  if (typeof root.show_live_hr !== "boolean") throw new Error("Estado da transmissão não disponível");
  const content = object(tile?.content), bpm = numeric(content.value ?? content.bpm ?? tile?.value ?? tile?.bpm);
  const zone = numeric(content.zone ?? tile?.zone), timestamp = text(content.updated_at ?? content.timestamp ?? tile?.updated_at ?? tile?.timestamp);
  const age = timestamp ? Date.parse(fetchedAt) - Date.parse(timestamp) : NaN;
  const streaming = root.show_live_hr === true && bpm !== null && bpm >= 20 && bpm <= 250;
  return { bpm: streaming ? bpm : null, zone: zone !== null && zone >= 0 && zone <= 5 ? zone : null, timestamp,
    streaming, fresh: streaming && Number.isFinite(age) && age >= -30_000 && age <= 90_000 };
}

export type StrengthData = { volumeKg: number | null; muscularPercent: number | null; exercises: { id: string; name: string; sets: number | null; reps: number | null; volumeKg: number | null }[] };
export function parseStrength(raw: unknown): StrengthData {
  const root = object(raw), exercises = object(object(root.weightlifting_cardio_details).weightlifting_exercises), items = list(object(exercises.exercise_summary_carousel).items);
  if (!Object.keys(exercises).length) throw new Error("Detalhes de força não disponíveis");
  const unit = text(exercises.tonnage_units_display), factor = /kg/i.test(unit ?? "") ? 1 : /lb/i.test(unit ?? "") ? 0.45359237 : null;
  const volume = (value: unknown) => { const n = numeric(value); return n === null || factor === null ? null : n * factor; };
  return { volumeKg: volume(object(items.find(item => !object(item).exercise_id)).tonnage_display), muscularPercent: numeric(object(root.strain_breakdown).msk_percent_display),
    exercises: items.flatMap(item => {
      const row = object(item), id = text(row.exercise_id);
      if (!id) return [];
      const sets = text(row.subtitle_display)?.match(/^(\d+)\s+Sets?/i);
      return [{ id, name: text(row.title_display) ?? "Exercício", sets: sets ? Number(sets[1]) : null, reps: numeric(row.volume_display), volumeKg: volume(row.tonnage_display) }];
    }) };
}

export type LiftSession = { date: string | null; activityId: string | null; sets: { reps: number | null; weight: number | null; unit: string | null; seconds: number | null }[] };
export function parseExerciseHistory(raw: unknown): LiftSession[] {
  if (!Array.isArray(object(raw).items)) throw new Error("Formato do histórico não reconhecido");
  return list(object(raw).items).flatMap(item => {
    const content = object(object(item).content), header = object(object(content.header_content).content);
    if (!Object.keys(header).length) return [];
    const blocks = list(content.expanded_content).map(object), breakdown = blocks.find(block => block.type === "EXERCISE_BREAKDOWN");
    const button = blocks.find(block => block.type === "CARD_BUTTON");
    return [{ date: text(header.record_date), activityId: text(object(object(object(button?.content).destination).parameters).activity_id),
      sets: list(object(breakdown?.content).rows).map(item => {
        const cells = list(object(item).items), reps = numeric(object(cells[0]).value), weight = numeric(object(cells[1]).value), unit = text(object(cells[1]).units);
        const timed = unit === "s" || unit === "sec";
        return { reps, weight: timed ? null : weight, unit: timed ? null : unit, seconds: timed ? weight : null };
      }) }];
  });
}
