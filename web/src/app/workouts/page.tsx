import { periodRecords } from "@/lib/api/period-records";
import { resolvePeriod, type SearchParams } from "@/lib/period";
import { PeriodFilter } from "@/components/period-filter";
import { DayComparison } from "@/components/day-comparison";
import { WorkoutFeed } from "@/components/workout-feed";
import { StrengthWorkouts } from "@/components/strength-workouts";
import type { Workout } from "@/lib/types";

export const dynamic = "force-dynamic";

export default async function WorkoutsPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const period = resolvePeriod(await searchParams);
  const workoutsRes = await periodRecords("workouts", period);

  const workouts = (workoutsRes as Workout[]) || [];


  return (
    <div className="dashboard-page">
      <header><span className="page-kicker">SEU PAINEL WHOOP</span>
        <h1 className="text-2xl font-semibold tracking-tight text-text-primary">
          Treinos
        </h1>
        <p className="text-sm text-text-tertiary mt-0.5">
          {workouts.length} {workouts.length === 1 ? "atividade registrada" : "atividades registradas"}
        </p>
      </header>
      <PeriodFilter pathname="/workouts" key={`${period.start}-${period.end}-${period.first}-${period.compare}`} period={period} />
      {period.compare && <DayComparison period={period} pathname="/workouts" />}

      <WorkoutFeed workouts={workouts} />
      <StrengthWorkouts workouts={workouts} period={period} />
    </div>
  );
}
