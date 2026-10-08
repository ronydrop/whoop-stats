import { NextResponse } from "next/server";
import { liveHeartView } from "@/lib/live-server";

export const dynamic = "force-dynamic";
export async function GET() {
  return NextResponse.json(await liveHeartView(), { headers: { "Cache-Control": "no-store" } });
}
