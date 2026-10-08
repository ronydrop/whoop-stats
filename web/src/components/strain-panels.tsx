"use client";

import { sportLabel } from "@/lib/sports";


import { MetricCard } from "@/components/metric-card";
import { MetricScale, MetricHistory, MetricComposition } from "@/components/metric-visual";
import { metric } from "@/lib/metrics";
import { formatRecordInterval, kjToCal } from "@/lib/format";
import type { Cycle } from "@/lib/types";
import { DetailPopup, DetailRow, useDetailPopup } from "@/components/detail-popup";
import { Flame, Zap, Heart, Activity, Dumbbell } from "lucide-react";
import { formatNumber, formatCalories, formatDuration } from "@/lib/format";

interface StrainPanelData {
  strain: number | null;
  kj: number | null;
  avgHR: number | null;
  maxHR: number | null;
  avgDailyStrain: number | null;
  peakStrain: number | null;
  totalCal: number | null;
  totalDays: number;
  strainCount: number;
  energyCount: number;
  workoutCount: number;
  highStrainDays: number;
  // Extended
  avgDailyCal: number | null;
  avgWorkoutStrain: number | null;
  avgWorkoutDurationMs: number | null;
  totalWorkoutDurationMs: number | null;
  sportBreakdown: { sport: string; count: number; avgStrain: number | null; totalCal: number | null }[];
  strainDelta: number | null;
}

