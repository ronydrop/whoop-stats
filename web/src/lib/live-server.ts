import "server-only";
import { stressClient } from "./stress-server";
import { parseLiveHeart, type LiveHeart } from "./whoop-extras";
import type { ExtraView } from "./whoop-extras-server";

export async function liveHeartView(): Promise<ExtraView<LiveHeart>> {
  const view = await (await stressClient()).readPrivate("/health-tab-bff/v1/health-tab", 15_000);
  return { ...view, data: view.data === null ? null : parseLiveHeart(view.data, new Date().toISOString()) };
}
