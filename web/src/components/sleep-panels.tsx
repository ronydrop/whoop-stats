"use client";

import { MetricCard } from "@/components/metric-card";
import { DetailPopup, DetailRow, useDetailPopup } from "@/components/detail-popup";
import { BedDouble, Clock, Brain, Moon } from "lucide-react";
import { formatNumber, formatDuration } from "@/lib/format";

interface SleepPanelData {
  sleepPerf: number | null;
  efficiency: number | null;
  consistency: number | null;
  respRate: number | null;
  totalSleepMs: number;
  totalInBedMs: number;
  sleepDebtMs: number | null;
  disturbances: number | null;
  sleepCycles: number | null;
  baselineMs: number | null;
  needFromStrainMs: number | null;
  needFromNapMs: number | null;
  napCount: number;
  lightMs: number;
  remMs: number;
  deepMs: number;
  awakeMs: number;
  noDataMs: number;
  // Derived averages
  avg7dPerf: number | null;
  avg30dPerf: number | null;
  avg7dEfficiency: number | null;
  avg30dEfficiency: number | null;
  avgDurationMs: number | null;
  avgDeepPct: number | null;
  avgRemPct: number | null;
  perfDelta: number | null;
}

function fmtDur(ms: number): string {
  return ms > 0 ? formatDuration(ms) : "--";
}

