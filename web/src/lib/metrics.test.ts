import test from "node:test";
import assert from "node:assert/strict";
import { sleepNeed, sleepNeedAssessment, sumAvailable, sleepDuration, sleepSummary, metric, workoutSummary, isStrengthSport } from "./metrics.ts";

test("Strength Trainer reconhece a modalidade muscular da WHOOP", () => {
  assert.equal(isStrengthSport("weightlifting-msk"), true);
  assert.equal(isStrengthSport("Strength Trainer"), true);
  assert.equal(isStrengthSport("running"), false);
});

test("resumo de treinos separa força de outras modalidades e preserva zonas incompletas", () => {
  const base = { start_time: "2026-10-05T10:00:00Z", end_time: "2026-10-05T11:00:00Z", score_state: "SCORED", zone_one_milli: 10, zone_two_milli: 20, zone_three_milli: 30, zone_four_milli: 0, zone_five_milli: 0 };
  const result = workoutSummary([
    { ...base, sport_name: "weightlifting" },
    { ...base, sport_name: "running", zone_three_milli: null, zone_four_milli: 40 },
    { ...base, sport_name: "strength-trainer", score_state: "PENDING_SCORE", end_time: null },
  ]);
  assert.equal(result.strengthMs, 3600000);
  assert.equal(result.strengthMeasured, 1);
  assert.equal(result.strengthCount, 2);
  assert.equal(result.zonesLowMs, 60);
  assert.equal(result.zonesLowMeasured, 1);
  assert.equal(result.zonesHighMs, 40);
  assert.equal(result.zonesHighMeasured, 2);
});

test("sem registro não vira zero e duração inválida não entra nos totais", () => {
  assert.equal(workoutSummary([]).strengthMs, null);
  const result = workoutSummary([{ sport_name: "weightlifting", start_time: "2026-10-05T11:00:00Z", end_time: "2026-10-05T10:00:00Z", score_state: "SCORED" }]);
  assert.equal(result.strengthMs, null);
  assert.equal(result.zonesHighMs, null);
  assert.equal(workoutSummary([{ sport_name: "running" }]).strengthMs, null);
});

test("necessidade soma dívida e o crédito assinado, sem preencher ausências", () => {
  assert.equal(sleepNeed({ baseline_milli: 8, sleep_debt_milli: 2, need_from_recent_strain_milli: 1, need_from_recent_nap_milli: -3 }), 8);
  assert.equal(sleepNeed({ baseline_milli: 8 }), null);
  assert.equal(sleepNeed({ baseline_milli: 0, sleep_debt_milli: 0, need_from_recent_strain_milli: 0, need_from_recent_nap_milli: 0 }), 0);
});
test("necessidade distingue componentes ausentes de crédito maior que a necessidade", () => {
  const negative = { baseline_milli: 8, sleep_debt_milli: 2, need_from_recent_strain_milli: 1, need_from_recent_nap_milli: -17 };
  assert.equal(sleepNeed(negative), null);
  assert.match(sleepNeedAssessment(negative).reason!, /negativo/);
  assert.match(sleepNeedAssessment({ baseline_milli: 8 }).reason!, /não forneceu/);
  assert.deepEqual(sleepNeedAssessment({ ...negative, need_from_recent_nap_milli: -11 }), { value: 0, reason: null });
});
test("ausências e registros pendentes não se tornam zero", () => {
  assert.equal(sumAvailable([]), null);
  assert.equal(sumAvailable([null, 0, 2]), 2);
  assert.equal(sleepDuration({ total_light_sleep_time_milli: 10 }), null);
  assert.equal(metric({ score_state: "PENDING_SCORE", strain: 4 }, "strain"), null);
  assert.equal(metric({ score_state: "SCORED", strain: 0 }, "strain"), 0);
});

test("tempo dormido inclui cochilos e mantém os subtotais separados", () => {
  const sleep = { score_state: "SCORED", total_light_sleep_time_milli: 60, total_rem_sleep_time_milli: 20, total_slow_wave_sleep_time_milli: 20 };
  const result = sleepSummary([{ ...sleep, nap: false }, { ...sleep, nap: true }, { ...sleep, nap: true }, { ...sleep, nap: null }]);
  assert.deepEqual(result, { totalMs: 400, primaryMs: 100, napMs: 200, unclassifiedMs: 100, measuredCount: 4, recordCount: 4 });
  assert.equal(sleepSummary([{ ...sleep, nap: true }]).totalMs, 100);
});

test("total de sono indica cobertura parcial e preserva ausência e zero", () => {
  const zero = { score_state: "SCORED", nap: true, total_light_sleep_time_milli: 0, total_rem_sleep_time_milli: 0, total_slow_wave_sleep_time_milli: 0 };
  assert.equal(sleepSummary([]).totalMs, null);
  const result = sleepSummary([zero, { ...zero, score_state: "PENDING_SCORE" }, { ...zero, total_rem_sleep_time_milli: null }]);
  assert.equal(result.totalMs, 0);
  assert.equal(result.measuredCount, 1);
  assert.equal(result.recordCount, 3);
  assert.equal(result.primaryMs, null);
});
