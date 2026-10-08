import { dateKey } from "./period.ts";
import { metric, sleepSummary } from "./metrics.ts";
import type { Cycle, Sleep, Workout, Recovery } from "./types";

export type DayRecords = { cycles: Cycle[]; sleeps: Sleep[]; workouts: Workout[]; recoveries: Recovery[] };
export function compareDays(a: DayRecords, b: DayRecords, dayA: string, dayB: string) {
  const sameCycle = a.cycles.some(x => b.cycles.some(y => x.id === y.id));
  const recovery = (records: Recovery[], day: string, key: string) => {
    const matching = records.filter(r => r.reference_time && dateKey(r.reference_time) === day);
    return matching.length === 1 ? metric(matching[0], key) : null;
  };
  const sleep = (records: Sleep[], day: string) => sleepSummary(records.filter(r => r.end_time && dateKey(r.end_time) === day));
  const sleepA = sleep(a.sleeps, dayA), sleepB = sleep(b.sleeps, dayB);
  const minutes = (value: number | null) => value == null ? null : value / 60000;
  return {
    sameCycle,
    sleepCoverage: [sleepA, sleepB],
    rows: [
      { label: "Esforço do ciclo completo", unit: "", a: a.cycles.length === 1 ? metric(a.cycles[0], "strain") : null, b: b.cycles.length === 1 ? metric(b.cycles[0], "strain") : null, comparable: !sameCycle },
      { label: "Recuperação (%) · término do sono", unit: "p.p.", a: recovery(a.recoveries, dayA, "recovery_score"), b: recovery(b.recoveries, dayB, "recovery_score"), comparable: true },
      { label: "VFC (ms) · término do sono", unit: "ms", a: recovery(a.recoveries, dayA, "hrv_rmssd_milli"), b: recovery(b.recoveries, dayB, "hrv_rmssd_milli"), comparable: true },
      { label: "Tempo dormido total, incluindo cochilos (min)", unit: "min", a: minutes(sleepA.totalMs), b: minutes(sleepB.totalMs), comparable: sleepA.measuredCount === sleepA.recordCount && sleepB.measuredCount === sleepB.recordCount },
      { label: "Treinos iniciados no dia", unit: "treinos", a: a.workouts.filter(w => dateKey(w.start_time) === dayA).length, b: b.workouts.filter(w => dateKey(w.start_time) === dayB).length, comparable: true },
      { label: "Energia do ciclo completo (kcal)", unit: "kcal", a: a.cycles.length === 1 && metric(a.cycles[0], "kilojoule") != null ? a.cycles[0].kilojoule! / 4.184 : null, b: b.cycles.length === 1 && metric(b.cycles[0], "kilojoule") != null ? b.cycles[0].kilojoule! / 4.184 : null, comparable: !sameCycle },
    ],
  };
}
