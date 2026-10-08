import { dateKey, type Period } from "./period.ts";

type RecordDate = { id: string | number; start_time: string; end_time?: string | null; reference_time?: string | null; recorded_at?: string; updated_at: string; score_state: string | null };
type Resource = "cycles" | "sleeps" | "recoveries" | "workouts";
const scoreFields = ["strain", "kilojoule", "average_heart_rate", "max_heart_rate", "recovery_score", "hrv_rmssd_milli", "resting_heart_rate", "spo2_percentage", "skin_temp_celsius", "performance_score", "respiratory_rate", "sleep_efficiency_percentage", "sleep_consistency_percentage", "sleep_debt_milli", "baseline_milli", "need_from_recent_strain_milli", "need_from_recent_nap_milli", "total_light_sleep_time_milli", "total_rem_sleep_time_milli", "total_slow_wave_sleep_time_milli", "total_awake_time_milli", "total_no_data_time_milli", "total_in_bed_time_milli", "sleep_cycle_count", "disturbance_count", "percent_recorded", "distance_meter", "altitude_gain_meter", "altitude_change_meter", "zone_zero_milli", "zone_one_milli", "zone_two_milli", "zone_three_milli", "zone_four_milli", "zone_five_milli"];

export function selectPeriodRecords<T extends RecordDate>(resource: Resource, records: T[], period: Pick<Period, "start" | "end">): T[] {
  const unique = new Map<string, T>();
  for (const record of records) {
    const previous = unique.get(String(record.id));
    if (!previous || Date.parse(record.updated_at) > Date.parse(previous.updated_at)) unique.set(String(record.id), record);
  }
  const reference = (r: T) => resource === "sleeps" ? r.end_time : resource === "recoveries" ? r.reference_time : r.start_time;
  return [...unique.values()].filter(r => {
    if (resource === "cycles") return dateKey(r.start_time) <= period.end && (!r.end_time || dateKey(new Date(Date.parse(r.end_time) - 1)) >= period.start);
    const time = reference(r);
    return !!time && dateKey(time) >= period.start && dateKey(time) <= period.end;
  }).sort((a, b) => Date.parse(reference(b)!) - Date.parse(reference(a)!) || String(b.id).localeCompare(String(a.id)))
    .map(r => r.score_state === "SCORED" ? r : { ...r, ...Object.fromEntries(scoreFields.filter(key => key in r).map(key => [key, null])) });
}
