"use client";

import { useState } from "react";
import { CartesianGrid, ComposedChart, ReferenceArea, ReferenceLine, ResponsiveContainer, XAxis, YAxis } from "recharts";
import { chartTimeline, visibleRecord, type ChartRecord, type ChartSelection } from "@/lib/chart-timeline";
import { formatDuration, formatFullDate, formatNumber, formatRecordInterval, formatTime } from "@/lib/format";
import { ChartTooltip, useChartTooltip } from "./chart-tooltip";

export type RecordSeries = { label: string; color: string; unit?: string; domain?: [number, number]; intervals?: boolean; dateOnly?: boolean; records: ChartRecord[] };
type Props = { series: RecordSeries[]; selection: ChartSelection; height?: number; tableLabel?: string; stacked?: boolean };

function IntervalMark({ x1 = 0, x2 = 0, y1 = 0, stroke, strokeWidth, ...interaction }: React.SVGProps<SVGRectElement>) {
  const left = Number(x1), right = Number(x2), top = Number(y1);
  return <g>
    <rect {...interaction} x={Math.min(left, right)} y={top - 10} width={Math.max(Math.abs(right - left), 10)} height={20} fill="transparent" stroke="none" className="cursor-pointer" />
    <line x1={left} x2={right} y1={top} y2={top} stroke={stroke} strokeWidth={strokeWidth} strokeLinecap="round" pointerEvents="none" />
  </g>;
}

