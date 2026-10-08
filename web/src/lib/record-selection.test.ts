import test from "node:test";
import assert from "node:assert/strict";
import { selectPeriodRecords } from "./record-selection.ts";
import { chartTimeline } from "./chart-timeline.ts";

const period = { start: "2026-10-06", end: "2026-10-06" };
const record = { id: "a", start_time: "2026-10-05T18:07:00Z", end_time: "2026-10-07T07:53:00Z", updated_at: "2026-10-07T08:00:00Z", score_state: "SCORED", strain: 16.5 };
test("o ciclo atravessa o dia 6, mas não cria sono ou treino daquele dia", () => {
  assert.equal(selectPeriodRecords("cycles", [record], period).length, 1);
  assert.equal(selectPeriodRecords("sleeps", [record], period).length, 0);
  assert.equal(selectPeriodRecords("workouts", [record], period).length, 0);
});
test("sono pertence ao dia em que termina e recuperação exige referência fisiológica", () => {
  const overnight = { ...record, end_time: "2026-10-06T09:00:00Z" };
  assert.equal(selectPeriodRecords("sleeps", [overnight], period).length, 1);
  assert.equal(selectPeriodRecords("recoveries", [{ ...record, reference_time: "2026-10-05T21:06:00Z" }], period).length, 0);
  assert.equal(selectPeriodRecords("recoveries", [{ ...record, reference_time: overnight.end_time }], period).length, 1);
  assert.equal(selectPeriodRecords("recoveries", [{ ...record, recorded_at: overnight.end_time }], period).length, 0);
});
test("deduplica correções, ordena pela referência e esconde pontuação pendente", () => {
  const newer = { ...record, updated_at: "2026-10-08T00:00:00Z", score_state: "PENDING_SCORE", strain: 19 };
  const result = selectPeriodRecords("cycles", [record, newer], period);
  assert.equal(result.length, 1);
  assert.equal(result[0].strain, null);
  const sleeps = selectPeriodRecords("sleeps", [{ ...record, id: "1", end_time: "2026-10-06T12:00:00Z" }, { ...record, id: "2", end_time: "2026-10-06T16:00:00Z" }], period);
  assert.equal(sleeps[0].id, "2");
});
test("zero real permanece e término à meia-noite pertence ao próximo dia", () => {
  assert.equal(selectPeriodRecords("cycles", [{ ...record, strain: 0 }], period)[0].strain, 0);
  assert.equal(selectPeriodRecords("sleeps", [{ ...record, end_time: "2026-10-07T03:00:00Z" }], period).length, 0);
});
test("o eixo respeita o horário de verão histórico de Brasília", () => {
  const short = chartTimeline({ start: "2018-11-04", end: "2018-11-04" });
  assert.equal(new Date(short.start).toISOString(), "2018-11-04T03:00:00.000Z");
  assert.equal((short.end - short.start) / 3600000, 23);
  const long = chartTimeline({ start: "2019-02-16", end: "2019-02-16" });
  assert.equal((long.end - long.start) / 3600000, 25);
});
