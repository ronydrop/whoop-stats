"use client";
import { formatNumber } from "@/lib/format";

import { MetricCard } from "@/components/metric-card";
import { MetricHistory } from "@/components/metric-visual";
import { metric } from "@/lib/metrics";
import { formatRecordInterval } from "@/lib/format";
import type { Recovery } from "@/lib/types";
import { DetailPopup, DetailRow, useDetailPopup } from "@/components/detail-popup";
import { HeartPulse, Wind, Thermometer, Activity, TrendingUp, TrendingDown } from "lucide-react";

interface PanelData {
  hrv: number | null;
  rhr: number | null;
  spo2: number | null;
  skinTemp: number | null;
  recoveryScore: number | null;
  avgPeriodHRV: number | null;
  avgPeriodRHR: number | null;
  hrvStdDev: number | null;
  rhrStdDev: number | null;
  hrvMin: number | null;
  hrvMax: number | null;
  rhrMin: number | null;
  rhrMax: number | null;
  avgSpo2: number | null;
  minSpo2: number | null;
  avgSkinTemp: number | null;
  skinTempStdDev: number | null;
  skinTempDeviation: number | null;
  recoveryDelta: number | null;
  hrvDelta: number | null;
  rhrDelta: number | null;
  avgPeriodRecovery: number | null;
  greenDays: number;
  yellowDays: number;
  redDays: number;
  totalDays: number;
}

function Delta({ value, unit, invertColor }: { value: number | null; unit: string; invertColor?: boolean }) {
  if (value === null) return null;
  // For RHR, down is good (invertColor=true)
  const isGood = invertColor ? value < 0 : value > 0;
  const color = Math.abs(value) < 1 ? "text-text-muted" : isGood ? "text-emerald-400" : "text-rose-400";
  const Icon = value > 0 ? TrendingUp : value < 0 ? TrendingDown : null;
  return (
    <span className={`flex items-center gap-0.5 text-[10px] ${color}`}>
      {Icon && <Icon className="w-3 h-3" />}
      {value > 0 ? "+" : ""}{formatNumber(value, 1)}{unit} desde o registro anterior
    </span>
  );
}

