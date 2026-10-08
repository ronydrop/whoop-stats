import { client } from "./client";
import { readPeriodRecords, type Period } from "../period";
import type { RecordsByResource } from "../types";
import { selectPeriodRecords } from "../record-selection";

export async function periodRecords<R extends keyof RecordsByResource>(resource: R, period: Period): Promise<RecordsByResource[R][]> {
  const records = await readPeriodRecords(async (cursor, limit) => {
    const init = { params: { query: { start: period.start, end: period.end, cursor, limit } }, cache: "no-store" as const };
    const result = resource === "cycles" ? await client.GET("/api/v1/cycles", init)
      : resource === "sleeps" ? await client.GET("/api/v1/sleeps", init)
      : resource === "recoveries" ? await client.GET("/api/v1/recoveries", init)
      : await client.GET("/api/v1/workouts", init);
    if (!result.response.ok || !result.data) throw new Error("Não foi possível carregar o histórico da WHOOP.");
    return result.data as { records: RecordsByResource[R][]; next_cursor: string | null };
  }, period);
  return selectPeriodRecords(resource, records, period);
}
