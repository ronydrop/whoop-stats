import Link from "next/link";
import { Activity, Moon, HeartPulse, Dumbbell, ArrowUpRight, Footprints, Flame } from "lucide-react";
import { periodRecords } from "@/lib/api/period-records";
import { client } from "@/lib/api/client";
import { resolvePeriod, periodQuery, addDays, type SearchParams } from "@/lib/period";
import { metric, sleepDuration, workoutSummary } from "@/lib/metrics";
import { formatNumber, formatDuration, formatCalories, getRecoveryColor, getRecoveryLabel, formatShortDate } from "@/lib/format";
import { PeriodFilter } from "@/components/period-filter";
import { DayComparison } from "@/components/day-comparison";
import { MetricCard } from "@/components/metric-card";
import { RecordContext } from "@/components/record-context";
import { TrendChart } from "@/components/trend-chart";
import { RecentWorkouts } from "@/components/recent-workouts";
import { InfoTooltip } from "@/components/info-tooltip";

export const dynamic = "force-dynamic";

export default async function OverviewPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const period = resolvePeriod(await searchParams);
  const week = { start: addDays(period.end, -6), end: period.end, singleDay: false, error: period.error };
  const [profile, cycles, sleeps, workouts, recoveries, weeklyWorkouts] = await Promise.all([
    client.GET("/api/v1/user/profile"), periodRecords("cycles", period), periodRecords("sleeps", period),
    periodRecords("workouts", period), periodRecords("recoveries", period), periodRecords("workouts", week),
  ]);
  const cycle = cycles[0], sleep = sleeps.find(s => s.nap === false), recovery = recoveries[0];
  const score = metric(recovery, "recovery_score"), strain = metric(cycle, "strain");
  const hours = sleep?.score_state === "SCORED" ? sleepDuration(sleep) : null;
  const consistency = metric(sleep, "sleep_consistency_percentage"), debt = metric(sleep, "sleep_debt_milli");
  const hrv = metric(recovery, "hrv_rmssd_milli"), restingHR = metric(recovery, "resting_heart_rate");
  const energy = metric(cycle, "kilojoule");
  const steps = cycle?.step_count;
  const weekly = workoutSummary(weeklyWorkouts);
  const query = periodQuery(period);
  const duration = (value: number | null) => value == null ? "—" : formatDuration(value);
  const sleepReference = sleep?.end_time ? `Sono encerrado em ${formatShortDate(sleep.end_time)}` : "Sem sono principal no período";
  const recoveryReference = recovery?.reference_time ? `Após o sono de ${formatShortDate(recovery.reference_time)}` : "Sem recuperação no período";
  const cycleReference = cycle ? `Ciclo iniciado em ${formatShortDate(cycle.start_time)}${cycle.end_time ? "" : " · em andamento"}` : "Sem ciclo no período";
  const coverage = (count: number, total: number) => total ? `${count}/${total} treinos com dados${count < total ? " · total parcial" : ""}` : "Nenhum treino registrado";

  return <div className="dashboard-page">
    <header><span className="page-kicker">SEU PAINEL WHOOP</span><h1>Visão geral</h1><p>{profile.data?.first_name ? `${profile.data.first_name}, acompanhe` : "Acompanhe"} sua recuperação, sono e atividades.</p></header>
    <PeriodFilter pathname="/" period={period} key={query} />
    {period.compare && <DayComparison period={period} pathname="/" />}

    <section aria-labelledby="latest-title">
      <div className="section-heading"><div><h2 id="latest-title">Seus últimos registros</h2><p>Último ciclo, sono principal e recuperação dentro do período selecionado.</p></div></div>
      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        <MetricCard className="metric-featured" title="Recuperação" description="Estimativa WHOOP de como seu corpo está recuperado após o sono. Combina sono, VFC e outros sinais do corpo. Uma porcentagem maior indica maior recuperação estimada." value={score == null ? "—" : `${formatNumber(score)}%`} accentColor={score == null ? "none" : getRecoveryColor(score)} icon={<HeartPulse className="size-4" />} subtitle={score == null ? "Sem medição neste período" : getRecoveryLabel(score)}>
          <RecordContext start={recovery?.reference_time} end={recovery?.reference_time} label="Após o sono" state={recovery?.score_state} />
        </MetricCard>
        <MetricCard className="metric-featured" title="Esforço do ciclo" description="Carga de esforço acumulada no ciclo, em uma escala de 0 a 21. Valores maiores indicam mais esforço. O ciclo pode atravessar mais de um dia." value={strain == null ? "—" : formatNumber(strain, 1)} accentColor="blue" icon={<Activity className="size-4" />} subtitle="Pontuação WHOOP · de 0 a 21">
          <RecordContext start={cycle?.start_time} end={cycle?.end_time} label={cycle?.end_time ? "Ciclo completo" : "Ciclo em andamento"} state={cycle?.score_state} />
        </MetricCard>
        <MetricCard className="metric-featured" title="Horas de sono" description="Tempo em que você dormiu no último sono principal. Desconta os períodos acordado e não inclui cochilos." value={duration(hours)} accentColor="violet" icon={<Moon className="size-4" />} subtitle="Tempo dormido no último sono principal">
          <Link className="inline-flex items-center gap-2 text-xs text-sleep" href={`/sleep?${query}`}>Ver análise do sono<ArrowUpRight className="size-3" /></Link>
          <RecordContext start={sleep?.start_time} end={sleep?.end_time} label="Sono principal" state={sleep?.score_state} />
        </MetricCard>
      </div>
      <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
        <MetricCard title="VFC (HRV)" description="Variação do intervalo de tempo entre os batimentos, medida em milissegundos. Compare com seu próprio histórico para acompanhar sua recuperação." value={hrv == null ? "—" : `${formatNumber(hrv, 1)} ms`} subtitle={recoveryReference} accentColor="green" />
        <MetricCard title="Frequência cardíaca de repouso" description="Estimativa WHOOP dos batimentos por minuto em repouso. Acompanhe as mudanças em relação ao seu padrão habitual." value={restingHR == null ? "—" : `${formatNumber(restingHR)} bpm`} subtitle={recoveryReference} accentColor="green" />
        <MetricCard title="Consistência do sono" description="Indica quanto seus horários de dormir e acordar se repetem de um dia para outro. Uma porcentagem maior indica uma rotina mais regular." value={consistency == null ? "—" : `${formatNumber(consistency)}%`} subtitle={sleepReference} accentColor="violet" />
        <MetricCard title="Déficit de sono" description="Sono que faltou em noites anteriores e que a WHOOP considera na necessidade deste sono. O valor corresponde ao registro mostrado no card." value={duration(debt)} subtitle={<>Déficit considerado para esse sono<br />{sleepReference}</>} accentColor="violet" />
        <MetricCard title="Passos do ciclo" description="Passos detectados durante todo o ciclo indicado. Como o ciclo pode atravessar dias, o total pode diferir da contagem de um único dia do calendário." value={steps == null ? "—" : formatNumber(steps)} subtitle={steps == null ? "Sem contagem de passos recebida para este ciclo" : cycleReference} icon={<Footprints className="size-4" />} />
        <MetricCard title="Calorias do ciclo" description="Estimativa do gasto de energia durante todo o ciclo, incluindo repouso e atividades. As calorias dos treinos já estão incluídas nesse total." value={energy == null ? "—" : formatCalories(energy)} subtitle={cycleReference} icon={<Flame className="size-4" />} />
      </div>
      <p className="mt-3 text-xs leading-relaxed text-text-muted">Passos e calorias abrangem o ciclo completo, que pode atravessar dias. As calorias dos treinos já estão incluídas.</p>
    </section>

    <section aria-labelledby="week-title">
      <div className="section-heading"><div><h2 id="week-title">Atividade na semana</h2><p>7 dias até o fim da seleção · {formatShortDate(`${week.start}T12:00:00-03:00`)} a {formatShortDate(`${week.end}T12:00:00-03:00`)}</p></div><Dumbbell className="size-5 text-accent-hover" /></div>
      <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
        <MetricCard title="Tempo em treinos de força" description="Soma da duração dos treinos identificados como força e iniciados nesses sete dias. Inclui a sessão inteira, com seus intervalos de descanso." value={duration(weekly.strengthMs)} subtitle={weekly.strengthCount ? coverage(weekly.strengthMeasured, weekly.strengthCount) : "Nenhum treino de força registrado"} />
        <MetricCard title="Zonas cardíacas 1–3" description="Tempo com frequência cardíaca em intensidade leve a moderada, somado nos treinos desses sete dias. Considera somente os treinos registrados com dados de zonas." value={duration(weekly.zonesLowMs)} subtitle={coverage(weekly.zonesLowMeasured, weekly.workoutCount)} accentColor="blue" />
        <MetricCard title="Zonas cardíacas 4–5" description="Tempo com frequência cardíaca em intensidade alta a muito alta, somado nos treinos desses sete dias. Considera somente os treinos registrados com dados de zonas." value={duration(weekly.zonesHighMs)} subtitle={coverage(weekly.zonesHighMeasured, weekly.workoutCount)} accentColor="yellow" />
      </div>
      <details className="mt-3 text-xs leading-relaxed text-text-muted"><summary className="cursor-pointer">O que entra nesses totais</summary><p className="mt-2">São consideradas as sessões iniciadas nesses 7 dias, com sua duração integral. Força inclui musculação, powerlifting e modalidades identificadas como treino de força. As zonas cardíacas somam apenas treinos registrados: não representam todo o dia e podem diferir dos totais do aplicativo.</p></details>
    </section>

    <section aria-labelledby="trends-title">
      <div className="section-heading"><div><h2 id="trends-title">Evolução no período</h2><p>Esforço e recuperação lado a lado, respeitando a referência de cada registro.</p></div></div>
      <div className="grid gap-4 lg:grid-cols-2">
        <div className="glass-card p-5"><div className="mb-4 flex items-center gap-1"><h3 className="text-sm font-medium">Esforço por ciclo</h3><InfoTooltip title="Esforço por ciclo" description="Mostra como o esforço de cada ciclo variou no período selecionado. Um ciclo que atravessa dias mantém sua pontuação inteira." /></div><TrendChart selection={period} intervals label="Esforço" domain={[0,21]} color="var(--color-strain)" height={180} data={cycles.map(c => ({date:c.start_time,end:c.end_time,updatedAt:c.updated_at,value:metric(c,"strain")}))} /></div>
        <div className="glass-card p-5"><div className="mb-4 flex items-center gap-1"><h3 className="text-sm font-medium">Recuperação após o sono</h3><InfoTooltip title="Recuperação após o sono" description="Mostra a recuperação registrada após cada sono no período selecionado. Cada ponto corresponde ao horário de referência daquela recuperação." /></div><TrendChart selection={period} label="Recuperação" unit="%" domain={[0,100]} color="var(--color-recovery-green)" height={180} data={recoveries.map(r => ({date:r.reference_time!,value:metric(r,"recovery_score")}))} /></div>
      </div>
    </section>

    <section><div className="section-heading"><div><h2>Atividades recentes</h2><p>{workouts.length} treinos iniciados no período selecionado</p></div><Link href={`/workouts?${query}`} className="text-xs text-accent-hover">Ver todos →</Link></div>{workouts.length ? <RecentWorkouts workouts={workouts} /> : <p className="glass-card p-6 text-sm text-text-muted">Nenhum treino registrado neste período.</p>}</section>
    <p className="text-xs leading-relaxed text-text-muted">Explore também o <a href="/stress" className="underline underline-offset-4">estresse</a>, o <a href="/journal" className="underline underline-offset-4">Diário</a> e o <a href="/fitness" className="underline underline-offset-4">VO₂ Max</a> pela conexão complementar WHOOP.</p>
  </div>;
}
