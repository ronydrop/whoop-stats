type NumericRecord = { [key: string]: unknown };
export function metric(record: NumericRecord | undefined, key: string): number | null {
  if (!record || record.score_state !== "SCORED") return null;
  const value = record[key];
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}
export function sumAvailable(values: (number | null | undefined)[]): number | null {
  const present = values.filter((v): v is number => v != null && Number.isFinite(v));
  return present.length ? present.reduce((a, b) => a + b, 0) : null;
}
function completeSum(record: NumericRecord, keys: string[]): number | null {
  const values = keys.map(key => record[key]);
  return values.every((v): v is number => typeof v === "number" && Number.isFinite(v)) ? values.reduce((a, b) => a + b, 0) : null;
}
export function sleepNeed(record: NumericRecord): number | null {
  return sleepNeedAssessment(record).value;
}
export function sleepNeedAssessment(record: NumericRecord): { value: number | null; reason: string | null } {
  const total = completeSum(record, ["baseline_milli", "sleep_debt_milli", "need_from_recent_strain_milli", "need_from_recent_nap_milli"]);
  if (total == null) return { value: null, reason: "A WHOOP não forneceu todos os componentes necessários para este cálculo." };
  if (total < 0) return { value: null, reason: "O crédito de cochilos informado pela WHOOP supera a soma de sono base, dívida e esforço. O resultado seria negativo e não permite mostrar uma duração válida." };
  return { value: total, reason: null };
}
export function sleepDuration(record: NumericRecord): number | null {
  return completeSum(record, ["total_light_sleep_time_milli", "total_rem_sleep_time_milli", "total_slow_wave_sleep_time_milli"]);
}

export function sleepSummary(records: NumericRecord[]) {
  const measured = records.flatMap(record => {
    const duration = record.score_state === "SCORED" ? sleepDuration(record) : null;
    return duration != null && duration >= 0 ? [{ nap: record.nap, duration }] : [];
  });
  return {
    totalMs: sumAvailable(measured.map(r => r.duration)),
    primaryMs: sumAvailable(measured.filter(r => r.nap === false).map(r => r.duration)),
    napMs: sumAvailable(measured.filter(r => r.nap === true).map(r => r.duration)),
    unclassifiedMs: sumAvailable(measured.filter(r => r.nap == null).map(r => r.duration)),
    measuredCount: measured.length,
    recordCount: records.length,
  };
}

export function isStrengthSport(name: unknown): boolean {
  return typeof name === "string" && ["weightlifting", "weightlifting-msk", "powerlifting", "strength-trainer", "strength-training", "traditional-strength-training", "functional-strength-training"].includes(name.trim().toLowerCase().replace(/[ _]+/g, "-"));
}
export function workoutSummary(records: NumericRecord[]) {
  const strength = records.filter(record => isStrengthSport(record.sport_name));
  const durations = strength.map(record => {
    if (typeof record.start_time !== "string" || typeof record.end_time !== "string") return null;
    const duration = Date.parse(record.end_time) - Date.parse(record.start_time);
    return Number.isFinite(duration) && duration >= 0 ? duration : null;
  });
  const zones = (keys: string[]) => records.map(record => {
    if (record.score_state !== "SCORED") return null;
    const values = keys.map(key => metric(record, key));
    return values.every((value): value is number => value != null && value >= 0) ? values.reduce((a, b) => a + b, 0) : null;
  });
  const low = zones(["zone_one_milli", "zone_two_milli", "zone_three_milli"]);
  const high = zones(["zone_four_milli", "zone_five_milli"]);
  return {
    strengthMs: sumAvailable(durations), strengthCount: strength.length, strengthMeasured: durations.filter(v => v != null).length,
    zonesLowMs: sumAvailable(low), zonesLowMeasured: low.filter(v => v != null).length,
    zonesHighMs: sumAvailable(high), zonesHighMeasured: high.filter(v => v != null).length,
    workoutCount: records.length,
  };
}
