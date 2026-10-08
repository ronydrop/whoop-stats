import { readExtra } from "@/lib/whoop-extras-server";
import { parseSleepExtra, parseSleepPlan } from "@/lib/whoop-extras";
import { ExtraStatus } from "./extra-status";
import { Hypnogram, SleepPlanning } from "./sleep-planning";
import { MetricCard } from "./metric-card";
import { formatDuration, formatNumber } from "@/lib/format";
import { object } from "@/lib/stress";

export async function SleepExtras({ date, activityId }: { date: string; activityId: string }) {
  const view = await readExtra(`/home-service/v1/deep-dive/sleep/last-night?date=${date}`, raw => {
    const parsed = parseSleepExtra(raw);
    const parameters = object(object(object(object(raw).header_section).destination).parameters);
    if (parameters.activity_id !== activityId) throw new Error("Sono diferente");
    return parsed;
  }, 300_000);
  return <section className="space-y-4">
    <div className="section-heading"><div><h2>Fases do sono por horário</h2><p>Quando ocorreram os períodos acordado, REM, leve e profundo no sono principal mostrado acima.</p></div></div>
    <ExtraStatus view={view} />
    <div className="glass-card p-4 sm:p-5">{view.data?.intervals.length ? <Hypnogram data={view.data} /> : <p className="py-6 text-sm text-text-secondary">A WHOOP não disponibilizou a sequência das fases deste sono.</p>}</div>
    <div className="section-heading"><div><h2>Estresse durante este sono</h2><p>Distribuição informada pela WHOOP para o mesmo registro.</p></div></div>
    <div className="grid gap-4 sm:grid-cols-3">{view.data?.stress.length ? view.data.stress.map(band => <MetricCard key={band.label} title={`Estresse ${band.label.toLowerCase()}`} value={band.percent === null ? "—" : `${formatNumber(band.percent)}%`} subtitle={band.minutes === null ? "Duração não disponível" : formatDuration(band.minutes * 60_000)} description="Parcela do sono que a WHOOP classificou nesta faixa de estresse fisiológico. O percentual e a duração vêm do registro de sono." />) : <p className="text-sm text-text-secondary">Distribuição de estresse no sono não disponível.</p>}</div>
    {view.data?.restorativeMs != null && <MetricCard title="Sono restaurador" value={formatDuration(view.data.restorativeMs)} subtitle="Soma do sono REM e profundo deste registro" description="Tempo total nas fases REM e profunda. A WHOOP chama essa soma de sono restaurador." accentColor="violet" />}
  </section>;
}

export async function SleepPlanner() {
  const view = await readExtra("/coaching-service/v2/sleepneed", parseSleepPlan, 60_000);
  return <section className="space-y-4">
    <div className="section-heading"><div><h2>Planejar o próximo sono</h2><p>Necessidade atual calculada pela WHOOP e horário para atingir sua meta.</p></div></div>
    <ExtraStatus view={view} />
    {view.data ? <SleepPlanning plan={view.data} /> : <p className="glass-card p-5 text-sm text-text-secondary">O planejamento será exibido quando a WHOOP disponibilizar a necessidade atual de sono.</p>}
  </section>;
}