export function SleepPanels({ data: d }: { data: SleepPanelData }) {
  const { popup, open, close } = useDetailPopup();

  const deepPct = d.totalSleepMs > 0 ? (d.deepMs / d.totalSleepMs * 100) : 0;
  const remPct = d.totalSleepMs > 0 ? (d.remMs / d.totalSleepMs * 100) : 0;
  const lightPct = d.totalSleepMs > 0 ? (d.lightMs / d.totalSleepMs * 100) : 0;

  // Sleep need: baseline + strain need - nap credit
  const sleepNeedMs = (d.baselineMs || 0) + (d.needFromStrainMs || 0) - (d.needFromNapMs || 0);
  const sleepDebt = d.sleepDebtMs ? d.sleepDebtMs : null;
  const overUnder = sleepNeedMs > 0 && d.totalSleepMs > 0
    ? d.totalSleepMs - sleepNeedMs
    : null;

  return (
    <>
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <MetricCard
          title="Desempenho"
          value={d.sleepPerf ? `${d.sleepPerf}%` : "--%"}
          subtitle={d.perfDelta != null ? (
            <span className={`text-[10px] ${d.perfDelta > 0 ? "text-emerald-400" : d.perfDelta < 0 ? "text-rose-400" : "text-text-muted"}`}>
              {d.perfDelta > 0 ? "+" : ""}{d.perfDelta}% desde ontem
            </span>
          ) : d.totalSleepMs > 0 ? fmtDur(d.totalSleepMs) + " no total" : undefined}
          icon={<Moon className="w-4 h-4" />}
          accentColor="violet"
          onClick={() => open("performance")}
        />
        <MetricCard
          title="Eficiência"
          value={d.efficiency ? `${formatNumber(d.efficiency, 0)}%` : "--"}
          subtitle="Tempo dormindo em relação ao tempo na cama"
          icon={<BedDouble className="w-4 h-4" />}
          accentColor="blue"
          onClick={() => open("efficiency")}
        />
        <MetricCard
          title="Regularidade"
          value={d.consistency ? `${formatNumber(d.consistency, 0)}%` : "--"}
          subtitle="Regularidade dos horários"
          icon={<Clock className="w-4 h-4" />}
          accentColor="green"
          onClick={() => open("stages")}
        />
        <MetricCard
          title="Frequência respiratória"
          value={d.respRate ? `${formatNumber(d.respRate, 1)}` : "--"}
          subtitle="Respirações por minuto"
          icon={<Brain className="w-4 h-4" />}
          accentColor="yellow"
          onClick={() => open("resp")}
        />
      </div>

      {/* Performance Detail */}
      {popup === "performance" && (
        <DetailPopup title="Desempenho do sono" onClose={close}>
          <p className="text-xs text-text-tertiary mb-4">
            O desempenho do sono mede quanto o tempo dormido atendeu à necessidade do seu corpo, incluindo a recuperação do esforço recente.
          </p>
          <DetailRow label="Pontuação de desempenho" value={d.sleepPerf ? `${d.sleepPerf}%` : "--"} />
          <DetailRow label="Desempenho médio em 7 dias" value={d.avg7dPerf ? `${formatNumber(d.avg7dPerf, 0)}%` : "--"} />
          <DetailRow label="Desempenho médio em 30 dias" value={d.avg30dPerf ? `${formatNumber(d.avg30dPerf, 0)}%` : "--"} />
          <DetailRow label="Sono total" value={fmtDur(d.totalSleepMs)} />
          <DetailRow label="Tempo na cama" value={fmtDur(d.totalInBedMs)} />
          <DetailRow label="Necessidade de sono" value={sleepNeedMs > 0 ? fmtDur(sleepNeedMs) : "--"} hint="Necessidade básica + esforço − crédito de cochilos" />
          {d.baselineMs && d.baselineMs > 0 && (
            <DetailRow label="Necessidade básica" value={fmtDur(d.baselineMs)} hint="Necessidade básica de sono do seu corpo" />
          )}
          {d.needFromStrainMs && d.needFromStrainMs > 0 && (
            <DetailRow label="Adicional devido ao esforço" value={`+${fmtDur(d.needFromStrainMs)}`} hint="Sono adicional necessário devido à atividade recente" />
          )}
          {overUnder != null && (
            <div className="mt-4 p-3 rounded-lg bg-surface-1/30">
              <p className="text-xs text-text-secondary">
                {overUnder > 0
                  ? `Você dormiu ${fmtDur(overUnder)} a mais do que sua necessidade de sono — ótima recuperação!`
                  : overUnder < 0
                    ? `Você dormiu ${fmtDur(Math.abs(overUnder))} a menos do que sua necessidade de sono.`
                    : "Você atingiu sua necessidade exata de sono."}
              </p>
            </div>
          )}
        </DetailPopup>
      )}

      {/* Efficiency Detail */}
      {popup === "efficiency" && (
        <DetailPopup title="Eficiência do sono" onClose={close}>
          <p className="text-xs text-text-tertiary mb-4">
            A eficiência mede a porcentagem do tempo na cama em que você dormiu. Valores maiores são melhores — busque 85% ou mais.
          </p>
          <DetailRow label="Eficiência" value={d.efficiency ? `${formatNumber(d.efficiency, 1)}%` : "--"} />
          <DetailRow label="Média de 7 dias" value={d.avg7dEfficiency ? `${formatNumber(d.avg7dEfficiency, 1)}%` : "--"} />
          <DetailRow label="Média de 30 dias" value={d.avg30dEfficiency ? `${formatNumber(d.avg30dEfficiency, 1)}%` : "--"} />
          <DetailRow label="Tempo acordado na cama" value={fmtDur(d.awakeMs)} />
          <DetailRow label="Despertares" value={d.disturbances ?? "--"} hint="Número de vezes que você acordou" />
          <DetailRow label="Ciclos de sono" value={d.sleepCycles ?? "--"} hint="Ciclos completos de sono" />
          <DetailRow label="Déficit de sono" value={sleepDebt != null && sleepDebt > 0 ? fmtDur(sleepDebt) : "Nenhum"} hint="Déficit de sono acumulado" />
          {d.napCount > 0 && (
            <DetailRow label="Cochilos" value={d.napCount.toLocaleString("pt-BR")} hint="Cochilos registrados no período" />
          )}
        </DetailPopup>
      )}

      {/* Stages Detail */}
      {popup === "stages" && (
        <DetailPopup title="Distribuição das fases do sono" onClose={close}>
          <p className="text-xs text-text-tertiary mb-4">
            Seu sono é composto pelas fases leve, REM e profunda. O sono profundo e o REM são essenciais para a recuperação física e a consolidação da memória.
          </p>
          <DetailRow label="Sono profundo" value={`${fmtDur(d.deepMs)} (${formatNumber(deepPct, 0)}%)`} hint="Ideal: 15%–20% — recuperação física e hormônio do crescimento" />
          <DetailRow label="Sono REM" value={`${fmtDur(d.remMs)} (${formatNumber(remPct, 0)}%)`} hint="Ideal: 20%–25% — memória, aprendizado e processamento emocional" />
          <DetailRow label="Sono leve" value={`${fmtDur(d.lightMs)} (${formatNumber(lightPct, 0)}%)`} hint="Sono de transição — geralmente 50%–60%" />
          <DetailRow label="Tempo acordado" value={fmtDur(d.awakeMs)} />
          {d.noDataMs > 0 && <DetailRow label="Sem dados" value={fmtDur(d.noDataMs)} />}
          <DetailRow label="Duração média" value={d.avgDurationMs ? fmtDur(d.avgDurationMs) : "--"} hint="Média do período" />
          {d.avgDeepPct != null && <DetailRow label="Sono profundo médio (%)" value={`${formatNumber(d.avgDeepPct, 0)}%`} />}
          {d.avgRemPct != null && <DetailRow label="Sono REM médio (%)" value={`${formatNumber(d.avgRemPct, 0)}%`} />}
          <DetailRow label="Regularidade do sono" value={d.consistency ? `${formatNumber(d.consistency, 0)}%` : "--"} hint="Regularidade dos seus horários de sono" />
        </DetailPopup>
      )}

      {/* Respiratory Rate Detail */}
      {popup === "resp" && (
        <DetailPopup title="Frequência respiratória" onClose={close}>
          <p className="text-xs text-text-tertiary mb-4">
            A frequência respiratória habitual durante o sono é de 12 a 20 respirações por minuto. Alterações podem indicar doença, efeitos da altitude ou adaptações ao treino.
          </p>
          <DetailRow label="Atual" value={d.respRate ? `${formatNumber(d.respRate, 1)} bpm` : "--"} />
          {d.respRate && (
            <div className="mt-4 p-3 rounded-lg bg-surface-1/30">
              <p className="text-xs text-text-secondary">
                {d.respRate >= 12 && d.respRate <= 20
                  ? "Sua frequência respiratória está dentro da faixa habitual."
                  : d.respRate < 12
                    ? "Sua frequência respiratória está abaixo da faixa habitual."
                    : "Sua frequência respiratória está elevada — isso pode estar relacionado a doença ou altitude."}
              </p>
            </div>
          )}
        </DetailPopup>
      )}
    </>
  );
}
