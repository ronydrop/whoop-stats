import { ExtraDayFilter } from "@/components/extra-status";
import { ExtraTrendChart, TrendWindows } from "@/components/extra-trends";
import { readExtra } from "@/lib/whoop-extras-server";
import { parseTrends, vo2Calibration, type TrendWindow } from "@/lib/whoop-extras";
import { dateKey, type SearchParams } from "@/lib/period";
import { validStressDate } from "@/lib/stress";

export const dynamic = "force-dynamic";
export default async function FitnessPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const params = await searchParams, today = dateKey(new Date());
  const day = validStressDate(params.day ?? params.end) && String(params.day ?? params.end) <= today ? String(params.day ?? params.end) : today;
  const window: TrendWindow = params.window === "week" || params.window === "six_month" ? params.window : "month";
  const view = await readExtra(`/progression-service/v3/trends/VO2_MAX?endDate=${day}`, raw => ({ trends: parseTrends(raw, "VO2_MAX", day), calibration: vo2Calibration(raw) }), 300_000);
  return <div className="dashboard-page">
    <header><span className="page-kicker">SEU PAINEL WHOOP</span><h1 className="text-2xl font-semibold tracking-tight">Condicionamento</h1><p className="mt-1 text-sm text-text-secondary">Acompanhe a evolução da sua capacidade cardiorrespiratória.</p></header>
    <ExtraDayFilter date={day} today={today} pathname="/fitness" key={day} />
    <TrendWindows pathname="/fitness" end={day} selected={window} />
    {view.data?.calibration && <p role="status" className="glass-card p-4 text-sm text-text-secondary">{view.data.calibration}</p>}
    <ExtraTrendChart title="Evolução do VO₂ Max" description="Estimativas e medições disponibilizadas pela WHOOP até o dia selecionado." window={window} view={{ ...view, data: view.data?.trends ?? null }} />
  </div>;
}
