import { test } from "node:test";
import assert from "node:assert/strict";
import { formatNumber, formatTime, formatFullDate, formatCalories, formatDistance } from "./format.ts";
import { sportLabel } from "./sports.ts";

test("números e unidades usam o padrão brasileiro", () => {
  assert.equal(formatNumber(1234.5, 1), "1.234,5");
  assert.equal(formatDistance(1500), "1,5 km");
  assert.equal(formatCalories(10000), "2.390 Cal");
});

test("datas usam o fuso brasileiro mesmo quando o registro chega em UTC", () => {
  assert.equal(formatTime("2026-10-07T01:30:00Z"), "22:30");
  assert.equal(formatFullDate("2026-10-07T01:30:00Z"), "6 de out. de 2026");
});

test("modalidades conhecidas são traduzidas sem alterar identificadores desconhecidos", () => {
  assert.equal(sportLabel("Weightlifting"), "Musculação");
  assert.equal(sportLabel("Functional Fitness"), "Treino funcional");
  assert.equal(sportLabel("Modalidade pessoal"), "Modalidade pessoal");
});
