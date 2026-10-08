import test from "node:test";
import assert from "node:assert/strict";
import { compareDays, type DayRecords } from "./comparison.ts";
import type { Cycle, Sleep } from "./types";

const cycle: Cycle = { id: 1, user_id: "teste", start_time: "2026-10-05T18:07:00Z", end_time: "2026-10-07T07:53:00Z", strain: 10, kilojoule: 12000, step_count: null, average_heart_rate: null, max_heart_rate: null, score_state: "SCORED", timezone_offset: null, created_at: "2026-10-05T18:07:00Z", updated_at: "2026-10-07T07:53:00Z" };
const empty: DayRecords = { cycles: [], sleeps: [], recoveries: [], workouts: [] };
test("dois dias do mesmo ciclo não ganham diferença diária fictícia", () => {
 const records = { ...empty, cycles: [cycle] };
 const comparison = compareDays(records, records, "2026-10-06", "2026-10-07");
 assert.equal(comparison.sameCycle, true);
 assert.equal(comparison.rows[0].comparable, false);
 assert.equal(comparison.rows[0].a, 10);
});
test("ausência e múltiplos ciclos não geram esforço diário somado", () => {
 const result = compareDays(empty, {...empty, cycles: [cycle, {...cycle, id: 2}]}, "2026-10-04", "2026-10-06");
 assert.equal(result.rows[0].a, null);
 assert.equal(result.rows[0].b, null);
 assert.equal(result.rows[1].a, null);
});

test("comparação conta cochilos pelo término sem criar recuperação", () => {
 const nap: Sleep = {
  id: "cochilo", user_id: "teste", cycle_id: 1, nap: true, score_state: "SCORED",
  start_time: "2026-10-05T23:00:00Z", end_time: "2026-10-06T10:00:00Z", created_at: "2026-10-06T10:00:00Z", updated_at: "2026-10-06T10:00:00Z", timezone_offset: null,
  total_light_sleep_time_milli: 3600000, total_rem_sleep_time_milli: 1800000, total_slow_wave_sleep_time_milli: 1800000,
  total_awake_time_milli: null, total_in_bed_time_milli: null, total_no_data_time_milli: null, baseline_milli: null, disturbance_count: null,
  need_from_recent_nap_milli: null, need_from_recent_strain_milli: null, performance_score: null, respiratory_rate: null,
  sleep_consistency_percentage: null, sleep_cycle_count: null, sleep_debt_milli: null, sleep_efficiency_percentage: null,
 };
 const a = { ...empty, sleeps: [nap, { ...nap, id: "principal", nap: false }] };
 const b = { ...empty, sleeps: [{ ...nap, end_time: "2026-10-07T10:00:00Z" }] };
 const comparison = compareDays(a, b, "2026-10-06", "2026-10-07");
 assert.equal(comparison.rows[3].a, 240);
 assert.equal(comparison.rows[3].b, 120);
 assert.equal(comparison.rows[3].comparable, true);
 assert.equal(comparison.rows[1].a, null);
 const previous = compareDays(a, empty, "2026-10-05", "2026-10-07");
 assert.equal(previous.rows[3].a, null);
 const partial = compareDays({ ...a, sleeps: [...a.sleeps, { ...nap, id: "pendente", score_state: "PENDING_SCORE" }] }, b, "2026-10-06", "2026-10-07");
 assert.equal(partial.rows[3].a, 240);
 assert.equal(partial.rows[3].comparable, false);
});
