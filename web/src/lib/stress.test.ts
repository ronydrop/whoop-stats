import test from "node:test";
import assert from "node:assert/strict";
import { historicalStressEnd, parseStress, stressChartPoints, validStressDate } from "./stress.ts";

export function stressFixture() {
  return {
    gauge: { gauge_score_display: "0.0" }, stress_state: "RELAXED", calibration_text_display: null,
    stress_graph: { graph: { plots: [{ plot: { segments: [{ points: [
      { position_x: 0, data_scrubber_details: { primary_contextual_display: "12:00 AM", value_display: "0.0" } },
      { position_x: 2 / 1440, data_scrubber_details: { primary_contextual_display: "12:02 AM", value_display: "2.4" } },
      { position_x: 4 / 1440, data_scrubber_details: { primary_contextual_display: "12:04 AM", value_display: "--" } },
      { position_x: 780 / 1440, data_scrubber_details: { primary_contextual_display: "1:00 PM", value_display: "1.2" } },
    ] }] } }] } },
  };
}

test("estresse mantém zero, lacunas, escala e horários de 12 horas", () => {
  const day = parseStress(stressFixture(), "2026-10-08", "2026-10-08T18:00:00Z");
  assert.equal(day.score, 1.2);
  assert.equal(day.min, 0);
  assert.equal(day.peak, 2.4);
  assert.deepEqual(day.points, [{ minute: 0, level: 0 }, { minute: 2, level: 2.4 }, { minute: 4, level: null }, { minute: 780, level: 1.2 }]);
  assert.equal(stressChartPoints(day.points)[3].level, null);
});

test("ausência de amostras e calibração não viram zero", () => {
  const day = parseStress({ stress_state: "CALIBRATING" }, "2026-10-08", "2026-10-08T18:00:00Z");
  assert.equal(day.calibrating, true);
  assert.equal(day.min, null);
  assert.equal(day.peak, null);
  assert.equal(day.score, null);
  assert.throws(() => parseStress({ unexpected: true }, "2026-10-08", "2026-10-08T18:00:00Z"), /formato/);
});

test("ordena e deduplica horários, descarta valores fora da escala sem perder os picos", () => {
  const raw = stressFixture();
  const points = raw.stress_graph.graph.plots[0].plot.segments[0].points;
  points.push(...[
    ["00:02", "--", 2], ["14:00", "9.0", 840], ["24:80", "1.2", 1440], ["12:00 PM", "3.0", 720],
  ].map(([time, value, position]) => ({ position_x: Number(position) / 1440, data_scrubber_details: { primary_contextual_display: String(time), value_display: String(value) } })));
  const day = parseStress(raw, "2026-10-08", "2026-10-08T18:00:00Z");
  assert.equal(day.points.length, 6);
  assert.equal(day.points.find(p => p.minute === 2)?.level, 2.4);
  assert.equal(day.points.find(p => p.minute === 840)?.level, null);
  assert.equal(day.peak, 3);
});

test("rejeita datas impossíveis e caminhos que não são datas", () => {
  assert.equal(validStressDate("2026-02-30"), false);
  assert.equal(validStressDate("../../users"), false);
  assert.equal(validStressDate("2026-10-08"), true);
});

function spanningFixture(clocks: [string, string][]) {
  return {
    stress_state: "CALIBRATING", gauge: { gauge_score_display: "2.9" },
    extended24_hour_graph: { graph: { plots: [{ plot: { segments: [{ points: clocks.map(([time, value], index) => ({
      position_x: index / Math.max(1, clocks.length - 1),
      data_scrubber_details: { primary_contextual_display: time, value_display: value },
    })) }] } }] } },
  };
}

test("a madrugada não recebe leituras da tarde de ontem nem o pico de outro dia", () => {
  const raw = spanningFixture([["12:52", "2.3"], ["23:59", "2.9"], ["00:00", "0.6"], ["00:27", "1.2"]]);
  const day = parseStress(raw, "2026-10-08", "2026-10-08T04:20:00Z");
  assert.deepEqual(day.points, [{ minute: 0, level: 0.6 }, { minute: 27, level: 1.2 }]);
  assert.equal(day.peak, 1.2);
  assert.equal(day.score, 1.2);
});

test("usa o gráfico completo para recuperar a manhã que não existe no gráfico parcial", () => {
  const raw = { ...spanningFixture([["00:00", "0.2"], ["09:00", "2.4"], ["13:00", "1.0"]]), stress_graph: { graph: { plots: [] } } };
  const day = parseStress(raw, "2026-10-08", "2026-10-08T18:00:00Z");
  assert.equal(day.points.length, 3);
  assert.equal(day.peak, 2.4);
});

test("a virada do ano preserva a data e nunca atribui o último horário futuro a hoje", () => {
  const day = parseStress(spanningFixture([["23:50", "2.8"], ["23:59", "2.9"]]), "2027-01-01", "2027-01-01T03:05:00Z");
  assert.equal(day.points.length, 0);
  assert.equal(day.peak, null);
  assert.equal(day.score, null);
});

test("um ciclo de 30 horas distribui as amostras em três datas sem misturar horários repetidos", () => {
  const raw = { ...spanningFixture([["22:17", "2.8"], ["00:01", "0.5"], ["18:00", "1.3"], ["23:55", "1.5"], ["04:52", "2.0"]]), last_updated_display: "04:52" };
  const end = historicalStressEnd(raw, "2026-10-06", [{ start_time: "2026-10-05T22:12:00-03:00", end_time: "2026-10-07T04:53:00-03:00" }]);
  const day = parseStress(raw, "2026-10-06", "2026-10-08T04:20:00Z", end);
  assert.deepEqual(day.points, [{ minute: 1, level: 0.5 }, { minute: 1080, level: 1.3 }, { minute: 1435, level: 1.5 }]);
  assert.equal(day.peak, 1.5);
  assert.equal(day.score, 1.5);
});

test("um histórico sem referência temporal confirmada falha em vez de inventar a data", () => {
  assert.throws(() => historicalStressEnd({ last_updated_display: "04:52" }, "2026-10-06", []), /confirmar as datas/);
});
