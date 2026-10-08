import "server-only";
import { stressClient } from "./stress-server";
import type { PrivateView } from "./stress-client";

export type ExtraView<T> = Omit<PrivateView, "data"> & { data: T | null };
export async function readExtra<T>(path: string, parse: (raw: unknown) => T, ttl = 60_000): Promise<ExtraView<T>> {
  const view = await (await stressClient()).readPrivate(path, ttl);
  if (view.data === null) return { ...view, data: null };
  try { return { ...view, data: parse(view.data) }; }
  catch { return { ...view, data: null, message: "O formato destes dados mudou na WHOOP. Não foi possível interpretar esta consulta." }; }
}