export function RecordChart({ series, selection, height = 240, tableLabel = "Ver dados em tabela", stacked = false }: Props) {
  const [width, setWidth] = useState(0);
  const compact = width > 0 && width < 420;
  const axis = chartTimeline(selection);
  const records = series.flatMap((s, seriesIndex) => s.records.map((r, index) => {
    const visible = visibleRecord(r, selection, !!s.intervals);
    const detail = s.intervals ? formatRecordInterval(r.date, r.end) : s.dateOnly ? formatFullDate(r.date) : `${formatFullDate(r.date)} às ${formatTime(r.date)}`;
    return { id: `${seriesIndex}-${index}`, seriesIndex, series: s, record: r, visible, detail, label: r.category ? `${s.label} · ${r.category}` : s.label, color: r.color ?? s.color };
  }));
  const tooltip = useChartTooltip<(typeof records)[number]>();
  const active = tooltip.active?.data;
  const selected = tooltip.active?.key;
  const valueLabel = (value: number | null, unit?: string) => value == null ? "Não disponível" : unit?.trim() === "h" ? formatDuration(value * 3_600_000) : formatNumber(value, 1) + (unit?.trim() === "%" ? "%" : unit ? ` ${unit.trim()}` : "");
  const shown = records.filter(r => r.visible);
  const baseline = (record: (typeof records)[number]) => stacked ? shown.filter(r => r.seriesIndex < record.seriesIndex && r.record.date === record.record.date).reduce((total, r) => total + r.visible!.value, 0) : 0;
  const legend = series.flatMap(s => s.records.some(r => r.category)
    ? [...new Map(s.records.map(r => [r.category ?? s.label, { ...s, label: r.category ?? s.label, color: r.color ?? s.color }])).values()]
    : [s]);
  const dateLabel = new Intl.DateTimeFormat("pt-BR", { timeZone: "America/Sao_Paulo", day: "2-digit", month: "2-digit" });

  return <div className="space-y-3" data-record-chart>
    <div className="flex flex-wrap gap-x-5 gap-y-2 text-xs text-text-secondary" aria-label="Legenda do gráfico">
      {legend.map(s => <span key={s.label} className="flex items-center gap-2"><span aria-hidden="true" className="h-2.5 w-2.5 rounded-sm" style={{ backgroundColor: s.color }} />{s.label}{s.unit ? ` (${s.unit.trim()})` : ""}{s.intervals ? " · ciclo completo" : " · por registro"}</span>)}
    </div>
    <div className="relative" style={{ height }}>
      <ResponsiveContainer width="100%" height="100%" minWidth={0} onResize={setWidth}>
        <ComposedChart data={shown.map(r => ({ timestamp: r.visible!.start }))} margin={{ top: 16, right: 8, left: 0, bottom: 10 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.10)" vertical={false} />
          <XAxis dataKey="timestamp" type="number" scale="time" domain={[axis.start, axis.end]} ticks={axis.ticks} allowDataOverflow
            tickFormatter={value => axis.hourly ? formatTime(new Date(value).toISOString()) : dateLabel.format(new Date(value))}
            tick={{ fill: "var(--color-text-secondary)", fontSize: 11 }} tickLine={false} axisLine={false} interval={0}
            angle={compact ? -35 : 0} textAnchor={compact ? "end" : "middle"} height={compact ? 44 : 30} />
          {series.map((s, index) => {
            if (stacked && index > 0) return null;
            const values = shown.filter(r => stacked || r.seriesIndex === index).map(r => baseline(r) + r.visible!.value);
            const limits = s.domain ?? [Math.min(0, ...values), Math.max(1, ...values) * 1.1];
            return <YAxis key={s.label} yAxisId={index} orientation={index === 0 ? "left" : "right"} domain={limits}
              tickFormatter={value => Number(value).toLocaleString("pt-BR", { maximumFractionDigits: 2 })} tick={{ fill: stacked ? "var(--color-text-secondary)" : s.color, fontSize: 11 }} tickLine={false} axisLine={false} width={42} />;
          })}
          {axis.boundaries.map(time => <ReferenceLine key={time} x={time} yAxisId={0} stroke="rgba(255,255,255,0.08)" strokeDasharray="3 3" />)}
          {shown.map(r => {
            const v = r.visible!;
            const halfBar = (axis.end - axis.start) * 5 / Math.max(width - 60, 200);
            const x1 = r.series.intervals ? v.start : Math.max(axis.start, v.start - halfBar);
            const x2 = r.series.intervals ? v.end : Math.min(axis.end, v.start + halfBar);
            const description = `${r.label}: ${valueLabel(v.value, r.series.unit)}. ${r.detail}${r.series.intervals ? ". Valor do ciclo completo" : ""}`;
            const interaction = { ...tooltip.bind(r.id, r), "aria-label": description };
            const base = baseline(r), yAxisId = stacked ? 0 : r.seriesIndex;
            return r.series.intervals || v.value === 0 ? <ReferenceLine key={r.id} yAxisId={yAxisId} segment={[{ x: x1, y: base + v.value }, { x: x2, y: base + v.value }]} stroke={r.color} strokeWidth={selected === r.id ? 9 : 6} shape={<IntervalMark />} {...interaction} />
              : <ReferenceArea key={r.id} yAxisId={yAxisId} x1={x1} x2={x2} y1={base} y2={base + v.value} ifOverflow="hidden"
                fill={r.color} fillOpacity={r.series.intervals ? 0.22 : 0.85} stroke={r.color} strokeWidth={selected === r.id ? 3 : 1.5} {...interaction} />;
          })}
        </ComposedChart>
      </ResponsiveContainer>
      {!shown.length && <p className="absolute inset-0 flex items-center justify-center px-12 text-center text-sm text-text-secondary pointer-events-none">Nenhuma medição disponível neste período.</p>}
    </div>
    <ChartTooltip tooltip={tooltip}>{active && <>
      <p className="chart-tooltip-label">{active.label}</p>
      <p className="chart-tooltip-value">{valueLabel(active.record.value, active.series.unit)}</p>
      {active.series.intervals ? <dl><dt>Início do ciclo</dt><dd>{formatFullDate(active.record.date)} às {formatTime(active.record.date)}</dd><dt>Fim do ciclo</dt><dd>{active.record.end ? `${formatFullDate(active.record.end)} às ${formatTime(active.record.end)}` : "Em andamento"}</dd></dl> : <p>{active.detail} <span className="text-text-muted">· Brasília</span></p>}
      {active.record.note && <p className="chart-tooltip-note">{active.record.note}</p>}
      {active.series.intervals && !active.record.end && active.record.updatedAt && <p>Atualizado em {formatFullDate(active.record.updatedAt)} às {formatTime(active.record.updatedAt)}</p>}
      {active.series.intervals && <p className="chart-tooltip-note">Valor do ciclo inteiro, sem divisão por dia ou hora.{active.visible?.clipped ? " Apenas parte do intervalo está no período selecionado." : ""} Horário de Brasília.</p>}
    </>}</ChartTooltip>
    <details className="chart-table"><summary>{tableLabel}</summary><div className="overflow-auto max-h-64"><table className="w-full text-left"><thead><tr><th>Métrica</th><th>Data / intervalo completo</th><th>Valor</th></tr></thead><tbody>{records.map(r => <tr key={r.id} className="border-t border-border-subtle"><td>{r.label}</td><td>{r.detail}{r.record.note && <span className="block text-text-muted">{r.record.note}</span>}</td><td>{valueLabel(r.record.value, r.series.unit)}</td></tr>)}</tbody></table></div></details>
  </div>;
}
