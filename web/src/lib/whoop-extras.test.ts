import test from "node:test";
import assert from "node:assert/strict";
import { parseTrends, trendDate, parseSleepExtra, parseSleepPlan, plannedBedtime, parseStrength, parseExerciseHistory } from "./whoop-extras.ts";

test("mudança de formato não se confunde com ausência de registros", () => {
  for (const parser of [parseSleepExtra, parseSleepPlan, parseStrength, parseExerciseHistory]) assert.throws(() => parser({}));
  assert.throws(() => parseTrends({}, "2026-10-08"));
  assert.deepEqual(parseExerciseHistory({ items: [] }), []);
});

test("tendências mantêm as três faixas das barras e convertem duração para horas", () => {
  const bar = (category: string, value: string) => ({ data_scrubber_details: { primary_contextual_display: "MON, OCT 5", secondary_contextual_display: category, value_display: value } });
  const result = parseTrends({ week_time_segment: { metrics: [{ current_metric_value: 7680000 }], graph: { plots: [{ type: "BAR_PLOT", plot: { bar_groups: [{ bars: [bar("HIGH STRESS", "1:14"), bar("MEDIUM STRESS", "6:00"), bar("LOW STRESS", "0:00")] }] } }] } } }, "2026-10-08")[0];
  assert.equal(result.series.length, 3);
  assert.equal(result.series[2].points[0].value, 0);
  assert.equal(result.average, 7680000 / 3_600_000);
  assert.equal(result.series[0].points[0].value, 74 / 60);
});
test("datas de tendência passam pelo ano novo e rejeitam dias inexistentes", () => {
  assert.equal(trendDate("TUE, DEC 30", "2026-01-03"), "2025-12-30");
  assert.equal(trendDate("FEB 31", "2026-10-08"), null);
  assert.equal(trendDate("OCT 99", "2026-10-08"), null);
});
test("tendências de estresse preservam a ausência de medições", () => {
  const raw = { month_time_segment: { metrics: [{ current_metric_value: null }], graph: { plots: [{ type: "EMPTY_PLOT", plot: {} }] } } };
  assert.equal(parseTrends(raw, "2026-10-08")[0].average, null);
  assert.equal(parseTrends(raw, "2026-10-08")[0].series.length, 0);
});
test("fases usam o intervalo real do sono atravessando meia-noite e preservam lacunas", () => {
  const result = parseSleepExtra({ header_section: { destination: { parameters: { start_time: "2026-10-07T02:00:00Z", end_time: "2026-10-07T10:00:00Z" } } }, cards: [{ type: "BAR_GRAPH_CARD", content: { heart_rate_zones: [
    { id: "REM_SLEEP", bar_graph_tile_time_display: "1:00", bar_graph: { time_bound_ranges: [{ lower_endpoint: 0, upper_endpoint: 0.125 }] } },
    { id: "SWS_SLEEP", bar_graph_tile_time_display: "1:00", bar_graph: { time_bound_ranges: [{ lower_endpoint: 0.25, upper_endpoint: 0.375 }, { lower_endpoint: 0.9, upper_endpoint: 1.1 }] } },
    { id: "HIGH_STRESS", bar_graph_tile_time_display: "0:30", bar_graph_tile_percentage_display: "6%", bar_graph: { time_bound_ranges: [{ lower_endpoint: 0, upper_endpoint: 0.06 }] } },
  ] } }] });
  assert.equal(result.intervals.length, 2);
  assert.equal(result.intervals[0].end, "2026-10-07T03:00:00.000Z");
  assert.equal(result.intervals[1].start, "2026-10-07T04:00:00.000Z");
  assert.equal(result.restorativeMs, 7200000);
  assert.equal(result.stress[0].minutes, 30);
});
test("planejamento mantém valores ausentes e calcula horário com virada de dia", () => {
  const plan = parseSleepPlan({ need_breakdown: { total: 28800000, debt: 0 }, recommended_time_in_bed_formatted: { "100": { recommended_time_in_bed: 32400000 } } });
  assert.equal(plan.debtMs, 0);
  assert.equal(plan.strainMs, null);
  assert.equal(plannedBedtime("07:00", plan.goals[0].inBedMs), "22:00");
  assert.equal(plannedBedtime("25:00", 3600000), null);
  assert.equal(plannedBedtime("07:00", null), null);
});
test("força converte libras explícitas e não assume unidades desconhecidas", () => {
  const raw = { weightlifting_cardio_details: { weightlifting_exercises: { tonnage_units_display: "lbs", exercise_summary_carousel: { items: [{ tonnage_display: "1,000" }, { exercise_id: "SQUAT", title_display: "Agachamento", subtitle_display: "3 Sets", tonnage_display: "600", volume_display: "30" }] } } }, strain_breakdown: { msk_percent_display: "74%" } };
  const result = parseStrength(raw);
  assert.equal(result.volumeKg, 453.59237);
  assert.equal(result.exercises[0].sets, 3);
  assert.equal(result.muscularPercent, 74);
  assert.equal(parseStrength({ weightlifting_cardio_details: { weightlifting_exercises: { exercise_summary_carousel: { items: [{ tonnage_display: "1000" }] } } } }).volumeKg, null);
});
test("histórico por série distingue peso de duração e preserva zero", () => {
  const result = parseExerciseHistory({ items: [{ content: { header_content: { content: { record_date: "2026-10-07" } }, expanded_content: [{ type: "EXERCISE_BREAKDOWN", content: { rows: [{ items: [{ value: 10 }, { value: 0, units: "kg" }] }, { items: [{ value: 1 }, { value: 60, units: "sec" }] }] } }] } }] });
  assert.equal(result[0].sets[0].weight, 0);
  assert.equal(result[0].sets[1].weight, null);
  assert.equal(result[0].sets[1].seconds, 60);
});