export function RecoveryPanels({ data: d, records }: { data: PanelData; records: Recovery[] }) {
  const { popup, open, close } = useDetailPopup();
  const history = (field: string) => [...records].reverse().map(r => ({ date: r.reference_time ?? r.recorded_at, label: r.reference_time ? formatRecordInterval(r.reference_time, r.reference_time) : `Registrado na WHOOP: ${formatRecordInterval(r.recorded_at, r.recorded_at)}`, value: metric(r, field) }));

  return (
    <>
      <div className="grid grid-cols-2 gap-3">
        <MetricCard
          title="VFC"
          value={d.hrv != null ? `${formatNumber(d.hrv, 0)} ms` : "--"}
          subtitle={<Delta value={d.hrvDelta} unit=" ms" />}
          icon={<HeartPulse className="w-4 h-4" />}
          accentColor="green"
          visual={<MetricHistory points={history("hrv_rmssd_milli")} label="VFC por registro" unit=" ms" />}
          onClick={() => open("hrv")}
        />
        <MetricCard
          title="FC em repouso"
          value={d.rhr != null ? `${formatNumber(d.rhr, 0)} bpm` : "--"}
          subtitle={<Delta value={d.rhrDelta} unit=" bpm" invertColor />}
          icon={<Activity className="w-4 h-4" />}
          accentColor="blue"
          visual={<MetricHistory points={history("resting_heart_rate")} label="FC por registro" unit=" bpm" />}
          onClick={() => open("rhr")}
        />
        <MetricCard
          title="SpO2"
          value={d.spo2 != null ? `${formatNumber(d.spo2, 1)}%` : "--"}
          subtitle="Oxigenação do sangue"
          icon={<Wind className="w-4 h-4" />}
          accentColor="violet"
          visual={<MetricHistory points={history("spo2_percentage")} label="SpO2 por registro" unit="%" max={100} />}
          onClick={() => open("spo2")}
        />
        <MetricCard
          title="Temperatura da pele"
          value={d.skinTemp != null ? `${formatNumber(d.skinTemp, 1)}°C` : "--"}
          subtitle={d.skinTempDeviation != null ? (
            <span className={Math.abs(d.skinTempDeviation) > 0.5 ? "text-amber-400 text-[10px]" : "text-text-muted text-[10px]"}>
              {d.skinTempDeviation > 0 ? "+" : ""}{formatNumber(d.skinTempDeviation, 1)}°C em relação à média da seleção
            </span>
          ) : "Temperatura da pele"}
          icon={<Thermometer className="w-4 h-4" />}
          accentColor="yellow"
          visual={<MetricHistory points={history("skin_temp_celsius")} label="Temperatura por registro" unit="°C" />}
          onClick={() => open("skinTemp")}
        />
      </div>

      {/* HRV Detail */}
      {popup === "hrv" && (
        <DetailPopup title="Variabilidade da frequência cardíaca" onClose={close}>
          <p className="text-xs text-text-tertiary mb-4">
            VFC em RMSSD fornecida pela WHOOP. As comparações abaixo usam os registros disponíveis.
          </p>
          <DetailRow label="VFC atual" value={d.hrv != null ? `${formatNumber(d.hrv, 1)} ms` : "--"} />
          <DetailRow label="Variação desde o registro anterior" value={d.hrvDelta != null ? `${d.hrvDelta > 0 ? "+" : ""}${formatNumber(d.hrvDelta, 1)} ms` : "--"} />
          <DetailRow label="Média do período" value={d.avgPeriodHRV != null ? `${formatNumber(d.avgPeriodHRV, 1)} ms` : "--"} hint="Média aritmética dos registros disponíveis" />
          <DetailRow label="Variabilidade (σ)" value={d.hrvStdDev != null ? `±${formatNumber(d.hrvStdDev, 1)} ms` : "--"} hint="Desvio padrão — valores menores indicam maior regularidade" />
          <DetailRow label="Faixa do período" value={d.hrvMin != null && d.hrvMax != null ? `${formatNumber(d.hrvMin, 0)} – ${formatNumber(d.hrvMax, 0)} ms` : "--"} />

        </DetailPopup>
      )}

      {/* RHR Detail */}
      {popup === "rhr" && (
        <DetailPopup title="Frequência cardíaca em repouso" onClose={close}>
          <p className="text-xs text-text-tertiary mb-4">
            Frequência cardíaca em repouso fornecida pela WHOOP. A média, a faixa e a variação são calculadas com os registros disponíveis.
          </p>
          <DetailRow label="FC em repouso atual" value={d.rhr != null ? `${formatNumber(d.rhr, 0)} bpm` : "--"} />
          <DetailRow label="Variação desde o registro anterior" value={d.rhrDelta != null ? `${d.rhrDelta > 0 ? "+" : ""}${formatNumber(d.rhrDelta, 1)} bpm` : "--"} />
          <DetailRow label="Média do período" value={d.avgPeriodRHR != null ? `${formatNumber(d.avgPeriodRHR, 1)} bpm` : "--"} hint="Média aritmética dos registros disponíveis" />
          <DetailRow label="Variabilidade (σ)" value={d.rhrStdDev != null ? `±${formatNumber(d.rhrStdDev, 1)} bpm` : "--"} />
          <DetailRow label="Faixa do período" value={d.rhrMin != null && d.rhrMax != null ? `${formatNumber(d.rhrMin, 0)} – ${formatNumber(d.rhrMax, 0)} bpm` : "--"} />

        </DetailPopup>
      )}

      {/* SpO2 Detail */}
      {popup === "spo2" && (
        <DetailPopup title="Oxigenação do sangue (SpO2)" onClose={close}>
          <p className="text-xs text-text-tertiary mb-4">
            A SpO2 mede a saturação de oxigênio no sangue. O painel apresenta a medição fornecida pela WHOOP e os valores disponíveis no período.
          </p>
          <DetailRow label="SpO2 atual" value={d.spo2 != null ? `${formatNumber(d.spo2, 1)}%` : "--"} />
          <DetailRow label="SpO2 média" value={d.avgSpo2 != null ? `${formatNumber(d.avgSpo2, 1)}%` : "--"} />
          <DetailRow label="Menor valor registrado" value={d.minSpo2 != null ? `${formatNumber(d.minSpo2, 1)}%` : "--"} hint="Menor valor no período" />

        </DetailPopup>
      )}

      {/* Skin Temp Detail */}
      {popup === "skinTemp" && (
        <DetailPopup title="Temperatura da pele" onClose={close}>
          <p className="text-xs text-text-tertiary mb-4">
            Temperatura da pele fornecida pela WHOOP. O desvio exibido compara o registro com a média aritmética da seleção.
          </p>
          <DetailRow label="Atual" value={d.skinTemp != null ? `${formatNumber(d.skinTemp, 2)}°C` : "--"} />
          <DetailRow label="Média dos registros" value={d.avgSkinTemp != null ? `${formatNumber(d.avgSkinTemp, 2)}°C` : "--"} />
          <DetailRow label="Desvio" value={d.skinTempDeviation != null ? `${d.skinTempDeviation > 0 ? "+" : ""}${formatNumber(d.skinTempDeviation, 2)}°C` : "--"} hint="Em relação à média da seleção" />
          <DetailRow label="Variabilidade (σ)" value={d.skinTempStdDev != null ? `±${formatNumber(d.skinTempStdDev, 2)}°C` : "--"} />

        </DetailPopup>
      )}
    </>
  );
}
