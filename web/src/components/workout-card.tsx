"use client";

import { sportLabel } from "@/lib/sports";


import { cn } from "@/lib/utils";
import { MetricComposition } from "@/components/metric-visual";
import { formatNumber, formatDuration, formatCalories, formatFullDate, formatTime, HR_ZONE_COLORS } from "@/lib/format";
import { dateKey } from "@/lib/period";
import { Flame, Clock } from "lucide-react";

interface WorkoutCardProps {
  sportName: string;
  strain: number | null;
  kilojoule: number | null;
  startTime: string;
  endTime?: string | null;
  averageHeartRate?: number;
  maxHeartRate?: number;
  zones: (number | null)[]; // [zone0ms, zone1ms, zone2ms, zone3ms, zone4ms, zone5ms]
  className?: string;
}

export function WorkoutCard({
  sportName,
  strain,
  kilojoule,
  startTime,
  endTime,
  averageHeartRate,
  maxHeartRate,
  zones,
  className,
}: WorkoutCardProps) {
  const start = new Date(startTime);
  const end = endTime ? new Date(endTime) : null;
  const durationMs = end ? end.getTime() - start.getTime() : 0;
  const completeZones = zones.every((z): z is number => z != null) ? zones : [];
  const totalZoneMs = completeZones.reduce((acc, z) => acc + z, 0);

  return (
    <div
      className={cn(
        "group rounded-2xl border border-border-default bg-surface-0 p-5 transition-colors duration-200 hover:border-border-hover hover:bg-surface-1",
        className
      )}
    >
      <div className="flex items-start justify-between">
        <div>
          <h4 className="text-sm font-semibold text-text-primary">{sportLabel(sportName || "Atividade")}</h4>
          <p className="text-xs text-text-tertiary mt-0.5">
            {start.toLocaleDateString("pt-BR", { timeZone: "America/Sao_Paulo", weekday: "short", month: "short", day: "numeric" })}
          </p>
          <p className="mt-1 text-xs text-text-secondary">
            <time dateTime={startTime}>{formatTime(startTime)}</time>
            {endTime ? <> → <time dateTime={endTime}>{dateKey(startTime) !== dateKey(endTime) ? `${formatFullDate(endTime)} às ` : ""}{formatTime(endTime)}</time></> : " · término não informado"}
            <span className="text-text-muted"> · Brasília</span>
          </p>
        </div>
        <div className="flex items-center gap-1 text-xs font-medium text-strain">
          <Flame className="w-3.5 h-3.5" />
          {strain == null ? "Não disponível" : formatNumber(strain, 1)}
        </div>
      </div>

      {/* Stats row */}
      <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-2 text-xs text-text-secondary">
        {end && durationMs >= 0 && (
          <span className="flex items-center gap-1">
            <Clock className="w-3 h-3 text-text-muted" />
            {formatDuration(durationMs)}
          </span>
        )}
        <span>{kilojoule == null ? "Não disponível" : formatCalories(kilojoule)}</span>
        {averageHeartRate != null ? <span>Média {averageHeartRate} bpm</span> : null}
        {maxHeartRate != null ? <span>Máxima {maxHeartRate} bpm</span> : null}
      </div>

      {totalZoneMs > 0 && (
        <div className="workout-zone-visual mt-4">
          <p className="text-[11px] text-text-muted">Tempo registrado nas zonas de FC</p>
          <MetricComposition label="Tempo acumulado nas zonas de frequência cardíaca" format={formatDuration} parts={completeZones.map((value, i) => ({ label: `Zona ${i}`, value, color: HR_ZONE_COLORS[i] }))} />
        </div>
      )}
    </div>
  );
}
