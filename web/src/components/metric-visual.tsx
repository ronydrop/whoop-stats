"use client";

import { formatFullDate, formatNumber, formatRecordInterval, formatTime } from "@/lib/format";
import { ChartTooltip, useChartTooltip } from "./chart-tooltip";

export type MetricPoint = { label: string; value: number | null; color?: string; date?: string };
const shortDate = new Intl.DateTimeFormat("pt-BR", { day: "2-digit", month: "2-digit", timeZone: "America/Sao_Paulo" });

export function MetricScale({ value, max = 100, label }: { value: number | null; max?: number; label: string }) {
  const valid = value != null && Number.isFinite(value) && value >= 0 && value <= max;
  const fraction = valid ? value / max : 0;
  return <div className="metric-scale">
    <svg viewBox="0 0 88 88" role="img" aria-label={`${label}: ${valid ? formatNumber(value, 1) : "não disponível"}. Escala de 0 a ${max}.`}>
      <circle cx="44" cy="44" r="34" fill="none" stroke="var(--color-border-default)" strokeWidth="7" />
      {valid && <circle cx="44" cy="44" r="34" fill="none" stroke="var(--metric-color, var(--color-strain))" strokeWidth="7" strokeLinecap="round" pathLength="100" strokeDasharray={`${fraction * 100} 100`} transform="rotate(-90 44 44)" />}
      <text x="44" y="49" textAnchor="middle" fill="var(--metric-color, var(--color-strain))" fontSize="18" fontWeight="600">{valid ? formatNumber(value, max === 21 ? 1 : 0) : "—"}</text>
    </svg>
    <div><span>{label}</span><small>Escala de 0 a {max}</small>{!valid && <small>Sem pontuação disponível</small>}</div>
  </div>;
}

export function MetricHistory({ points, label, unit = "", max, reference }: { points: MetricPoint[]; label: string; unit?: string; max?: number; reference?: number | null }) {
  const tooltip = useChartTooltip<MetricPoint>();
  const active = tooltip.active?.data;
  const activeDate = active?.date && Number.isFinite(Date.parse(active.date)) ? `${formatFullDate(active.date)} às ${formatTime(active.date)}` : null;
  const activeLabel = active?.date && active.label === formatRecordInterval(active.date, active.date) ? activeDate : active?.label;
  const recent = points.slice(-12);
  const values = recent.flatMap(p => p.value != null && Number.isFinite(p.value) && p.value >= 0 ? [p.value] : []);
  if (!values.length) return <div className="metric-visual-empty">Sem registros para o gráfico</div>;
  const ceiling = max ?? Math.max(...values, reference ?? 0, 1) * 1.15;
  const height = (value: number) => Math.min(value / ceiling, 1) * 60;
  const slot = 256 / recent.length, width = Math.min(28, slot * .65);
  const summary = recent.map(p => `${p.label}: ${p.value == null ? "não disponível" : formatNumber(p.value, 1) + unit}`).join("; ");
  return <div className="metric-history">
    <svg viewBox="0 0 264 78" preserveAspectRatio="none" role="group" aria-label={`${label}. ${summary}`}>
      <line x1="4" y1="70" x2="260" y2="70" stroke="var(--color-border-default)" />
      {reference != null && Number.isFinite(reference) && reference >= 0 && <line x1="4" y1={70-height(reference)} x2="260" y2={70-height(reference)} stroke="var(--color-text-muted)" strokeDasharray="3 4" />}
      {recent.map((point, i) => {
        const x = 4 + slot * (i + .5), present = point.value != null && Number.isFinite(point.value) && point.value >= 0;
        return <g key={`${point.label}-${i}`} {...tooltip.bind(String(i), point)} aria-label={`${point.label}: ${present ? formatNumber(point.value!, 1) + unit : "Não disponível"}`}>
          <rect x={x-slot/2} y="0" width={slot} height="78" fill="transparent" />
          {present ? point.value === 0 ? <circle cx={x} cy="70" r="3" fill={point.color ?? "var(--metric-color)"} /> : <rect x={x-width/2} y={70-height(point.value!)} width={width} height={height(point.value!)} rx="3" fill={point.color ?? "var(--metric-color)"} opacity={i === recent.length-1 ? 1 : .65} /> : <line x1={x-4} x2={x+4} y1="70" y2="70" stroke="var(--color-text-muted)" strokeDasharray="2 2" />}
        </g>;
      })}
    </svg>
    <div className="metric-history-labels" style={{ gridTemplateColumns: `repeat(${recent.length}, minmax(0, 1fr))` }}>{recent.map((point, i) => <span key={i}>
      {(recent.length <= 6 || i === 0 || i === recent.length-1) && point.date && Number.isFinite(Date.parse(point.date)) && <small>{shortDate.format(new Date(point.date))}</small>}
    </span>)}</div>
    <div className="metric-visual-caption"><span>{label}</span><span>{recent.length} {recent.length === 1 ? "registro" : "registros"}{points.length > 12 ? " mais recentes" : ""}</span></div>
    {reference != null && <small className="metric-reference">Linha tracejada: {formatNumber(reference, 1)}{unit}</small>}
    <ChartTooltip tooltip={tooltip}>{active && <>
      <p className="chart-tooltip-label">{label}</p>
      <p className="chart-tooltip-value">{active.value == null || !Number.isFinite(active.value) ? "Não disponível" : formatNumber(active.value, 1) + unit}</p>
      <p>{activeLabel}</p>
      {activeDate && !activeLabel?.includes(formatFullDate(active.date!)) && <p>{activeDate}</p>}
      <p className="chart-tooltip-note">Horário de Brasília</p>
    </>}</ChartTooltip>
  </div>;
}

export function MetricComposition({ parts, label, format = (value: number) => formatNumber(value) }: { parts: { label: string; value: number | null; color: string }[]; label: string; format?: (value: number) => string }) {
  const available = parts.filter(p => p.value != null && Number.isFinite(p.value) && p.value >= 0);
  const total = available.reduce((sum, p) => sum + p.value!, 0);
  if (!available.length) return <div className="metric-visual-empty">Sem registros para o gráfico</div>;
  return <div className="metric-composition">
    <div className="metric-composition-bar" role="img" aria-label={`${label}: ${parts.map(p => `${p.label}: ${p.value == null ? "não disponível" : format(p.value)}`).join("; ")}`}>
      {available.filter(p => p.value! > 0).map(p => <span key={p.label} style={{ width: `${total > 0 ? p.value! / total * 100 : 0}%`, background: p.color }} title={`${p.label}: ${format(p.value!)}`} />)}
    </div>
    <div className="metric-composition-legend">{parts.map(p => <span key={p.label}><i style={{ background: p.color }} />{p.label}<strong>{p.value == null ? "—" : format(p.value)}</strong></span>)}</div>
  </div>;
}
