import "server-only";
import { resolve } from "node:path";
import { StressClient } from "./stress-client";
import { client } from "./api/client";
import { historicalStressEnd, object } from "./stress";
import { dateKey } from "./period";
import { requireOwner } from "./auth-server";

let instance: StressClient | undefined;
export async function stressClient(): Promise<StressClient> {
  await requireOwner();
  instance ??= new StressClient({
    file: process.env.WHOOP_STRESS_STORE ?? resolve(process.cwd(), "../data/stress.enc"),
    secret: process.env.WHOOP_STATS_ENCRYPTION_KEY ?? "",
    userId: process.env.WHOOP_STATS_WHOOP_USER_ID ?? "",
    windowEnd: async (date, raw, fetchedAt) => {
      const selector = object(object(raw).date_selector);
      if (selector.next_button_date === null) return fetchedAt;
      if (date === dateKey(fetchedAt)) return fetchedAt;
      const result = await client.GET("/api/v1/cycles", { params: { query: { start: date, end: date, limit: 200 } }, cache: "no-store" });
      if (!result.response.ok || !result.data) throw new Error("Não foi possível confirmar as datas do histórico de estresse.");
      return historicalStressEnd(raw, date, result.data.records);
    },
  });
  return instance;
}
