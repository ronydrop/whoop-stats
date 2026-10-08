import Link from "next/link";
import { notFound } from "next/navigation";
import { readExtra } from "@/lib/whoop-extras-server";
import { parseStrength, parseExerciseHistory } from "@/lib/whoop-extras";
import { periodRecords } from "@/lib/api/period-records";
import { resolvePeriod, periodQuery, type SearchParams } from "@/lib/period";
import { isStrengthSport } from "@/lib/metrics";
import { MetricCard } from "@/components/metric-card";
import { ExtraStatus } from "@/components/extra-status";
import { formatNumber, formatRecordInterval, formatFullDate } from "@/lib/format";

export const dynamic = "force-dynamic";
function sessionDate(date: string | null): string {
  if (!date) return "Data não disponível";
  const timestamp = /^\d{4}-\d{2}-\d{2}$/.test(date) ? `${date}T12:00:00-03:00` : date;
  return Number.isFinite(Date.parse(timestamp)) ? formatFullDate(timestamp) : date;
}
export default async function StrengthPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<SearchParams> }) {
  const { id } = await params, search = await searchParams, period = resolvePeriod(search), query = periodQuery(period);
  if (!/^[a-f0-9-]{36}$/.test(id)) notFound();
  const workout = (await periodRecords("workouts", period)).find(record => record.id === id);
  if (!workout || !isStrengthSport(workout.sport_name)) notFound();
  const view = await readExtra(`/core-details-bff/v1/cardio-details?activityId=${id}`, parseStrength, 300_000);
  const exercise = view.data?.exercises.find(exercise => exercise.id === search.exercise && /^[A-Za-z0-9_-]+$/.test(exercise.id));
  const history = exercise ? await readExtra(`/weightlifting-service/v3/exercise/${exercise.id}/exercise_history`, parseExerciseHistory, 300_000) : null;
  return <div className="dashboard-page">
    <header><span className="page-kicker">SEU PAINEL WHOOP</span><h1 className="text-2xl font-semibold tracking-tight">Detalhes de força</h1><p className="mt-1 text-sm text-text-secondary">{formatRecordInterval(workout.start_time, workout.end_time)}</p></header>
    <Link href={`/workouts?${query}`} className="text-xs text-accent-hover">← Voltar aos treinos</Link>
    <ExtraStatus view={view} />
    <div className="grid gap-4 sm:grid-cols-2"><MetricCard title="Volume total" value={view.data?.volumeKg == null ? "—" : `${formatNumber(view.data.volumeKg)} kg`} description="Soma das cargas multiplicadas pelas repetições, conforme os dados do Strength Trainer. Libras são convertidas para quilogramas quando a unidade está explícita." /><MetricCard title="Participação muscular no esforço" value={view.data?.muscularPercent == null ? "—" : `${formatNumber(view.data.muscularPercent)}%`} description="Parcela do esforço que a WHOOP atribuiu à carga muscular neste treino." /></div>
    <section className="space-y-4"><div className="section-heading"><div><h2>Exercícios do treino</h2><p>Totais por exercício disponibilizados pela WHOOP.</p></div></div>
      {view.data?.exercises.length ? <div className="glass-card overflow-x-auto p-4"><table className="w-full text-left text-xs"><thead><tr><th className="py-3 pr-4">Exercício</th><th className="px-3">Séries</th><th className="px-3">Repetições</th><th className="px-3">Volume</th><th className="px-3">Detalhes</th></tr></thead><tbody>{view.data.exercises.map(item => <tr key={item.id} className="border-t border-border-subtle"><td className="py-3 pr-4">{item.name}</td><td className="px-3">{item.sets ?? "—"}</td><td className="px-3">{item.reps ?? "—"}</td><td className="whitespace-nowrap px-3">{item.volumeKg == null ? "—" : `${formatNumber(item.volumeKg)} kg`}</td><td className="whitespace-nowrap px-3"><Link className="text-accent-hover underline" href={`/workouts/${id}/strength?${query}&exercise=${encodeURIComponent(item.id)}`}>Ver séries</Link></td></tr>)}</tbody></table></div> : <p className="glass-card p-5 text-sm text-text-secondary">A WHOOP não disponibilizou o detalhamento por exercício deste treino.</p>}
    </section>
    {exercise && history && <section className="space-y-4"><div className="section-heading"><div><h2>Histórico por série · {exercise.name}</h2><p>Sessões recebidas para este exercício. Cada sessão mantém sua data e suas unidades.</p></div></div><ExtraStatus view={history} />
      {history.data?.length ? history.data.map((session, index) => <div key={index} className="glass-card p-4"><h3 className="mb-3 text-sm font-semibold">{sessionDate(session.date)}</h3>{session.sets.length ? <table className="w-full text-left text-xs"><thead><tr><th className="py-2">Série</th><th>Repetições</th><th>Carga ou duração</th></tr></thead><tbody>{session.sets.map((set, i) => <tr key={i} className="border-t border-border-subtle"><td className="py-2">{i + 1}</td><td>{set.reps ?? "—"}</td><td>{set.seconds !== null ? `${formatNumber(set.seconds)} s` : set.weight === null ? "—" : set.unit && /lb/i.test(set.unit) ? `${formatNumber(set.weight * 0.45359237, 1)} kg` : `${formatNumber(set.weight, 1)} ${set.unit ?? "(unidade não informada)"}`}</td></tr>)}</tbody></table> : <p className="text-sm text-text-secondary">Séries individuais não disponíveis para esta sessão.</p>}</div>) : <p className="glass-card p-5 text-sm text-text-secondary">Não há séries individuais disponibilizadas para este exercício.</p>}
    </section>}
  </div>;
}
