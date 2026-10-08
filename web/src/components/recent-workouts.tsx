"use client";

import { useState } from "react";
import { WorkoutCard } from "@/components/workout-card";
import { WorkoutDetail } from "@/components/workout-detail";

import type { Workout } from "@/lib/types";

export function RecentWorkouts({ workouts }: { workouts: Workout[] }) {
  const [detailWorkout, setDetailWorkout] = useState<Workout | null>(null);

  return (
    <>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {workouts.map((w, i) => (
          <div key={i} role="button" tabIndex={0} onKeyDown={e => { if(e.key === "Enter" || e.key === " "){e.preventDefault();setDetailWorkout(w);} }} onClick={() => setDetailWorkout(w)} className="cursor-pointer">
            <WorkoutCard
              sportName={w.sport_name || "Atividade"}
              strain={w.strain}
              kilojoule={w.kilojoule}
              startTime={w.start_time}
              endTime={w.end_time}
              averageHeartRate={w.average_heart_rate ? Number(w.average_heart_rate) : undefined}
              maxHeartRate={w.max_heart_rate ? Number(w.max_heart_rate) : undefined}
              zones={[
                w.zone_zero_milli,
                w.zone_one_milli,
                w.zone_two_milli,
                w.zone_three_milli,
                w.zone_four_milli,
                w.zone_five_milli,
              ]}
            />
          </div>
        ))}
      </div>

      {detailWorkout && (
        <WorkoutDetail workout={detailWorkout} onClose={() => setDetailWorkout(null)} />
      )}
    </>
  );
}
