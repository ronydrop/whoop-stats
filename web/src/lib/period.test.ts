import test from "node:test";
import assert from "node:assert/strict";
import { dateKey, resolvePeriod, overlapsPeriod, readPeriodRecords, periodQuery } from "./period.ts";

const now = new Date("2026-10-07T18:00:00Z");
const day = resolvePeriod({ start: "2026-10-06", end: "2026-10-06" }, now);

test("valida datas e usa o calendário de Brasília", () => {
  assert.equal(dateKey("2026-10-07T02:59:59Z"), "2026-10-06");
  assert.equal(dateKey("2026-10-07T03:00:00Z"), "2026-10-07");
  assert.equal(resolvePeriod({}, now).start, "2026-09-08");
  assert.ok(resolvePeriod({ start: "2026-02-30", end: "2026-10-07" }, now).error);
  assert.ok(resolvePeriod({ start: "2026-10-07", end: "2026-10-06" }, now).error);
  assert.ok(resolvePeriod({ start: ["2026-10-06"], end: "2026-10-07" }, now).error);
  assert.ok(resolvePeriod({ start: "2026-10-08", end: "2026-10-08" }, now).error);
});

test("o dia 6 inclui o ciclo iniciado no dia 5 e encerrado no dia 7", () => {
  assert.equal(overlapsPeriod({ start_time: "2026-10-05T18:00:00.000Z", end_time: "2026-10-07T08:00:00.000Z" }, day, now), true);
  assert.equal(overlapsPeriod({ start_time: "2026-10-04T03:00:00Z", end_time: "2026-10-06T03:00:00Z" }, day, now), false);
  assert.equal(overlapsPeriod({ start_time: "2026-10-07T08:00:00Z" }, day, now), false);
});

test("consulta todas as páginas e preserva intervalos longos anteriores à página atual", async () => {
  let calls = 0;
  const recent = Array.from({ length: 200 }, (_, i) => ({ start_time: new Date(Date.parse("2026-10-06T20:00:00Z") - i * 60000).toISOString(), end_time: "2026-10-06T21:00:00Z" }));
  const older = { start_time: "2026-10-05T18:00:00Z", end_time: "2026-10-07T08:00:00Z" };
  const records = await readPeriodRecords(async (cursor, limit) => {
    assert.equal(limit, 200);
    if (calls++ === 0) return { records: recent, next_cursor: "cursor-opaco" };
    assert.equal(cursor, "cursor-opaco");
    return { records: [older], next_cursor: null };
  }, day);
  assert.equal(records.length, 201);
  assert.equal(calls, 2);
});

test("recuperações são pontuais e períodos sem registros permanecem vazios", async () => {
  const records = [{ start_time: "2026-10-06T03:00:00Z" }, { start_time: "2026-10-07T02:59:59Z" }, { start_time: "2026-10-07T03:00:00Z" }];
  assert.equal((await readPeriodRecords(async () => ({records: records.slice(0, 2), next_cursor: null}), day)).length, 2);
  assert.deepEqual(await readPeriodRecords(async () => ({records: [], next_cursor: null}), day), []);
});

test("restaura seleção completa e respeita ano bissexto e virada do ano", () => {
 const selection = resolvePeriod({start: "2026-10-01", end: "2026-10-07", first: "2026-10-06", compare: "2026-10-05"}, now);
 assert.equal(selection.singleDay, false);
 assert.equal(periodQuery(selection), "start=2026-10-01&end=2026-10-07&first=2026-10-06&compare=2026-10-05");
 assert.equal(resolvePeriod({start: "2024-02-29", end: "2024-03-01"}, now).error, undefined);
 assert.equal(resolvePeriod({start: "2025-12-31", end: "2026-01-01"}, now).error, undefined);
 assert.ok(resolvePeriod({start: "2025-02-29", end: "2025-03-01"}, now).error);
});

test("comparação preserva o período completo e exige dois dias dentro dele", () => {
 const period = resolvePeriod({ start: "2026-10-01", end: "2026-10-07", first: "2026-10-06", compare: "2026-10-05" }, now);
 assert.equal(period.start, "2026-10-01");
 assert.equal(period.end, "2026-10-07");
 assert.equal(period.singleDay, false);
 assert.equal(period.first, "2026-10-06");
 assert.equal(period.compare, "2026-10-05");
 assert.ok(resolvePeriod({start: "2026-10-01", end: "2026-10-07", first: "2026-09-30", compare: "2026-10-05"}, now).error);
 assert.ok(resolvePeriod({start: "2026-10-01", end: "2026-10-07", first: "2026-10-06"}, now).error);
 assert.ok(resolvePeriod({start: "2026-10-01", end: "2026-10-07", compare: "2026-10-05"}, now).error);
 assert.equal(periodQuery({start: period.start, end: period.end}), "start=2026-10-01&end=2026-10-07");
});
test("interrompe paginação quando o servidor repete o cursor", async () => {
 await assert.rejects(readPeriodRecords(async () => ({records: [], next_cursor: "igual"}), day), /não avançou/);
});
