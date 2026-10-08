import { NextResponse } from "next/server";
import { liveHeartView } from "@/lib/live-server";

export const dynamic = "force-dynamic";
export async function GET(request: Request) {
  if (!/^(localhost|127\.0\.0\.1)(:\d+)?$/.test(request.headers.get("host") ?? "")) return NextResponse.json({ message: "Abra o painel pelo endereço local." }, { status: 403 });
  return NextResponse.json(await liveHeartView(), { headers: { "Cache-Control": "no-store" } });
}
