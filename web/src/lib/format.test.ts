import { test } from "node:test";
import assert from "node:assert/strict";
import { formatNumber, formatTime, formatFullDate, formatCalories, formatDistance, formatElapsedTime, getRecoveryColor, kjToCal } from "./format.ts";
import { sportLabel } from "./sports.ts";

test("números e unidades usam o padrão brasileiro", () => {
  assert.equal(formatNumber(1234.5, 1), "1.234,5");
  assert.equal(formatDistance(1500), "1,5 km");
  assert.equal(formatCalories(10000), "2.390 kcal");
});

test("preserva zero e não arredonda energia antes de agregar", () => {
  assert.equal(formatCalories(0), "0 kcal");
  assert.equal(kjToCal(1), 1 / 4.184);
});

test("cores respeitam as fronteiras oficiais de recuperação", () => {
  assert.deepEqual([0, 33, 34, 66, 67, 100].map(getRecoveryColor), ["red", "red", "yellow", "yellow", "green", "green"]);
});

test("datas usam o fuso brasileiro mesmo quando o registro chega em UTC", () => {
  assert.equal(formatTime("2026-10-07T01:30:00Z"), "22:30");
  assert.equal(formatTime("2026-10-07T07:53:00Z"), "04:53");
  assert.equal(formatFullDate("2026-10-07T01:30:00Z"), "6 de out. de 2026");
});

test("tempo acordado mostra horas, minutos e segundos sem reiniciar após 24 horas", () => {
  assert.equal(formatElapsedTime(0), "00:00:00");
  assert.equal(formatElapsedTime(3_661_999), "01:01:01");
  assert.equal(formatElapsedTime(59_999), "00:00:59");
  assert.equal(formatElapsedTime(60_000), "00:01:00");
  assert.equal(formatElapsedTime(90_061_000), "25:01:01");
});

test("tempo acordado não inventa duração para horários futuros ou inválidos", () => {
  assert.equal(formatElapsedTime(-1), "—");
  assert.equal(formatElapsedTime(NaN), "—");
  assert.equal(formatElapsedTime(Infinity), "—");
});

test("modalidades conhecidas são traduzidas sem alterar identificadores desconhecidos", () => {
  assert.equal(sportLabel("Weightlifting"), "Musculação");
  assert.equal(sportLabel("Functional Fitness"), "Treino funcional");
  assert.equal(sportLabel("Modalidade pessoal"), "Modalidade pessoal");
});
