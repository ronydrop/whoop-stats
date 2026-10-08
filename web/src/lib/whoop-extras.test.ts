import test from "node:test";
import assert from "node:assert/strict";
import { parseJournal, parseImpacts, parseImpactDetail, parseTrends, trendDate, vo2Calibration, parseSleepExtra, parseSleepPlan, plannedBedtime, parseLiveHeart, parseStrength, parseExerciseHistory } from "./whoop-extras.ts";

test("mudança de formato não se confunde com ausência de registros", () => {
  for (const parser of [parseJournal, parseImpacts, parseSleepExtra, parseSleepPlan, parseStrength, parseExerciseHistory]) assert.throws(() => parser({}));
  assert.throws(() => parseTrends({}, "STRESS", "2026-10-08"));
  assert.throws(() => parseLiveHeart({}, "2026-10-08T04:40:00Z"));
  assert.deepEqual(parseExerciseHistory({ items: [] }), []);
});

test("Diário diferencia não, sem resposta e zero sem inferir uma quantidade", () => {
  const raw = { journal: { user_reviewed: true, tracked_behaviors: [
    { behavior_tracker: { id: 352, internal_name: "relationship_stress" }, tracker_input: { answered_yes: false } },
    { behavior_tracker: { id: 2, title: "Cafeína" }, tracker_input: { magnitude_input_value: 0 } },
    { behavior_tracker: { id: 4, internal_name: "sexual-activity" }, tracker_input: { answered_yes: true, time_input_value: 1791360000000 } },
    { behavior_tracker: { id: 46, internal_name: "stress" }, tracker_input: { answered_yes: true, magnitude_input_value: 1, magnitude_input_label: "moderate" } },
  ] }, metadata: { journal_bounds: { current_cycle_sleep_lower: "2026-10-07T07:53:00Z" } } };
  const result = parseJournal(raw);
  assert.equal(result.entries[0].answer, false);
  assert.equal(result.entries[0].name, "Estresse no relacionamento");
  assert.equal(result.entries[1].answer, null);
  assert.equal(result.entries[1].amount, 0);
  assert.equal(result.entries[2].name, "Atividade sexual");
  assert.ok(Number.isFinite(Date.parse(result.entries[2].time!)));
  assert.equal(result.entries[3].detail, "Moderado");
  assert.equal(result.end, null);
});
test("impactos insuficientes não viram efeito zero; detalhe lê só métricas próprias", () => {
  const result = parseImpacts({ tiles: [{ type: "INSUFFICIENT_IMPACT_TILE", content: { impact_cards: [{ impact_uuid: "11111111-1111-1111-1111-111111111111", impact_card_title_display: "Stress", impact_style: "INSUFFICIENT" }] } }] });
  assert.equal(result[0].sufficient, false);
  assert.equal(result[0].display, null);
  assert.deepEqual(parseImpactDetail({ card: { title_display: "RECOVERY IMPACT", impact_percentage_value: "+7", impact_percentage_symbol: "%", sub_bar_percent: "+3%" } })[0].value, 7);
});
test("tendências mantêm as três faixas das barras e convertem duração para horas", () => {
  const bar = (category: string, value: string) => ({ data_scrubber_details: { primary_contextual_display: "MON, OCT 5", secondary_contextual_display: category, value_display: value } });
  const result = parseTrends({ week_time_segment: { metrics: [{ current_metric_value: 7680000 }], graph: { plots: [{ type: "BAR_PLOT", plot: { bar_groups: [{ bars: [bar("HIGH STRESS", "1:14"), bar("MEDIUM STRESS", "6:00"), bar("LOW STRESS", "0:00")] }] } }] } } }, "STRESS_DURING_SLEEP", "2026-10-08")[0];
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
test("VO₂ Max não usa o valor padrão da ficha de edição como uma medição", () => {
  const raw = { month_time_segment: { metrics: [{ current_metric_value: null }], graph: { plots: [{ type: "EMPTY_PLOT", plot: {} }] } }, trend_menus: [{ vo2_max_value: 40 }], info_callouts: [{ description: "Your VO₂ Max is calibrating. Log 11 more sleeps on WHOOP." }] };
  assert.equal(parseTrends(raw, "VO2_MAX", "2026-10-08")[0].average, null);
  assert.equal(parseTrends(raw, "VO2_MAX", "2026-10-08")[0].series.length, 0);
  assert.match(vo2Calibration(raw)!, /11 sonos/);
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
test("FC ao vivo não apresenta transmissão ausente ou antiga como leitura atual", () => {
  const raw = { show_live_hr: true, items: [{ type: "LIVE_HR", content: { bpm: 75, zone: 1, updated_at: "2026-10-08T04:40:00Z" } }] };
  assert.equal(parseLiveHeart(raw, "2026-10-08T04:40:15Z").fresh, true);
  assert.equal(parseLiveHeart(raw, "2026-10-08T04:45:00Z").fresh, false);
  assert.equal(parseLiveHeart({ ...raw, show_live_hr: false }, "2026-10-08T04:40:15Z").bpm, null);
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
