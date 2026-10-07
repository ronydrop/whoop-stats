"use client";

import { sportLabel } from "@/lib/sports";


import { MetricCard } from "@/components/metric-card";
import { DetailPopup, DetailRow, useDetailPopup } from "@/components/detail-popup";
import { Flame, Zap, Heart, Activity, Dumbbell } from "lucide-react";
import { formatNumber, formatCalories, formatDuration, kjToCal } from "@/lib/format";

interface StrainPanelData {
  strain: number | null;
  kj: number | null;
  avgHR: number | null;
  maxHR: number | null;
  weekStrain: number;
  weekKJ: number;
  avgDailyStrain: number | null;
  peakStrain: number | null;
  totalCal: number;
  totalDays: number;
  workoutCount: number;
  highStrainDays: number;
  // Extended
  avgDailyCal: number | null;
  avgWorkoutStrain: number | null;
  avgWorkoutDurationMs: number | null;
  totalWorkoutDurationMs: number;
  sportBreakdown: { sport: string; count: number; avgStrain: number; totalCal: number }[];
  strainDelta: number | null;
  weekAvgDailyStrain: number | null;
}

export function StrainPanels({ data: d }: { data: StrainPanelData }) {
  const { popup, open, close } = useDetailPopup();

  return (
    <>
      {/* Hero stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <MetricCard
          title="Esforço de hoje"
          value={d.strain ? formatNumber(d.strain, 1) : "--"}
          subtitle={d.kj ? formatCalories(d.kj) : undefined}
          icon={<Activity className="w-4 h-4" />}
          accentColor="blue"
          onClick={() => open("strain")}
        />
        <MetricCard
          title="Total de 7 dias"
          value={formatNumber(d.weekStrain, 1)}
          subtitle={formatCalories(d.weekKJ)}
          icon={<Flame className="w-4 h-4" />}
          accentColor="yellow"
          onClick={() => open("weekly")}
        />
        <MetricCard
          title="FC média"
          value={d.avgHR ? `${d.avgHR} bpm` : "--"}
          subtitle="Média de hoje"
          icon={<Heart className="w-4 h-4" />}
          accentColor="red"
          onClick={() => open("hr")}
        />
        <MetricCard
          title="FC máxima"
          value={d.maxHR ? `${d.maxHR} bpm` : "--"}
          subtitle="Pico de hoje"
          icon={<Zap className="w-4 h-4" />}
          accentColor="green"
          onClick={() => open("hr")}
        />
      </div>

      {/* Derived metrics */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-3">
        <MetricCard
          title="Esforço diário médio"
          value={d.avgDailyStrain ? formatNumber(d.avgDailyStrain, 1) : "--"}
          subtitle={`${d.totalDays} dias de média`}
          onClick={() => open("averages")}
        />
        <MetricCard
          title="Pico de esforço"
          value={d.peakStrain ? formatNumber(d.peakStrain, 1) : "--"}
          subtitle="Maior valor diário"
          accentColor="blue"
          onClick={() => open("averages")}
        />
        <MetricCard
          title="Calorias totais"
          value={d.totalCal.toLocaleString("pt-BR")}
          subtitle={`${d.totalDays} dias registrados`}
          icon={<Flame className="w-4 h-4" />}
          onClick={() => open("calories")}
        />
        <MetricCard
          title="Dias de esforço intenso"
          value={d.highStrainDays}
          subtitle={`esforço ≥ 14,0 (${d.workoutCount} treinos)`}
          icon={<Dumbbell className="w-4 h-4" />}
          onClick={() => open("sports")}
        />
      </div>

      {/* Today Strain Detail */}
      {popup === "strain" && (
        <DetailPopup title="Pontuação de esforço" onClose={close}>
          <p className="text-xs text-text-tertiary mb-4">
            O esforço mede a carga cardiovascular acumulada durante o dia. A escala vai de 0 a 21, sendo 21 o esforço máximo.
          </p>
          <DetailRow label="Esforço atual" value={d.strain ? formatNumber(d.strain, 1) : "--"} />
          <DetailRow label="Calorias gastas" value={d.kj ? formatCalories(d.kj) : "--"} />
          {d.strainDelta != null && (
            <DetailRow label="em relação a ontem" value={`${d.strainDelta > 0 ? "+" : ""}${formatNumber(d.strainDelta, 1)}`} />
          )}
          <DetailRow label="FC média" value={d.avgHR ? `${d.avgHR} bpm` : "--"} />
          <DetailRow label="FC máxima" value={d.maxHR ? `${d.maxHR} bpm` : "--"} />
          <div className="mt-4 p-3 rounded-lg bg-surface-1/30">
            <p className="text-xs text-text-secondary">
              {d.strain && d.strain >= 14
                ? "Dia de esforço intenso — considere um dia mais leve amanhã para se recuperar."
                : d.strain && d.strain >= 10
                  ? "Esforço moderado — bom estímulo de treino."
                  : d.strain && d.strain >= 5
                    ? "Dia de atividade leve — favorável à recuperação ativa."
                    : "Dia de descanso — priorize o sono e a alimentação."}
            </p>
          </div>
        </DetailPopup>
      )}

      {/* Weekly Detail */}
      {popup === "weekly" && (
        <DetailPopup title="Resumo de 7 dias" onClose={close}>
          <DetailRow label="Esforço total" value={formatNumber(d.weekStrain, 1)} />
          <DetailRow label="Esforço diário médio" value={d.weekAvgDailyStrain ? formatNumber(d.weekAvgDailyStrain, 1) : "--"} />
          <DetailRow label="Calorias totais" value={`${kjToCal(d.weekKJ).toLocaleString("pt-BR")} Cal`} />
          <DetailRow label="Média diária de calorias" value={d.weekKJ ? `${Math.round(kjToCal(d.weekKJ) / 7).toLocaleString("pt-BR")} Cal` : "--"} />
        </DetailPopup>
      )}

      {/* HR Detail */}
      {popup === "hr" && (
        <DetailPopup title="Análise de frequência cardíaca" onClose={close}>
          <p className="text-xs text-text-tertiary mb-4">
            Dados de frequência cardíaca do ciclo de hoje. Uma FC média maior durante a atividade indica maior carga cardiovascular.
          </p>
          <DetailRow label="FC média" value={d.avgHR ? `${d.avgHR} bpm` : "--"} />
          <DetailRow label="FC máxima" value={d.maxHR ? `${d.maxHR} bpm` : "--"} />
          <DetailRow label="Esforço de hoje" value={d.strain ? formatNumber(d.strain, 1) : "--"} />
          <DetailRow label="Calorias" value={d.kj ? formatCalories(d.kj) : "--"} />
        </DetailPopup>
      )}

      {/* Averages Detail */}
      {popup === "averages" && (
        <DetailPopup title="Médias de esforço" onClose={close}>
          <DetailRow label="Média diária" value={d.avgDailyStrain ? formatNumber(d.avgDailyStrain, 1) : "--"} />
          <DetailRow label="Pico de esforço" value={d.peakStrain ? formatNumber(d.peakStrain, 1) : "--"} hint="Maior esforço em um único dia" />
          <DetailRow label="Dias de esforço intenso" value={`${d.highStrainDays} (${d.totalDays ? Math.round(d.highStrainDays / d.totalDays * 100) : 0}%)`} hint="Dias com esforço ≥ 14,0" />
          <DetailRow label="Total de treinos" value={d.workoutCount} />
          {d.avgWorkoutStrain != null && (
            <DetailRow label="Esforço médio dos treinos" value={formatNumber(d.avgWorkoutStrain, 1)} />
          )}
          {d.avgWorkoutDurationMs != null && (
            <DetailRow label="Duração média dos treinos" value={formatDuration(d.avgWorkoutDurationMs)} />
          )}
          <DetailRow label="Tempo total de treinos" value={d.totalWorkoutDurationMs > 0 ? formatDuration(d.totalWorkoutDurationMs) : "--"} />
        </DetailPopup>
      )}

      {/* Calories Detail */}
      {popup === "calories" && (
        <DetailPopup title="Análise de calorias" onClose={close}>
          <DetailRow label="Calorias totais" value={`${d.totalCal.toLocaleString("pt-BR")} Cal`} />
          <DetailRow label="Média diária" value={d.avgDailyCal ? `${Math.round(d.avgDailyCal).toLocaleString("pt-BR")} Cal` : "--"} />
          <DetailRow label="Dias registrados" value={d.totalDays} />
          <DetailRow label="Total de 7 dias" value={`${kjToCal(d.weekKJ).toLocaleString("pt-BR")} Cal`} />
        </DetailPopup>
      )}

      {/* Sport Breakdown Detail */}
      {popup === "sports" && d.sportBreakdown.length > 0 && (
        <DetailPopup title="Distribuição de atividades" onClose={close}>
          <p className="text-xs text-text-tertiary mb-4">
            Desempenho por modalidade esportiva no período.
          </p>
          {d.sportBreakdown.map((s) => (
            <div key={sportLabel(s.sport)} className="flex items-center justify-between py-2 border-b border-border-subtle/30 last:border-0">
              <div>
                <span className="text-sm text-text-secondary capitalize">{sportLabel(s.sport)}</span>
                <p className="text-[10px] text-text-muted">{s.count} sessões · {s.totalCal.toLocaleString("pt-BR")} Cal</p>
              </div>
              <span className="text-sm font-semibold text-text-primary">{formatNumber(s.avgStrain, 1)} média</span>
            </div>
          ))}
          <DetailRow label="Total de treinos" value={d.workoutCount} />
          <DetailRow label="Tempo total" value={d.totalWorkoutDurationMs > 0 ? formatDuration(d.totalWorkoutDurationMs) : "--"} />
        </DetailPopup>
      )}
    </>
  );
}
