import Link from "next/link";
import { RecordChart } from "./record-chart";
import { MetricCard } from "./metric-card";
import { ExtraStatus } from "./extra-status";
import type { ExtraView } from "@/lib/whoop-extras-server";
import type { ExtraTrend, TrendWindow } from "@/lib/whoop-extras";
import { formatDuration, formatNumber } from "@/lib/format";

export function TrendWindows({ pathname, end, selected }: { pathname: string; end: string; selected: TrendWindow }) {
  return <nav aria-label="Janela de tendência" className="flex flex-wrap gap-2">{([{ id: "week", title: "7 dias" }, { id: "month", title: "30 dias" }, { id: "six_month", title: "6 meses" }] as const).map(window =>
    <Link key={window.id} href={`${pathname}?day=${end}&window=${window.id}`} aria-current={window.id === selected ? "page" : undefined} className="rounded-xl border border-border-default px-4 py-2 text-xs text-text-secondary aria-[current=page]:border-accent aria-[current=page]:bg-accent-muted aria-[current=page]:text-accent-hover">{window.title}</Link>)}
  </nav>;
}
export function ExtraTrendChart({ title, description, window, view }: { title: string; description: string; window: TrendWindow; view: ExtraView<ExtraTrend[]> }) {
  const trend = view.data?.find(trend => trend.window === window);
  const points = trend?.series.flatMap(series => series.points).filter(point => point.value !== null) ?? [];
  const value = trend?.average == null ? "—" : trend.unit === "h" ? formatDuration(trend.average * 3_600_000) : `${formatNumber(trend.average, 1)} ${trend.unit}`;
  return <section className="space-y-4">
    <div className="section-heading"><div><h2>{title}</h2><p>{description}</p></div></div>
    <MetricCard title={trend?.unit === "h" ? "Média de tempo em estresse alto" : "VO₂ Max médio"} description={trend?.unit === "h" ? "Média informada pela WHOOP para o tempo em estresse alto dentro desta janela. Dias sem dados não são tratados como zero." : "Estimativa WHOOP da capacidade de utilizar oxigênio durante exercício intenso. Acompanhe sua evolução ao longo do tempo."} value={value} subtitle="Média da janela selecionada · WHOOP" />
    <div className="glass-card p-4 sm:p-5">
      {trend && points.length ? <RecordChart selection={{ start: trend.start, end: trend.end }} series={trend.series.map(series => ({ label: series.label, color: series.color, unit: trend.unit, records: series.points, dateOnly: true }))} height={220} stacked={trend.unit === "h"} /> : <p className="py-8 text-center text-sm text-text-secondary">A WHOOP ainda não disponibilizou medições para esta janela.</p>}
    </div>
    <ExtraStatus view={view} />
  </section>;
}
