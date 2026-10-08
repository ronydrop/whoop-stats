"use client";
import { useState } from "react";
import { plannedBedtime, type SleepExtra, type SleepPlan } from "@/lib/whoop-extras";
import { formatDuration, formatTime, formatRecordInterval } from "@/lib/format";
import { MetricCard } from "./metric-card";
import { InfoTooltip } from "./info-tooltip";

const stages = [
  { id: "AWAKE", name: "Acordado", color: "#A1A1AA" },
  { id: "REM_SLEEP", name: "REM", color: "#A5A0FF" },
  { id: "LIGHT_SLEEP", name: "Leve", color: "#93C5FD" },
  { id: "SWS_SLEEP", name: "Profundo", color: "#4587E8" },
];
export function Hypnogram({ data }: { data: SleepExtra }) {
  const [active, setActive] = useState<number | null>(null);
  if (!data.start || !data.end) return null;
  const start = Date.parse(data.start), end = Date.parse(data.end), duration = end - start;
  const selected = active === null ? null : data.intervals[active];
  return <div className="space-y-4">
    <div className="flex items-center gap-2 text-xs text-text-secondary">Horário de Brasília<InfoTooltip title="Fases do sono por horário" description="Os intervalos recebidos da WHOOP são posicionados dentro do horário real deste sono. Espaços sem classificação ficam vazios. Passe o mouse ou toque em um trecho para ver seu horário." /></div>
    <div role="group" aria-label="Sequência das fases do sono" className="space-y-3">{stages.map(stage => <div key={stage.id} className="flex items-center gap-3">
      <span className="w-16 shrink-0 text-xs text-text-secondary">{stage.name}</span><div className="relative h-7 flex-1 rounded-md bg-surface-2/40">
        {data.intervals.map((interval, index) => interval.stage === stage.id ? <button key={index} type="button" aria-label={`${stage.name}: ${formatRecordInterval(interval.start, interval.end)}`} className="absolute inset-y-0 min-w-px rounded-sm opacity-90 hover:opacity-100 focus-visible:z-10 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white" style={{ left: `${100 * (Date.parse(interval.start) - start) / duration}%`, width: `${100 * (Date.parse(interval.end) - Date.parse(interval.start)) / duration}%`, backgroundColor: stage.color }} onMouseEnter={() => setActive(index)} onMouseLeave={() => setActive(null)} onFocus={() => setActive(index)} onBlur={() => setActive(null)} onClick={() => setActive(index)} /> : null)}
      </div>
    </div>)}</div>
    <div className="ml-[76px] flex justify-between text-[10px] text-text-muted">{[0, 0.5, 1].map(fraction => <span key={fraction}>{formatTime(new Date(start + duration * fraction).toISOString())}</span>)}</div>
    <p role="status" className="min-h-5 text-xs text-text-secondary">{selected ? `${stages.find(stage => stage.id === selected.stage)?.name} · ${formatTime(selected.start)} → ${formatTime(selected.end)} · ${formatDuration(Date.parse(selected.end) - Date.parse(selected.start))}` : "Passe o mouse, toque ou use o teclado para consultar um trecho."}</p>
    <details className="text-xs text-text-secondary"><summary className="cursor-pointer">Ver intervalos em tabela</summary><div className="mt-3 max-h-72 overflow-auto"><table className="w-full text-left"><thead><tr><th className="py-2">Fase</th><th>Início</th><th>Fim</th></tr></thead><tbody>{data.intervals.map((interval, i) => <tr key={i} className="border-t border-border-subtle"><td className="py-2">{stages.find(stage => stage.id === interval.stage)?.name}</td><td>{formatTime(interval.start)}</td><td>{formatTime(interval.end)}</td></tr>)}</tbody></table></div></details>
  </div>;
}
export function SleepPlanning({ plan }: { plan: SleepPlan }) {
  const [goal, setGoal] = useState("100");
  const [wake, setWake] = useState(plan.wake ?? "07:00");
  const choice = plan.goals.find(choice => choice.goal === goal);
  const bedtime = plannedBedtime(wake, choice?.inBedMs ?? null);
  const duration = (value: number | null | undefined) => value == null ? "—" : formatDuration(value);
  return <div className="space-y-4">
    <div className="glass-card flex flex-wrap items-end gap-4 p-4"><label className="space-y-1 text-xs text-text-secondary">Quero acordar às<input aria-label="Horário para acordar" type="time" value={wake} onChange={event => setWake(event.target.value)} className="period-input" /></label>
      <label className="space-y-1 text-xs text-text-secondary">Meta de sono<select aria-label="Meta de sono" className="period-input" value={goal} onChange={event => setGoal(event.target.value)}>{plan.goals.map(choice => <option key={choice.goal} value={choice.goal}>{choice.goal}% da necessidade</option>)}</select></label>
      <p className="text-xs text-text-muted">Alarme WHOOP: {plan.alarm === "OFF" ? "desativado" : plan.alarm === "ON" ? "ativado" : "estado não disponível"}</p>
    </div>
    <div className="grid gap-4 sm:grid-cols-3">
      <MetricCard title="Horário para deitar" value={bedtime ?? "—"} subtitle={`Para acordar às ${wake || "—"}`} description="Calculado neste painel: subtraímos o tempo na cama recomendado pela WHOOP do horário em que você deseja acordar." accentColor="violet" />
      <MetricCard title="Tempo recomendado na cama" value={duration(choice?.inBedMs)} subtitle={`Meta de ${goal}% · inclui tempo estimado acordado`} description="Tempo na cama recomendado pela WHOOP para atingir a meta escolhida, incluindo o tempo que você costuma ficar acordado." />
      <MetricCard title="Necessidade atual de sono" value={duration(plan.needMs)} subtitle="Necessidade total estimada pela WHOOP" description="Combina sua necessidade base com dívida de sono, esforço recente e ajuste dos cochilos." />
    </div>
    <details className="glass-card p-4 text-sm"><summary className="cursor-pointer text-text-secondary">Como a WHOOP chegou à necessidade de sono</summary><dl className="mt-4 grid gap-3 sm:grid-cols-2">{[{ title: "Base", value: plan.baselineMs }, { title: "Dívida de sono", value: plan.debtMs }, { title: "Esforço recente", value: plan.strainMs }, { title: "Ajuste dos cochilos", value: plan.napMs }].map(item => <div key={item.title} className="flex justify-between gap-4"><dt className="text-text-muted">{item.title}</dt><dd>{item.value !== null && item.value < 0 ? "−" : ""}{duration(item.value === null ? null : Math.abs(item.value))}</dd></div>)}</dl></details>
  </div>;
}
