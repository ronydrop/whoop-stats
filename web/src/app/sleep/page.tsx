import { sleepDuration, sleepSummary } from "@/lib/metrics";
import { RecordContext } from "@/components/record-context";
import { periodRecords } from "@/lib/api/period-records";
import { dateKey, resolvePeriod, type SearchParams } from "@/lib/period";
import { PeriodFilter } from "@/components/period-filter";
import { DayComparison } from "@/components/day-comparison";
import { SleepPanels } from "@/components/sleep-panels";
import { SleepStagesBar } from "@/components/sleep-stages-bar";
import { SleepExtras, SleepPlanner } from "@/components/sleep-extras";
import { TrendChart } from "@/components/trend-chart";
import { Moon } from "lucide-react";
import { formatDuration, formatRecordInterval } from "@/lib/format";
import { computeAvg } from "@/lib/stats";
import type { Sleep } from "@/lib/types";
import type { ChartRecord } from "@/lib/chart-timeline";

export const dynamic = "force-dynamic";

export default async function SleepPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const period = resolvePeriod(await searchParams);
  const sleepsRes = await periodRecords("sleeps", period);

  const sleeps = (sleepsRes as Sleep[]) || [];
  const primarySleeps = sleeps.filter(s => s.nap === false);
  const summary = sleepSummary(sleeps);
  const latest = primarySleeps[0];

  const sleepPerf = latest?.performance_score != null ? Math.round(Number(latest.performance_score)) : null;
  const lightMs = latest?.total_light_sleep_time_milli ?? null;
  const remMs = latest?.total_rem_sleep_time_milli ?? null;
  const deepMs = latest?.total_slow_wave_sleep_time_milli ?? null;
  const awakeMs = latest?.total_awake_time_milli ?? null;
  const noDataMs = latest?.total_no_data_time_milli ?? null;
  const totalSleepMs = latest ? sleepDuration(latest) : null;
  const totalInBedMs = latest?.total_in_bed_time_milli ?? null;
  const efficiency = latest?.sleep_efficiency_percentage != null ? Number(latest.sleep_efficiency_percentage) : null;
  const consistency = latest?.sleep_consistency_percentage != null ? Number(latest.sleep_consistency_percentage) : null;
  const respRate = latest?.respiratory_rate != null ? Number(latest.respiratory_rate) : null;
  const sleepDebtMs = latest?.sleep_debt_milli != null ? Number(latest.sleep_debt_milli) : null;
  const disturbances = latest?.disturbance_count != null ? Number(latest.disturbance_count) : null;
  const sleepCycles = latest?.sleep_cycle_count != null ? Number(latest.sleep_cycle_count) : null;
  const baselineMs = latest?.baseline_milli != null ? Number(latest.baseline_milli) : null;
  const needFromStrainMs = latest?.need_from_recent_strain_milli != null ? Number(latest.need_from_recent_strain_milli) : null;
  const needFromNapMs = latest?.need_from_recent_nap_milli != null ? Number(latest.need_from_recent_nap_milli) : null;
  let napCount = 0;
  const perfValues: number[] = [];
  const effValues: number[] = [];
  const durations: number[] = [];
  const deepPcts: number[] = [];
  const remPcts: number[] = [];
  const perfTrend: ChartRecord[] = [];
  const durationTrend: ChartRecord[] = [];

  for (const s of sleeps) {
    const total = sleepDuration(s);
    if (s.end_time) {
      const point = {
        date: s.end_time,
        category: s.nap === true ? "Cochilo" : s.nap === false ? "Sono principal" : "Tipo não informado",
        color: s.nap === true ? "var(--color-strain)" : s.nap === false ? "var(--color-sleep)" : "var(--color-text-muted)",
        note: `Intervalo completo: ${formatRecordInterval(s.start_time, s.end_time)}`,
      };
      perfTrend.push({ ...point, value: s.performance_score });
      durationTrend.push({ ...point, value: total == null ? null : total / 3_600_000 });
    }
    if (s.nap !== false) { if (s.nap === true) napCount++; continue; }

    const r = Number(s.total_rem_sleep_time_milli || 0);
    const d = Number(s.total_slow_wave_sleep_time_milli || 0);

    if (s.performance_score != null) {
      const perf = Number(s.performance_score);
      perfValues.push(perf);
    }

    if (s.sleep_efficiency_percentage != null) {
      effValues.push(Number(s.sleep_efficiency_percentage));
    }

    if (total != null && total >= 0) {
      durations.push(total);
      if (total > 0 && s.total_slow_wave_sleep_time_milli != null) deepPcts.push((d / total) * 100);
      if (total > 0 && s.total_rem_sleep_time_milli != null) remPcts.push((r / total) * 100);
    }
  }

  // Reverse trends to show chronological order
  perfTrend.reverse();
  durationTrend.reverse();

  // Compute averages
  const avgPeriodPerf = computeAvg(perfValues);
  const avgPeriodEfficiency = computeAvg(effValues);
  const avgDurationMs = computeAvg(durations);
  const avgDeepPct = computeAvg(deepPcts);
  const avgRemPct = computeAvg(remPcts);

  // Day-over-day
  const prevPerf = primarySleeps[1]?.performance_score != null ? Math.round(Number(primarySleeps[1].performance_score)) : null;
  const perfDelta = sleepPerf != null && prevPerf != null ? sleepPerf - prevPerf : null;

  const panelData = {
    sleepPerf, efficiency, consistency, respRate, summary,
    totalSleepMs, totalInBedMs, sleepDebtMs, disturbances,
    sleepCycles, baselineMs, needFromStrainMs, needFromNapMs, napCount,
    lightMs, remMs, deepMs, awakeMs, noDataMs,
    avgPeriodPerf, avgPeriodEfficiency,
    avgDurationMs, avgDeepPct, avgRemPct, perfDelta,
  };


  return (
    <div className="dashboard-page">
      <header><span className="page-kicker">SEU PAINEL WHOOP</span>
        <h1 className="text-2xl font-semibold tracking-tight text-text-primary">Sono</h1>
        <p className="text-sm text-text-tertiary mt-0.5">Sonos encerrados no período, com noites e cochilos separados</p>
      </header>
      <PeriodFilter pathname="/sleep" key={`${period.start}-${period.end}-${period.first}-${period.compare}`} period={period} />
      {period.compare && <DayComparison period={period} pathname="/sleep" />}
      {latest ? <RecordContext label="Último sono principal" start={latest.start_time} end={latest.end_time} state={latest.score_state} /> : <p className="record-context">Nenhum sono principal encerrado no período.{napCount > 0 ? ` Há ${napCount} cochilos nos gráficos e no histórico abaixo, conforme a classificação da WHOOP.` : ""}</p>}

      {/* Clickable hero stats */}
      <SleepPanels data={panelData} records={sleeps} />

      {/* Sleep stages for last night */}
      {totalSleepMs != null && totalSleepMs > 0 && (
        <div className="glass-card p-5">
          <h3 className="text-sm font-semibold text-text-primary mb-3">Composição do último sono principal</h3>
          <SleepStagesBar light={lightMs} rem={remMs} deep={deepMs} awake={awakeMs} />
          <div className="flex gap-4 mt-4 text-xs text-text-tertiary">
            {sleepDebtMs != null && sleepDebtMs > 0 && (
              <span>Déficit de sono: {formatDuration(Math.abs(sleepDebtMs))}</span>
            )}
            {disturbances != null && (
              <span>{disturbances} despertar{disturbances !== 1 ? "es" : ""}</span>
            )}
            {sleepCycles != null && (
              <span>{sleepCycles} ciclo de sono{sleepCycles !== 1 ? "s" : ""}</span>
            )}
          </div>
        </div>
      )}

      {latest?.end_time && <SleepExtras date={dateKey(latest.end_time)} activityId={String(latest.id)} />}
      <SleepPlanner />
      {/* Trends */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="glass-card p-5">
          <h3 className="text-sm font-semibold text-text-primary mb-1">Desempenho do sono</h3>
          <p className="text-xs text-text-tertiary mb-3">Sono principal e cochilos · pontuação por registro, na data de término</p>
          <TrendChart selection={period} data={perfTrend} color="var(--color-sleep)" label="Desempenho do sono" unit="%" domain={[0, 100]} height={200} />
        </div>
        <div className="glass-card p-5">
          <h3 className="text-sm font-semibold text-text-primary mb-1">Duração do sono</h3>
          <p className="text-xs text-text-tertiary mb-3">Sono principal e cochilos · horas efetivamente dormidas por registro</p>
          <TrendChart selection={period} data={durationTrend} color="var(--color-sleep)" label="Tempo dormido" unit="h" height={200} />
        </div>
      </div>

      {/* Sleep history */}
      {sleeps.length > 0 && (
        <div className="glass-card p-5">
          <h3 className="text-sm font-semibold text-text-primary mb-4">Histórico de sono</h3>
          <div className="space-y-1">
            {sleeps.map((s: Sleep, i: number) => {
              const perf = s.performance_score != null ? Math.round(Number(s.performance_score)) : null;
              const dur = sleepDuration(s);
              return (
                <div key={i} className="flex items-center gap-3 px-3 py-2.5 rounded-lg hover:bg-surface-1/50 transition-colors">
                  <Moon className="w-3.5 h-3.5 text-sleep" />
                  <span className="text-sm text-text-secondary flex-1">{s.nap === true ? "Cochilo · " : s.nap === false ? "Sono principal · " : "Tipo não informado · "}{formatRecordInterval(s.start_time, s.end_time)}</span>
                  <span className="text-sm font-medium text-text-primary">{perf != null ? `${perf}%` : "—"}</span>
                  <span className="text-xs text-text-muted w-16 text-right">{dur != null ? formatDuration(dur) : "--"}</span>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
