import { StressPanel } from "@/components/stress-panel";
import { dateKey, type SearchParams } from "@/lib/period";
import { validStressDate } from "@/lib/stress";
import { stressClient } from "@/lib/stress-server";
import { StressTrends } from "@/components/stress-trends";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export default async function StressPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const params = await searchParams;
  const today = dateKey(new Date());
  const requested = params.day ?? params.end ?? today;
  const valid = validStressDate(requested) && requested <= today;
  const date = valid ? requested : today;
  const view = await (await stressClient()).read(date);
  return <div className="dashboard-page">
    <header><span className="page-kicker">SEU PAINEL WHOOP</span><h1 className="text-2xl font-semibold tracking-tight">Estresse</h1><p className="mt-1 text-sm text-text-secondary">Observe como seu estresse fisiológico varia ao longo do dia.</p></header>
    {!valid && <p role="alert" className="text-sm text-recovery-yellow">A data informada é inválida. Mostrando hoje.</p>}
    <StressPanel key={date} date={date} today={today} view={view} />
    <StressTrends end={date} window={params.window === "month" || params.window === "six_month" ? params.window : "week"} />
  </div>;
}
