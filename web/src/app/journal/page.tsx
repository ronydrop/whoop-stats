import Link from "next/link";
import { ExtraDayFilter, ExtraStatus } from "@/components/extra-status";
import { MetricCard } from "@/components/metric-card";
import { readExtra } from "@/lib/whoop-extras-server";
import { parseImpacts, parseJournal, parseImpactDetail } from "@/lib/whoop-extras";
import { dateKey, type SearchParams } from "@/lib/period";
import { validStressDate } from "@/lib/stress";
import { formatNumber, formatRecordInterval, formatTime } from "@/lib/format";

export const dynamic = "force-dynamic";
export default async function JournalPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const params = await searchParams, today = dateKey(new Date());
  const day = validStressDate(params.day ?? params.end) && String(params.day ?? params.end) <= today ? String(params.day ?? params.end) : today;
  const journal = await readExtra(`/journal-service/v3/journals/drafts/mobile/${day}`, parseJournal);
  const impacts = await readExtra("/behavior-impact-service/v1/impact", parseImpacts, 300_000);
  const chosen = impacts.data?.find(item => item.id === params.impact && item.sufficient);
  const detail = chosen ? await readExtra(`/behavior-impact-service/v2/impact/details/${chosen.id}`, parseImpactDetail, 300_000) : null;
  return <div className="dashboard-page">
    <header><span className="page-kicker">SEU PAINEL WHOOP</span><h1 className="text-2xl font-semibold tracking-tight">Diário</h1><p className="mt-1 text-sm text-text-secondary">Seus hábitos registrados e suas associações com a recuperação.</p></header>
    <ExtraDayFilter key={day} date={day} today={today} pathname="/journal" />
    <ExtraStatus view={journal} />
    <section className="space-y-4"><div className="section-heading"><div><h2>Hábitos registrados</h2><p>{journal.data?.start ? `Ciclo: ${formatRecordInterval(journal.data.start, journal.data.end)}` : "O Diário da WHOOP acompanha o ciclo, que pode atravessar dias."}</p></div></div>
      {journal.data?.entries.length ? <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">{journal.data.entries.map(entry => <MetricCard key={entry.id} title={entry.name} value={entry.answer === true ? "Sim" : entry.answer === false ? "Não" : "Sem resposta"} subtitle={entry.answer === true ? [entry.detail ?? (entry.amount !== null ? formatNumber(entry.amount, 1) : null), entry.time ? Number.isFinite(Date.parse(entry.time)) ? `às ${formatTime(entry.time)}` : entry.time : null].filter(Boolean).join(" · ") || "Registrado no aplicativo" : "Resposta recebida da WHOOP"} description="Resposta registrada no Diário para este ciclo. Não ter resposta é diferente de responder não." />)}</div> : <p className="glass-card p-6 text-sm text-text-secondary">Nenhum hábito respondido foi disponibilizado para este ciclo.</p>}
    </section>
    <section className="space-y-4"><div className="section-heading"><div><h2>Impacto dos hábitos</h2><p>Associações calculadas pela WHOOP. Elas não demonstram que um hábito causou a mudança.</p></div></div>
      <ExtraStatus view={impacts} />
      {impacts.data?.some(item => item.sufficient) ? <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">{impacts.data.filter(item => item.sufficient).map(item => <Link key={item.id} href={`/journal?day=${day}&impact=${item.id}`} className="block rounded-3xl focus-visible:outline-2 focus-visible:outline-accent-hover"><MetricCard title={item.name} value={item.display ?? "—"} subtitle="Ver detalhes da associação com a recuperação" accentColor={item.direction === "POSITIVE" ? "green" : item.direction === "NEGATIVE" ? "red" : "none"} /></Link>)}</div> : <p className="glass-card p-5 text-sm text-text-secondary">{impacts.data ? "Ainda não há registros suficientes para calcular os impactos. A WHOOP precisa de pelo menos cinco respostas ‘sim’ e cinco ‘não’ para um hábito." : "Os impactos dos hábitos não estão disponíveis nesta consulta."}</p>}
      {!!impacts.data?.filter(item => !item.sufficient).length && <details className="glass-card p-4 text-sm"><summary className="cursor-pointer text-text-secondary">Hábitos aguardando mais registros</summary><ul className="mt-4 grid gap-3 sm:grid-cols-2">{impacts.data.filter(item => !item.sufficient).map(item => <li key={item.id} className="flex flex-wrap justify-between gap-2"><span>{item.name}</span><span className="text-text-muted">{item.yes === null || item.no === null ? "Registros insuficientes" : `${item.yes} sim · ${item.no} não`}</span></li>)}</ul></details>}
      {chosen && detail && <div className="glass-card space-y-4 p-5"><h3 className="text-sm font-semibold">{chosen.name}</h3><ExtraStatus view={detail} /><div className="grid gap-4 sm:grid-cols-3">{detail.data?.map(metric => <MetricCard key={metric.name} title={metric.name} value={`${metric.value > 0 ? "+" : ""}${formatNumber(metric.value, 1)}${metric.unit}`} subtitle="Associação informada pela WHOOP" />)}</div></div>}
    </section>
  </div>;
}
