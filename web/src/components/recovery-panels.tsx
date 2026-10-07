"use client";
import { formatNumber } from "@/lib/format";

import { MetricCard } from "@/components/metric-card";
import { DetailPopup, DetailRow, useDetailPopup } from "@/components/detail-popup";
import { HeartPulse, Wind, Thermometer, Activity, TrendingUp, TrendingDown } from "lucide-react";

interface PanelData {
  hrv: number | null;
  rhr: number | null;
  spo2: number | null;
  skinTemp: number | null;
  recoveryScore: number | null;
  avg7dHRV: number | null;
  avg30dHRV: number | null;
  avg7dRHR: number | null;
  avg30dRHR: number | null;
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
  avg7dRecovery: number | null;
  avg30dRecovery: number | null;
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
      {value > 0 ? "+" : ""}{formatNumber(value, 1)}{unit} desde ontem
    </span>
  );
}

export function RecoveryPanels({ data: d }: { data: PanelData }) {
  const { popup, open, close } = useDetailPopup();

  return (
    <>
      <div className="grid grid-cols-2 gap-3">
        <MetricCard
          title="VFC"
          value={d.hrv ? `${formatNumber(d.hrv, 0)} ms` : "--"}
          subtitle={<Delta value={d.hrvDelta} unit=" ms" />}
          icon={<HeartPulse className="w-4 h-4" />}
          accentColor="green"
          onClick={() => open("hrv")}
        />
        <MetricCard
          title="FC em repouso"
          value={d.rhr ? `${formatNumber(d.rhr, 0)} bpm` : "--"}
          subtitle={<Delta value={d.rhrDelta} unit=" bpm" invertColor />}
          icon={<Activity className="w-4 h-4" />}
          accentColor="blue"
          onClick={() => open("rhr")}
        />
        <MetricCard
          title="SpO2"
          value={d.spo2 ? `${formatNumber(d.spo2, 1)}%` : "--"}
          subtitle="Oxigenação do sangue"
          icon={<Wind className="w-4 h-4" />}
          accentColor="violet"
          onClick={() => open("spo2")}
        />
        <MetricCard
          title="Temperatura da pele"
          value={d.skinTemp ? `${formatNumber(d.skinTemp, 1)}°C` : "--"}
          subtitle={d.skinTempDeviation != null ? (
            <span className={Math.abs(d.skinTempDeviation) > 0.5 ? "text-amber-400 text-[10px]" : "text-text-muted text-[10px]"}>
              {d.skinTempDeviation > 0 ? "+" : ""}{formatNumber(d.skinTempDeviation, 1)}°C em relação à referência pessoal
            </span>
          ) : "Temperatura da pele"}
          icon={<Thermometer className="w-4 h-4" />}
          accentColor="yellow"
          onClick={() => open("skinTemp")}
        />
      </div>

      {/* HRV Detail */}
      {popup === "hrv" && (
        <DetailPopup title="Variabilidade da frequência cardíaca" onClose={close}>
          <p className="text-xs text-text-tertiary mb-4">
            A VFC mede a variação do intervalo entre batimentos cardíacos. Valores maiores geralmente indicam melhor condicionamento cardiovascular e recuperação.
          </p>
          <DetailRow label="VFC atual" value={d.hrv ? `${formatNumber(d.hrv, 1)} ms` : "--"} />
          <DetailRow label="Variação desde ontem" value={d.hrvDelta != null ? `${d.hrvDelta > 0 ? "+" : ""}${formatNumber(d.hrvDelta, 1)} ms` : "--"} />
          <DetailRow label="Média de 7 dias" value={d.avg7dHRV ? `${formatNumber(d.avg7dHRV, 1)} ms` : "--"} />
          <DetailRow label="Média de 30 dias" value={d.avg30dHRV ? `${formatNumber(d.avg30dHRV, 1)} ms` : "--"} hint="Sua referência pessoal" />
          <DetailRow label="Variabilidade (σ)" value={d.hrvStdDev ? `±${formatNumber(d.hrvStdDev, 1)} ms` : "--"} hint="Desvio padrão — valores menores indicam maior regularidade" />
          <DetailRow label="Faixa de 30 dias" value={d.hrvMin != null && d.hrvMax != null ? `${formatNumber(d.hrvMin, 0)} – ${formatNumber(d.hrvMax, 0)} ms` : "--"} />
          {d.hrv && d.avg30dHRV && (
            <div className="mt-4 p-3 rounded-lg bg-surface-1/30">
              <p className="text-xs text-text-secondary">
                {d.hrv > d.avg30dHRV * 1.1
                  ? "Sua VFC está acima da referência de 30 dias — ótima recuperação!"
                  : d.hrv < d.avg30dHRV * 0.9
                    ? "Sua VFC está abaixo da referência pessoal — considere um treino mais leve."
                    : "Sua VFC está dentro da sua faixa habitual."}
              </p>
            </div>
          )}
        </DetailPopup>
      )}

      {/* RHR Detail */}
      {popup === "rhr" && (
        <DetailPopup title="Frequência cardíaca em repouso" onClose={close}>
          <p className="text-xs text-text-tertiary mb-4">
            Uma frequência cardíaca em repouso menor geralmente indica melhor condicionamento cardiovascular. Uma frequência elevada pode indicar estresse, doença ou excesso de treino.
          </p>
          <DetailRow label="FC em repouso atual" value={d.rhr ? `${formatNumber(d.rhr, 0)} bpm` : "--"} />
          <DetailRow label="Variação desde ontem" value={d.rhrDelta != null ? `${d.rhrDelta > 0 ? "+" : ""}${formatNumber(d.rhrDelta, 1)} bpm` : "--"} />
          <DetailRow label="Média de 7 dias" value={d.avg7dRHR ? `${formatNumber(d.avg7dRHR, 1)} bpm` : "--"} />
          <DetailRow label="Média de 30 dias" value={d.avg30dRHR ? `${formatNumber(d.avg30dRHR, 1)} bpm` : "--"} hint="Sua referência pessoal" />
          <DetailRow label="Variabilidade (σ)" value={d.rhrStdDev ? `±${formatNumber(d.rhrStdDev, 1)} bpm` : "--"} />
          <DetailRow label="Faixa de 30 dias" value={d.rhrMin != null && d.rhrMax != null ? `${formatNumber(d.rhrMin, 0)} – ${formatNumber(d.rhrMax, 0)} bpm` : "--"} />
          {d.rhr && d.avg30dRHR && (
            <div className="mt-4 p-3 rounded-lg bg-surface-1/30">
              <p className="text-xs text-text-secondary">
                {d.rhr > d.avg30dRHR + 3
                  ? "Sua FC em repouso está elevada — isso pode estar relacionado a estresse, desidratação ou doença."
                  : d.rhr < d.avg30dRHR - 3
                    ? "Sua FC em repouso está abaixo da referência pessoal — excelente recuperação cardiovascular!"
                    : "Sua FC em repouso está dentro da sua faixa habitual."}
              </p>
            </div>
          )}
        </DetailPopup>
      )}

      {/* SpO2 Detail */}
      {popup === "spo2" && (
        <DetailPopup title="Oxigenação do sangue (SpO2)" onClose={close}>
          <p className="text-xs text-text-tertiary mb-4">
            A SpO2 mede a saturação de oxigênio no sangue. Valores habituais ficam entre 95% e 100%. Valores abaixo de 95% podem indicar problemas respiratórios.
          </p>
          <DetailRow label="SpO2 atual" value={d.spo2 ? `${formatNumber(d.spo2, 1)}%` : "--"} />
          <DetailRow label="SpO2 média" value={d.avgSpo2 ? `${formatNumber(d.avgSpo2, 1)}%` : "--"} />
          <DetailRow label="Menor valor registrado" value={d.minSpo2 ? `${formatNumber(d.minSpo2, 1)}%` : "--"} hint="Menor valor no período" />
          {d.spo2 && (
            <div className="mt-4 p-3 rounded-lg bg-surface-1/30">
              <p className="text-xs text-text-secondary">
                {d.spo2 >= 97 ? "Excelente oxigenação do sangue."
                  : d.spo2 >= 95 ? "Oxigenação do sangue dentro da faixa habitual."
                    : "SpO2 abaixo de 95% — considere consultar um médico se isso persistir."}
              </p>
            </div>
          )}
        </DetailPopup>
      )}

      {/* Skin Temp Detail */}
      {popup === "skinTemp" && (
        <DetailPopup title="Temperatura da pele" onClose={close}>
          <p className="text-xs text-text-tertiary mb-4">
            A temperatura da pele pode indicar estresse fisiológico, início de doença ou alterações hormonais. Acompanhe os desvios em relação à sua referência pessoal.
          </p>
          <DetailRow label="Atual" value={d.skinTemp ? `${formatNumber(d.skinTemp, 2)}°C` : "--"} />
          <DetailRow label="Referência pessoal" value={d.avgSkinTemp ? `${formatNumber(d.avgSkinTemp, 2)}°C` : "--"} />
          <DetailRow label="Desvio" value={d.skinTempDeviation != null ? `${d.skinTempDeviation > 0 ? "+" : ""}${formatNumber(d.skinTempDeviation, 2)}°C` : "--"} hint="Em relação à sua referência pessoal" />
          <DetailRow label="Variabilidade (σ)" value={d.skinTempStdDev ? `±${formatNumber(d.skinTempStdDev, 2)}°C` : "--"} />
          {d.skinTempDeviation != null && (
            <div className="mt-4 p-3 rounded-lg bg-surface-1/30">
              <p className="text-xs text-text-secondary">
                {Math.abs(d.skinTempDeviation) > 0.5
                  ? `A temperatura da sua pele está ${d.skinTempDeviation > 0 ? "elevada" : "mais baixa"} — isso pode indicar ${d.skinTempDeviation > 0 ? "início de doença, estresse ou alterações hormonais" : "melhor recuperação ou ambiente de sono mais fresco"}.`
                  : "A temperatura da sua pele está dentro da faixa habitual."}
              </p>
            </div>
          )}
        </DetailPopup>
      )}
    </>
  );
}
