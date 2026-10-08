import Link from "next/link";
import { isStrengthSport } from "@/lib/metrics";
import { periodQuery, type Period } from "@/lib/period";
import { formatRecordInterval } from "@/lib/format";
import { sportLabel } from "@/lib/sports";
import type { Workout } from "@/lib/types";

export function StrengthWorkouts({ workouts, period }: { workouts: Workout[]; period: Period }) {
  const strength = workouts.filter(workout => isStrengthSport(workout.sport_name));
  return <section className="space-y-4"><div className="section-heading"><div><h2>Strength Trainer</h2><p>Exercícios, volume e participação muscular dos treinos de força registrados.</p></div></div>
    {strength.length ? <div className="grid gap-4 sm:grid-cols-2">{strength.map(workout => <Link key={workout.id} href={`/workouts/${workout.id}/strength?${periodQuery(period)}`} className="glass-card block p-5 transition-colors hover:bg-surface-2 focus-visible:outline-2 focus-visible:outline-accent-hover"><h3 className="text-sm font-semibold">{sportLabel(workout.sport_name ?? "weightlifting")}</h3><p className="mt-2 text-xs text-text-secondary">{formatRecordInterval(workout.start_time, workout.end_time)}</p><p className="mt-4 text-xs text-accent-hover">Ver exercícios e carga muscular →</p></Link>)}</div> : <p className="glass-card p-5 text-sm text-text-secondary">Nenhum treino de força identificado neste período. Os exercícios e séries aparecerão quando forem disponibilizados pela WHOOP para um treino registrado.</p>}
  </section>;
}