export function StrainPanels({ data: d, records }: { data: StrainPanelData; records: Cycle[] }) {
  const { popup, open, close } = useDetailPopup();
  const history = (field: string) => [...records].reverse().map(r => {
    const value = metric(r, field);
    return { date: r.start_time, label: `Ciclo completo: ${formatRecordInterval(r.start_time, r.end_time)}`, value: value == null ? null : field === "kilojoule" ? kjToCal(value) : value };
  });

  return (
    <div className="space-y-4">
      {/* Hero stats */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <MetricCard
          title="Esforço do último ciclo"
          visual={<MetricScale value={d.strain} max={21} label="Pontuação do ciclo" />}
          value={d.strain != null ? formatNumber(d.strain, 1) : "--"}
          subtitle={d.kj != null ? formatCalories(d.kj) : undefined}
          icon={<Activity className="w-4 h-4" />}
          accentColor="blue"
          onClick={() => open("strain")}
        />
        <MetricCard
          title="FC média"
          visual={<MetricHistory points={history("average_heart_rate")} label="Média por ciclo" unit=" bpm" />}
          value={d.avgHR != null ? `${d.avgHR} bpm` : "--"}
          subtitle="Média do último ciclo"
          icon={<Heart className="w-4 h-4" />}
          accentColor="red"
          onClick={() => open("hr")}
        />
        <MetricCard
          title="FC máxima"
          visual={<MetricHistory points={history("max_heart_rate")} label="Pico por ciclo" unit=" bpm" />}
          value={d.maxHR != null ? `${d.maxHR} bpm` : "--"}
          subtitle="Pico do último ciclo"
          icon={<Zap className="w-4 h-4" />}
          accentColor="green"
          onClick={() => open("hr")}
        />
      </div>

      {/* Derived metrics */}
      <h2 className="mt-6 text-sm font-semibold">Resumo dos ciclos incluídos</h2>
      <p className="mt-1 text-sm text-text-secondary">Esforço e calorias correspondem aos ciclos completos, que podem atravessar mais de um dia.</p>
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-3">
        <MetricCard
          title="Esforço médio por ciclo"
          visual={<MetricHistory points={history("strain")} label="Esforço por ciclo" max={21} reference={d.avgDailyStrain} />}
          value={d.avgDailyStrain != null ? formatNumber(d.avgDailyStrain, 1) : "--"}
          subtitle={`${d.strainCount} ${d.strainCount === 1 ? "ciclo" : "ciclos"} na média`}
          onClick={() => open("averages")}
        />
        <MetricCard
          title="Pico de esforço"
          visual={<MetricHistory points={history("strain")} label="Esforço por ciclo" max={21} reference={d.peakStrain} />}
          value={d.peakStrain != null ? formatNumber(d.peakStrain, 1) : "--"}
          subtitle="Maior valor por ciclo"
          accentColor="blue"
          onClick={() => open("averages")}
        />
        <MetricCard
          title="Calorias dos ciclos incluídos"
          visual={<MetricHistory points={history("kilojoule")} label="Energia por ciclo" unit=" kcal" />}
          value={d.totalCal == null ? "Não disponível" : `${formatNumber(d.totalCal)} kcal`}
          subtitle={`${d.energyCount}/${d.totalDays} ${d.totalDays === 1 ? "ciclo com energia disponível" : "ciclos com energia disponível"}`}
          icon={<Flame className="w-4 h-4" />}
          onClick={() => open("calories")}
        />
        <MetricCard
          title="Ciclos de esforço intenso"
          visual={<MetricComposition label="Distribuição dos ciclos com esforço disponível" parts={[{ label: "≥ 14,0", value: d.strainCount ? d.highStrainDays : null, color: "var(--color-accent-hover)" }, { label: "< 14,0", value: d.strainCount ? d.strainCount - d.highStrainDays : null, color: "var(--color-strain)" }]} />}
          value={d.strainCount ? d.highStrainDays : "Não disponível"}
          subtitle={`esforço ≥ 14,0 (${d.workoutCount} ${d.workoutCount === 1 ? "treino" : "treinos"})`}
          icon={<Dumbbell className="w-4 h-4" />}
          onClick={() => open("averages")}
        />
      </div>
      <button className="mt-3 rounded-lg border border-border-subtle px-3 py-2 text-sm text-accent-hover" onClick={() => open("sports")}>Ver atividades por modalidade</button>

      {/* Today Strain Detail */}
      {popup === "strain" && (
        <DetailPopup title="Pontuação de esforço" onClose={close}>
          <p className="text-xs text-text-tertiary mb-4">
            O esforço mede a carga cardiovascular acumulada no intervalo do ciclo. A escala vai de 0 a 21, sendo 21 o esforço máximo.
          </p>
          <DetailRow label="Esforço atual" value={d.strain != null ? formatNumber(d.strain, 1) : "--"} />
          <DetailRow label="Calorias gastas" value={d.kj != null ? formatCalories(d.kj) : "--"} />
          {d.strainDelta != null && (
            <DetailRow label="em relação ao ciclo anterior" value={`${d.strainDelta > 0 ? "+" : ""}${formatNumber(d.strainDelta, 1)}`} />
          )}
          <DetailRow label="FC média" value={d.avgHR != null ? `${d.avgHR} bpm` : "--"} />
          <DetailRow label="FC máxima" value={d.maxHR != null ? `${d.maxHR} bpm` : "--"} />
          <div className="mt-4 p-3 rounded-lg bg-surface-1/30">
            <p className="text-xs text-text-secondary">
              Pontuação fornecida pela WHOOP para o ciclo completo. Não representa esforço exclusivo de um dia civil.
            </p>
          </div>
        </DetailPopup>
      )}

      {/* HR Detail */}
      {popup === "hr" && (
        <DetailPopup title="Análise de frequência cardíaca" onClose={close}>
          <p className="text-xs text-text-tertiary mb-4">
            Dados de frequência cardíaca do último ciclo. Uma FC média maior durante a atividade indica maior carga cardiovascular.
          </p>
          <DetailRow label="FC média" value={d.avgHR != null ? `${d.avgHR} bpm` : "--"} />
          <DetailRow label="FC máxima" value={d.maxHR != null ? `${d.maxHR} bpm` : "--"} />
          <DetailRow label="Esforço do último ciclo" value={d.strain != null ? formatNumber(d.strain, 1) : "--"} />
          <DetailRow label="Calorias" value={d.kj != null ? formatCalories(d.kj) : "--"} />
        </DetailPopup>
      )}

      {/* Averages Detail */}
      {popup === "averages" && (
        <DetailPopup title="Médias de esforço" onClose={close}>
          <DetailRow label="Média por ciclo" value={d.avgDailyStrain != null ? formatNumber(d.avgDailyStrain, 1) : "--"} />
          <DetailRow label="Pico de esforço" value={d.peakStrain != null ? formatNumber(d.peakStrain, 1) : "--"} hint="Maior esforço em um único ciclo" />
          <DetailRow label="Ciclos de esforço intenso" value={`${d.highStrainDays} (${d.strainCount > 0 ? Math.round(d.highStrainDays / d.strainCount * 100) : 0}%)`} hint="Ciclos com esforço ≥ 14,0" />
          <DetailRow label="Total de treinos" value={d.workoutCount} />
          {d.avgWorkoutStrain != null && (
            <DetailRow label="Esforço médio dos treinos" value={formatNumber(d.avgWorkoutStrain, 1)} />
          )}
          {d.avgWorkoutDurationMs != null && (
            <DetailRow label="Duração média dos treinos" value={formatDuration(d.avgWorkoutDurationMs)} />
          )}
          <DetailRow label="Tempo total de treinos" value={d.totalWorkoutDurationMs != null ? formatDuration(d.totalWorkoutDurationMs) : "--"} />
        </DetailPopup>
      )}

      {/* kcalories Detail */}
      {popup === "calories" && (
        <DetailPopup title="Análise de calorias" onClose={close}>
          <DetailRow label="Calorias dos ciclos incluídos" value={`${d.totalCal == null ? "Não disponível" : formatNumber(d.totalCal)} kcal`} />
          <DetailRow label="Média por ciclo" value={d.avgDailyCal != null ? `${Math.round(d.avgDailyCal).toLocaleString("pt-BR")} kcal` : "--"} />
          <DetailRow label="Ciclos registrados" value={d.totalDays} />
        </DetailPopup>
      )}

      {/* Sport Breakdown Detail */}
      {popup === "sports" && (
        <DetailPopup title="Distribuição de atividades" onClose={close}>
          <p className="text-xs text-text-tertiary mb-4">
            Desempenho por modalidade esportiva no período.
          </p>
          {!d.sportBreakdown.length && <p className="text-sm">Nenhum treino disponível na seleção.</p>}
          {d.sportBreakdown.map((s) => (
            <div key={sportLabel(s.sport)} className="flex items-center justify-between py-2 border-b border-border-subtle/30 last:border-0">
              <div>
                <span className="text-sm text-text-secondary capitalize">{sportLabel(s.sport)}</span>
                <p className="text-[10px] text-text-muted">{s.count} sessões · {s.totalCal == null ? "Não disponível" : formatNumber(s.totalCal)} kcal</p>
              </div>
              <span className="text-sm font-semibold text-text-primary">{s.avgStrain == null ? "Não disponível" : formatNumber(s.avgStrain, 1)} média</span>
            </div>
          ))}
          <DetailRow label="Total de treinos" value={d.workoutCount} />
          <DetailRow label="Tempo total" value={d.totalWorkoutDurationMs != null ? formatDuration(d.totalWorkoutDurationMs) : "--"} />
        </DetailPopup>
      )}
    </div>
  );
}
