import test from "node:test";
import assert from "node:assert/strict";
import { chartTimeline, visibleRecord } from "./chart-timeline.ts";

const updatedAt = "2026-10-08T02:00:00Z";
const selection = { start: "2026-10-01", end: "2026-10-07" };
test("o eixo semanal inclui o dia 6 mesmo sem registro iniciado nesse dia", () => {
  const axis = chartTimeline(selection);
  assert.equal(axis.ticks.length, 7);
  assert.ok(axis.ticks.includes(Date.parse("2026-10-06T15:00:00Z")));
  assert.ok(axis.boundaries.includes(Date.parse("2026-10-06T03:00:00Z")));
  assert.equal(axis.start, Date.parse("2026-10-01T03:00:00Z"));
  assert.equal(axis.end, Date.parse("2026-10-08T03:00:00Z"));
});
test("um ciclo atravessa o dia 6 sem dividir seu valor", () => {
  const day = { ...selection, start: "2026-10-06", end: "2026-10-06" };
  const record = { date: "2026-10-05T18:07:00Z", end: "2026-10-07T07:53:00Z", value: 16.5 };
  assert.deepEqual(visibleRecord(record, day, true), { start: Date.parse("2026-10-06T03:00:00Z"), end: Date.parse("2026-10-07T03:00:00Z"), value: 16.5, clipped: true });
});
test("pontos de outro dia e ausência não geram barras; zero é preservado", () => {
  const day = { ...selection, start: "2026-10-06", end: "2026-10-06" };
  assert.equal(visibleRecord({ date: "2026-10-05T21:06:00Z", value: 10 }, day, false), null);
  assert.equal(visibleRecord({ date: "2026-10-06T12:00:00Z", value: null }, day, false), null);
  assert.equal(visibleRecord({ date: "2026-10-06T12:00:00Z", value: 0 }, day, false)?.value, 0);
});
test("ciclo aberto termina no instante conhecido, nunca no futuro", () => {
  const record = visibleRecord({ date: "2026-10-07T07:53:00Z", end: null, updatedAt, value: 13.7 }, selection, true);
  assert.equal(record?.end, Date.parse(updatedAt));
});
test("limites exclusivos, ano bissexto e períodos longos mantêm eixo válido", () => {
  assert.equal(visibleRecord({ date: "2026-10-08T03:00:00Z", value: 42 }, selection, false), null);
  assert.equal(visibleRecord({ date: "2026-09-30T03:00:00Z", end: "2026-10-01T03:00:00Z", value: 4 }, selection, true), null);
  const leap = chartTimeline({ ...selection, start: "2024-02-28", end: "2024-03-01" });
  assert.equal(leap.ticks.length, 3);
  const long = chartTimeline({ ...selection, start: "2026-01-01", end: "2026-12-31" });
  assert.ok(long.ticks.length <= 10);
  assert.equal(long.ticks.at(-1), Date.parse("2026-12-31T15:00:00Z"));
});
