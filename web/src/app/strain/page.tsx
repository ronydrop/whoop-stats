import { sumAvailable } from "@/lib/metrics";
import { RecordContext } from "@/components/record-context";
import { periodRecords } from "@/lib/api/period-records";
import { resolvePeriod, type SearchParams } from "@/lib/period";
import { PeriodFilter } from "@/components/period-filter";
import { DayComparison } from "@/components/day-comparison";
import { StrainPanels } from "@/components/strain-panels";
import { TrendChart } from "@/components/trend-chart";
import { Flame } from "lucide-react";
import { formatNumber, formatCalories, formatRecordInterval, kjToCal } from "@/lib/format";
import { computeAvg } from "@/lib/stats";
import type { Cycle, Workout } from "@/lib/types";

export const dynamic = "force-dynamic";

export default async function StrainPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const period = resolvePeriod(await searchParams);
  const [cyclesRes, workoutsRes] = await Promise.all([
    periodRecords("cycles", period),
    periodRecords("workouts", period),
  ]);

  const cycles = (cyclesRes as Cycle[]) || [];
  const workouts = (workoutsRes as Workout[]) || [];
  const latest = cycles[0];

  const strain = latest?.strain != null ? Number(latest.strain) : null;
  const kj = latest?.kilojoule != null ? Number(latest.kilojoule) : null;
  const avgHR = latest?.average_heart_rate != null ? Number(latest.average_heart_rate) : null;
  const maxHR = latest?.max_heart_rate != null ? Number(latest.max_heart_rate) : null;

  const cycleEnergy = sumAvailable(cycles.map(c => c.kilojoule));

  // All-time derived
  const allStrains = cycles.filter((c: Cycle) => c.strain != null).map((c: Cycle) => Number(c.strain));
  const avgDailyStrain = computeAvg(allStrains);
  const peakStrain = allStrains.length ? Math.max(...allStrains) : null;
  const totalCal = cycleEnergy == null ? null : kjToCal(cycleEnergy);
  const avgDailyCal = computeAvg(cycles.flatMap(c => c.kilojoule == null ? [] : [kjToCal(c.kilojoule)]));
  const highStrainDays = allStrains.filter(s => s >= 14).length;

  // Day-over-day
  const prevStrain = cycles[1]?.strain != null ? Number(cycles[1].strain) : null;
  const strainDelta = strain != null && prevStrain != null ? strain - prevStrain : null;

  // Workout stats
  const workoutStrains = workouts.filter((w: Workout) => w.strain != null).map((w: Workout) => Number(w.strain));
  const avgWorkoutStrain = computeAvg(workoutStrains);
  const workoutDurations = workouts.flatMap((w: Workout) => w.end_time ? [Date.parse(w.end_time) - Date.parse(w.start_time)] : []).filter(d => d >= 0);
  const avgWorkoutDurationMs = computeAvg(workoutDurations);
  const totalWorkoutDurationMs = sumAvailable(workoutDurations);

  const sportBreakdown = [...new Set(workouts.map(w => w.sport_name || "activity"))].map(sport => {
    const sessions = workouts.filter(w => (w.sport_name || "activity") === sport);
    const energy = sumAvailable(sessions.map(w => w.kilojoule));
    return { sport, count: sessions.length, avgStrain: computeAvg(sessions.flatMap(w => w.strain == null ? [] : [w.strain])), totalCal: energy == null ? null : kjToCal(energy) };
  }).sort((a,b) => b.count-a.count);

  const panelData = {
    strain, kj, avgHR, maxHR,
    avgDailyStrain, peakStrain, totalCal,
    totalDays: cycles.length, strainCount: allStrains.length, energyCount: cycles.filter(c => c.kilojoule != null).length, workoutCount: workouts.length,
    highStrainDays, avgDailyCal,
    avgWorkoutStrain, avgWorkoutDurationMs, totalWorkoutDurationMs,
    sportBreakdown, strainDelta,
  };

  // Trends
  const dailyStrainTrend = cycles
    .filter((c: Cycle) => c.strain != null)
    .map((c: Cycle) => ({ date: c.start_time as string, end: c.end_time as string | null, updatedAt: c.updated_at, value: Number(c.strain) }))
    .reverse();
  const calorieTrend = cycles
    .filter((c: Cycle) => c.kilojoule != null)
    .map((c: Cycle) => ({ date: c.start_time as string, end: c.end_time as string | null, updatedAt: c.updated_at, value: kjToCal(Number(c.kilojoule)) }))
    .reverse();


  return (
    <div className="dashboard-page">
      <header><span className="page-kicker">SEU PAINEL WHOOP</span>
        <h1 className="text-2xl font-semibold tracking-tight text-text-primary">Esforço</h1>
        <p className="text-sm text-text-tertiary mt-0.5">Acompanhe a carga cardiovascular por ciclo</p>
      </header>
      <PeriodFilter pathname="/strain" key={`${period.start}-${period.end}-${period.first}-${period.compare}`} period={period} />
      {period.compare && <DayComparison period={period} pathname="/strain" />}
      <RecordContext label="Ciclo completo" start={latest?.start_time} end={latest?.end_time} state={latest?.score_state} />

      {/* Clickable panels */}
      <StrainPanels data={panelData} records={cycles} />

      {/* Trend charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="glass-card p-5">
          <h3 className="text-sm font-semibold text-text-primary mb-1">Esforço por ciclo</h3>
          <p className="text-xs text-text-tertiary mb-3">Pontuação de esforço por ciclo</p>
          <TrendChart intervals selection={period} data={dailyStrainTrend} color="var(--color-strain)" label="Esforço" domain={[0, 21]} height={220} />
        </div>
        <div className="glass-card p-5">
          <h3 className="text-sm font-semibold text-text-primary mb-1">Calorias por ciclo</h3>
          <p className="text-xs text-text-tertiary mb-3">Convertidas de quilojoules</p>
          <TrendChart intervals selection={period} data={calorieTrend} color="#f97316" label="Calorias" unit=" kcal" height={220} />
        </div>
      </div>

      {/* Cycle history */}
      {cycles.length > 0 && (
        <div className="glass-card p-5">
          <h3 className="text-sm font-semibold text-text-primary mb-4">Histórico de ciclos</h3>
          <div className="space-y-1">
            {cycles.map((c: Cycle, i: number) => {
              const s = c.strain != null ? Number(c.strain) : null;
              return (
                <div key={i} className="flex items-center gap-3 px-3 py-2.5 rounded-lg hover:bg-surface-1/50 transition-colors">
                  <Flame className="w-3.5 h-3.5 text-strain" />
                  <span className="text-sm text-text-secondary flex-1">{formatRecordInterval(c.start_time, c.end_time)}</span>
                  <span className="text-sm font-medium text-text-primary">{s != null ? formatNumber(s, 1) : "Não disponível"}</span>
                  <span className="text-xs text-text-muted w-20 text-right">{c.kilojoule != null ? formatCalories(Number(c.kilojoule)) : "--"}</span>
                  <span className="text-xs text-text-muted w-16 text-right">{c.average_heart_rate != null ? `${c.average_heart_rate} bpm` : "--"}</span>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
