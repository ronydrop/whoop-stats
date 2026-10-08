import { RecordContext } from "@/components/record-context";
import { periodRecords } from "@/lib/api/period-records";
import { resolvePeriod, type SearchParams } from "@/lib/period";
import { PeriodFilter } from "@/components/period-filter";
import { DayComparison } from "@/components/day-comparison";
import { RecoveryGauge } from "@/components/recovery-gauge";
import { TrendChart } from "@/components/trend-chart";
import { formatNumber, getRecoveryColor, getRecoveryLabel, formatFullDate } from "@/lib/format";
import { RecoveryPanels } from "@/components/recovery-panels";
import { computeAvg, computeStdDev } from "@/lib/stats";
import type { Recovery } from "@/lib/types";

export const dynamic = "force-dynamic";

export default async function RecoveryPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const period = resolvePeriod(await searchParams);
  const recoveriesRes = await periodRecords("recoveries", period);

  const recoveries = ((recoveriesRes as Recovery[]) || []);
  const latest = recoveries[0];

  const recoveryScore = latest?.recovery_score != null ? Math.round(Number(latest.recovery_score))
    : null;
  const hrv = latest?.hrv_rmssd_milli != null ? Number(latest.hrv_rmssd_milli) : null;
  const rhr = latest?.resting_heart_rate != null ? Number(latest.resting_heart_rate) : null;
  const spo2 = latest?.spo2_percentage != null ? Number(latest.spo2_percentage) : null;
  const skinTemp = latest?.skin_temp_celsius != null ? Number(latest.skin_temp_celsius) : null;

  // Compute arrays for derived stats
  const hrvValues = recoveries.filter((r: Recovery) => r.hrv_rmssd_milli != null).map((r: Recovery) => Number(r.hrv_rmssd_milli));
  const rhrValues = recoveries.filter((r: Recovery) => r.resting_heart_rate != null).map((r: Recovery) => Number(r.resting_heart_rate));
  const recoveryScores = recoveries.filter((r: Recovery) => r.recovery_score != null).map((r: Recovery) => Number(r.recovery_score));
  const spo2Values = recoveries.filter((r: Recovery) => r.spo2_percentage != null).map((r: Recovery) => Number(r.spo2_percentage));
  const skinTempValues = recoveries.filter((r: Recovery) => r.skin_temp_celsius != null).map((r: Recovery) => Number(r.skin_temp_celsius));

  // Averages
  const avgPeriodRecovery = computeAvg(recoveryScores);
  const avgPeriodHRV = computeAvg(hrvValues);
  const avgPeriodRHR = computeAvg(rhrValues);

  // Standard deviations (variability)
  const hrvStdDev = computeStdDev(hrvValues);
  const rhrStdDev = computeStdDev(rhrValues);

  // Min/Max ranges
  const hrvMin = hrvValues.length ? Math.min(...hrvValues) : null;
  const hrvMax = hrvValues.length ? Math.max(...hrvValues) : null;
  const rhrMin = rhrValues.length ? Math.min(...rhrValues) : null;
  const rhrMax = rhrValues.length ? Math.max(...rhrValues) : null;

  // SpO2 stats
  const avgSpo2 = computeAvg(spo2Values);
  const minSpo2 = spo2Values.length ? Math.min(...spo2Values) : null;

  // Skin temp stats
  const avgSkinTemp = computeAvg(skinTempValues);
  const skinTempStdDev = computeStdDev(skinTempValues);
  const skinTempDeviation = skinTemp != null && avgSkinTemp != null ? skinTemp - avgSkinTemp : null;

  // Day-over-day deltas
  const prevRecovery = recoveries[1]?.recovery_score != null ? Number(recoveries[1].recovery_score) : null;
  const recoveryDelta = recoveryScore != null && prevRecovery != null ? recoveryScore - Math.round(prevRecovery) : null;
  const prevHRV = recoveries[1]?.hrv_rmssd_milli ?? null;
  const hrvDelta = hrv != null && prevHRV != null ? hrv - prevHRV : null;
  const prevRHR = recoveries[1]?.resting_heart_rate ?? null;
  const rhrDelta = rhr != null && prevRHR != null ? rhr - prevRHR : null;

  // Distribution: how many days in green/yellow/red
  const greenDays = recoveryScores.filter(s => getRecoveryColor(s) === "green").length;
  const yellowDays = recoveryScores.filter(s => getRecoveryColor(s) === "yellow").length;
  const redDays = recoveryScores.filter(s => getRecoveryColor(s) === "red").length;

  // Build trend data
  const hrvTrend = recoveries
    .filter((r: Recovery) => r.hrv_rmssd_milli != null)
    .map((r: Recovery) => ({ date: r.reference_time ?? r.recorded_at, value: Number(r.hrv_rmssd_milli) }))
    .reverse();
  const rhrTrend = recoveries
    .filter((r: Recovery) => r.resting_heart_rate != null)
    .map((r: Recovery) => ({ date: r.reference_time ?? r.recorded_at, value: Number(r.resting_heart_rate) }))
    .reverse();
  const recoveryTrend = recoveries
    .filter((r: Recovery) => r.recovery_score != null)
    .map((r: Recovery) => ({ date: r.reference_time ?? r.recorded_at, value: Number(r.recovery_score) }))
    .reverse();

  // Package all data for the client panels
  const panelData = {
    hrv, rhr, spo2, skinTemp, recoveryScore,
    avgPeriodHRV, avgPeriodRHR,
    hrvStdDev, rhrStdDev,
    hrvMin, hrvMax, rhrMin, rhrMax,
    avgSpo2, minSpo2,
    avgSkinTemp, skinTempStdDev, skinTempDeviation,
    recoveryDelta, hrvDelta, rhrDelta,
    avgPeriodRecovery,
    greenDays, yellowDays, redDays,
    totalDays: recoveryScores.length,
  };


  return (
    <div className="dashboard-page">
      <header><span className="page-kicker">SEU PAINEL WHOOP</span>
        <h1 className="text-2xl font-semibold tracking-tight text-text-primary">Recuperação</h1>
        <p className="text-sm text-text-tertiary mt-0.5">Medições do período, pela data de término do sono associado</p>
      </header>
      <PeriodFilter pathname="/recovery" key={`${period.start}-${period.end}-${period.first}-${period.compare}`} period={period} />
      {period.compare && <DayComparison period={period} pathname="/recovery" />}
      <RecordContext day={(period.singleDay ? period.start : undefined)} start={latest?.reference_time ?? latest?.recorded_at} end={latest?.reference_time ?? latest?.recorded_at} label={latest?.reference_time ? "Recuperação: término do sono associado" : "Recuperação: registro na WHOOP"} state={latest?.score_state} />

      {/* Top section: Gauge + Stats */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="glass-card p-6 flex flex-col items-center justify-center lg:col-span-1">
          <RecoveryGauge score={recoveryScore} size={200} />
          {recoveryScore != null && (
            <p className="text-sm text-text-secondary mt-2">{getRecoveryLabel(recoveryScore)}</p>
          )}
          {recoveryDelta != null && (
            <p className="text-xs text-text-muted mt-1">
              {recoveryDelta > 0 ? "+" : ""}{formatNumber(recoveryDelta, 1)} p.p. em relação ao registro anterior
            </p>
          )}
        </div>

        {/* Clickable vitals */}
        <div className="lg:col-span-2">
          <RecoveryPanels data={panelData} records={recoveries} />
        </div>
      </div>

      <h2 className="text-sm font-semibold">Resumo do período selecionado</h2>
      <p className="text-sm text-text-secondary">Média calculada: {avgPeriodRecovery == null ? "Não disponível" : `${formatNumber(avgPeriodRecovery, 1)}%`} · {recoveryScores.length} observações dos registros incluídos, com as referências temporais indicadas.</p>
      {/* Recovery Distribution — own row */}
      <div className="glass-card p-5">
        <h3 className="text-xs font-medium uppercase tracking-wider text-text-tertiary mb-3">
          Distribuição da recuperação ({panelData.totalDays} {panelData.totalDays === 1 ? "registro" : "registros"})
        </h3>
        <div className="flex items-center gap-1.5 h-4 rounded-full overflow-hidden">
          {greenDays > 0 && (
            <div className="h-full bg-emerald-500 rounded-full transition-all" style={{ flex: greenDays }} />
          )}
          {yellowDays > 0 && (
            <div className="h-full bg-amber-500 rounded-full transition-all" style={{ flex: yellowDays }} />
          )}
          {redDays > 0 && (
            <div className="h-full bg-rose-500 rounded-full transition-all" style={{ flex: redDays }} />
          )}
        </div>
        <div className="flex justify-between mt-3 text-xs">
          <span className="text-emerald-400 font-medium">{greenDays} verdes ({recoveryScores.length ? Math.round(greenDays / recoveryScores.length * 100) : 0}%)</span>
          <span className="text-amber-400 font-medium">{yellowDays} amarelos ({recoveryScores.length ? Math.round(yellowDays / recoveryScores.length * 100) : 0}%)</span>
          <span className="text-rose-400 font-medium">{redDays} vermelhos ({recoveryScores.length ? Math.round(redDays / recoveryScores.length * 100) : 0}%)</span>
        </div>
      </div>

      {/* Trend charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="glass-card p-5">
          <h3 className="text-sm font-semibold text-text-primary mb-1">Tendência da VFC</h3>
          <p className="text-xs text-text-tertiary mb-3">RMSSD em milissegundos</p>
          <TrendChart selection={period} data={hrvTrend} color="var(--color-recovery-green)" label="VFC" unit=" ms" height={200} />
        </div>
        <div className="glass-card p-5">
          <h3 className="text-sm font-semibold text-text-primary mb-1">Frequência cardíaca em repouso</h3>
          <p className="text-xs text-text-tertiary mb-3">Batimentos por minuto, fornecidos pela WHOOP</p>
          <TrendChart selection={period} data={rhrTrend} color="var(--color-strain)" label="FC em repouso" unit=" bpm" height={200} />
        </div>
      </div>

      {/* Recovery score trend */}
      <div className="glass-card p-5">
        <h3 className="text-sm font-semibold text-text-primary mb-1">Pontuação de recuperação</h3>
        <p className="text-xs text-text-tertiary mb-3">Pontuação dos registros associados ao sono</p>
        <TrendChart selection={period} data={recoveryTrend} color="var(--color-recovery-green)" label="Recuperação" unit="%" domain={[0, 100]} height={220} />
      </div>

      {/* Recovery history list */}
      {recoveries.length > 0 && (
        <div className="glass-card p-5">
          <h3 className="text-sm font-semibold text-text-primary mb-4">Histórico de recuperação</h3>
          <div className="space-y-1">
            {recoveries.map((rec: Recovery, i: number) => {
              const score = rec.recovery_score != null ? Math.round(Number(rec.recovery_score)) : null;
              const dotColor = score != null
                ? getRecoveryColor(score) === "green" ? "bg-emerald-500" : getRecoveryColor(score) === "yellow" ? "bg-amber-500" : "bg-rose-500"
                : "bg-surface-3";
              return (
                <div key={i} className="flex items-center gap-3 px-3 py-2.5 rounded-lg hover:bg-surface-1/50 transition-colors">
                  <div className={`w-2.5 h-2.5 rounded-full ${dotColor}`} />
                  <span className="text-sm text-text-secondary flex-1">{rec.reference_time ? formatFullDate(rec.reference_time) : "Referência não disponível"}</span>
                  <span className="text-sm font-medium text-text-primary">{score != null ? `${score}%` : "--"}</span>
                  <span className="text-xs text-text-muted w-16 text-right">{rec.hrv_rmssd_milli != null ? `${formatNumber(Number(rec.hrv_rmssd_milli), 0)} ms` : "--"}</span>
                  <span className="text-xs text-text-muted w-16 text-right">{rec.resting_heart_rate != null ? `${formatNumber(Number(rec.resting_heart_rate), 0)} bpm` : "--"}</span>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
