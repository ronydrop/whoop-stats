import { test } from "node:test";
import assert from "node:assert/strict";
import { formatNumber, formatTime, formatFullDate, formatCalories, formatDistance, getRecoveryColor, kjToCal } from "./format.ts";
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

test("modalidades conhecidas são traduzidas sem alterar identificadores desconhecidos", () => {
  assert.equal(sportLabel("Weightlifting"), "Musculação");
  assert.equal(sportLabel("Functional Fitness"), "Treino funcional");
  assert.equal(sportLabel("Modalidade pessoal"), "Modalidade pessoal");
});
