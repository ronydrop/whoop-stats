"use client";
import { MetricCard } from "@/components/metric-card";
import { MetricScale, MetricHistory, MetricComposition } from "@/components/metric-visual";
import { metric } from "@/lib/metrics";
import { formatRecordInterval } from "@/lib/format";
import type { Sleep } from "@/lib/types";
import { DetailPopup, DetailRow, useDetailPopup } from "@/components/detail-popup";
import { BedDouble, Clock, Brain, Moon } from "lucide-react";
import { formatNumber, formatDuration } from "@/lib/format";
import { sleepNeedAssessment, type sleepSummary } from "@/lib/metrics";

interface SleepPanelData {
  summary: ReturnType<typeof sleepSummary>;
  sleepPerf: number | null; efficiency: number | null; consistency: number | null; respRate: number | null;
  totalSleepMs: number | null; totalInBedMs: number | null; sleepDebtMs: number | null;
  disturbances: number | null; sleepCycles: number | null; baselineMs: number | null;
  needFromStrainMs: number | null; needFromNapMs: number | null; napCount: number;
  lightMs: number | null; remMs: number | null; deepMs: number | null; awakeMs: number | null; noDataMs: number | null;
  avgPeriodPerf: number | null; avgPeriodEfficiency: number | null; avgDurationMs: number | null;
  avgDeepPct: number | null; avgRemPct: number | null; perfDelta: number | null;
}
const duration = (n: number | null) => n == null ? "Não disponível" : formatDuration(n);
const numeric = (n: number | null, unit = "") => n == null ? "Não disponível" : formatNumber(n, 1) + unit;
export function SleepPanels({ data: d, records }: { data: SleepPanelData; records: Sleep[] }) {
  const { popup, open, close } = useDetailPopup();
  const need = sleepNeedAssessment({ baseline_milli: d.baselineMs, sleep_debt_milli: d.sleepDebtMs, need_from_recent_strain_milli: d.needFromStrainMs, need_from_recent_nap_milli: d.needFromNapMs });
  return <>
    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
      <MetricCard title="Desempenho do sono" value={numeric(d.sleepPerf, "%")} subtitle="Último sono principal" icon={<Moon className="h-4 w-4" />} accentColor="violet" onClick={() => open("performance")} visual={<MetricScale value={d.sleepPerf} label="Desempenho WHOOP" />} />
      <MetricCard title="Tempo dormido no período" value={duration(d.summary.totalMs)} subtitle={`Inclui cochilos · ${d.summary.measuredCount}/${d.summary.recordCount} registros com duração`} icon={<BedDouble className="h-4 w-4" />} accentColor="blue" onClick={() => open("duration")} visual={<MetricComposition label="Composição do tempo dormido disponível" format={formatDuration} parts={[{ label: "Sono principal", value: d.summary.primaryMs, color: "var(--color-sleep)" }, { label: "Cochilos", value: d.summary.napMs, color: "var(--color-strain)" }, ...(d.summary.unclassifiedMs != null ? [{ label: "Sem classificação", value: d.summary.unclassifiedMs, color: "var(--color-text-muted)" }] : [])]} />} />
      <MetricCard title="Eficiência" value={numeric(d.efficiency, "%")} subtitle="Último sono principal · WHOOP" icon={<Clock className="h-4 w-4" />} accentColor="green" onClick={() => open("efficiency")} visual={<MetricScale value={d.efficiency} label="Eficiência do sono" />} />
      <MetricCard title="Frequência respiratória" value={numeric(d.respRate, " rpm")} subtitle="Último sono principal" icon={<Brain className="h-4 w-4" />} onClick={() => open("resp")} visual={<MetricHistory label="Respiração no sono principal" unit=" rpm" points={[...records].reverse().filter(r => r.nap === false).map(r => ({ date: r.end_time ?? r.start_time, label: formatRecordInterval(r.start_time, r.end_time), value: metric(r, "respiratory_rate") }))} />} />
    </div>
    <div className="mt-3 flex flex-wrap gap-x-6 gap-y-2 rounded-xl border border-border-subtle p-3 text-sm">
      <p><span className="text-text-secondary">Sono necessário: </span><strong>{duration(need.value)}</strong></p>
      <p><span className="text-text-secondary">Dívida de sono: </span><strong>{duration(d.sleepDebtMs)}</strong></p>
      {need.reason && <details className="w-full"><summary className="cursor-pointer text-accent-hover">Por que o sono necessário não está disponível?</summary><p className="mt-2 text-text-secondary">{need.reason}</p></details>}
    </div>
    {popup && <DetailPopup title={popup === "performance" ? "Desempenho e necessidade de sono" : popup === "duration" ? "Tempo dormido no período" : popup === "efficiency" ? "Eficiência e continuidade" : "Frequência respiratória"} onClose={close}>
      <p className="text-xs text-text-tertiary mb-3">{popup === "duration" ? "Soma do sono efetivo de todos os registros encerrados na seleção, incluindo cochilos. Cada duração pertence ao registro completo, mesmo quando começa antes do período." : "Valores do último sono principal disponível. Médias e diferenças são calculadas somente entre sonos principais da seleção."}</p>
      {popup === "performance" && <>
        <DetailRow label="Desempenho WHOOP" value={numeric(d.sleepPerf, "%")} />
        <DetailRow label="Média dos registros" value={numeric(d.avgPeriodPerf, "%")} />
        <DetailRow label="Diferença para o registro anterior" value={numeric(d.perfDelta, " p.p.")} />
        <DetailRow label="Sono necessário" value={duration(need.value)} />
        {need.reason && <p role="status" className="my-3 rounded-lg border border-amber-500/20 bg-amber-500/5 p-3 text-sm text-text-secondary">{need.reason}</p>}
        <details className="my-3 text-sm"><summary className="cursor-pointer text-accent-hover">Como este valor é calculado</summary><p className="mt-2 text-text-secondary">Somamos sono base, dívida de sono e esforço. O crédito dos cochilos reduz essa necessidade, usando os valores fornecidos pela WHOOP.</p></details>
        <DetailRow label="Base" value={duration(d.baselineMs)} />
        <DetailRow label="Dívida de sono" value={duration(d.sleepDebtMs)} />
        <DetailRow label="Contribuição do esforço" value={duration(d.needFromStrainMs)} />
        <DetailRow label="Ajuste dos cochilos" value={d.needFromNapMs == null ? "Não disponível" : `${d.needFromNapMs < 0 ? "−" : ""}${formatDuration(Math.abs(d.needFromNapMs))}`} />
      </>}
      {popup === "duration" && <>
        <DetailRow label="Total dormido, incluindo cochilos" value={duration(d.summary.totalMs)} />
        <DetailRow label="Sono principal acumulado" value={duration(d.summary.primaryMs)} />
        <DetailRow label="Cochilos acumulados" value={duration(d.summary.napMs)} />
        {d.summary.unclassifiedMs != null && <DetailRow label="Sono sem classificação" value={duration(d.summary.unclassifiedMs)} />}
        <DetailRow label="Registros com duração disponível" value={`${d.summary.measuredCount}/${d.summary.recordCount}`} />
        {d.summary.measuredCount < d.summary.recordCount && <p className="my-3 text-xs text-amber-300">Total parcial: há registros sem duração disponível.</p>}
        <h4 className="my-3 text-sm font-semibold">Último sono principal</h4>
        <DetailRow label="Sono efetivo do registro" value={duration(d.totalSleepMs)} />
        <DetailRow label="Sono leve" value={duration(d.lightMs)} />
        <DetailRow label="Sono profundo" value={duration(d.deepMs)} />
        <DetailRow label="Sono REM" value={duration(d.remMs)} />
        <DetailRow label="Tempo acordado" value={duration(d.awakeMs)} />
        <DetailRow label="Sem dados durante a sessão" value={duration(d.noDataMs)} />
        <DetailRow label="Duração média dos sonos principais" value={duration(d.avgDurationMs)} />
        <DetailRow label="Proporção média de sono profundo" value={numeric(d.avgDeepPct, "%")} />
        <DetailRow label="Proporção média de sono REM" value={numeric(d.avgRemPct, "%")} />
        <DetailRow label="Cochilos no período" value={d.napCount} />
      </>}
      {popup === "efficiency" && <>
        <DetailRow label="Eficiência WHOOP" value={numeric(d.efficiency, "%")} />
        <DetailRow label="Média dos registros" value={numeric(d.avgPeriodEfficiency, "%")} />
        <DetailRow label="Consistência WHOOP" value={numeric(d.consistency, "%")} />
        <DetailRow label="Tempo na cama" value={duration(d.totalInBedMs)} />
        <DetailRow label="Despertares" value={d.disturbances ?? "Não disponível"} />
        <DetailRow label="Ciclos de sono" value={d.sleepCycles ?? "Não disponível"} />
      </>}
      {popup === "resp" && <DetailRow label="Frequência respiratória WHOOP" value={numeric(d.respRate, " respirações/min")} />}
    </DetailPopup>}
  </>;
}
