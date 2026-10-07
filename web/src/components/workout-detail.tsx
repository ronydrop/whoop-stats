"use client";

import { sportLabel } from "@/lib/sports";


import { X, Flame, Clock, Heart, Zap } from "lucide-react";
import { formatNumber, formatDuration, formatCalories, HR_ZONE_COLORS, HR_ZONE_LABELS } from "@/lib/format";
import { cn } from "@/lib/utils";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyRecord = Record<string, any>;

interface WorkoutDetailProps {
  workout: AnyRecord;
  onClose: () => void;
}

export function WorkoutDetail({ workout: w, onClose }: WorkoutDetailProps) {
  const start = new Date(w.start_time);
  const end = w.end_time ? new Date(w.end_time) : null;
  const durationMs = end ? end.getTime() - start.getTime() : 0;

  const zones = [
    Number(w.zone_zero_milli || 0),
    Number(w.zone_one_milli || 0),
    Number(w.zone_two_milli || 0),
    Number(w.zone_three_milli || 0),
    Number(w.zone_four_milli || 0),
    Number(w.zone_five_milli || 0),
  ];
  const totalZoneMs = zones.reduce((a, b) => a + b, 0);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />
      <div
        className="relative w-full max-w-md rounded-2xl border border-border-subtle bg-surface-0/95 backdrop-blur-xl p-6 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Close */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 p-1 rounded-lg text-text-muted hover:text-text-primary hover:bg-surface-2/50 transition-colors"
        >
          <X className="w-4 h-4" />
        </button>

        {/* Header */}
        <div className="mb-5">
          <h3 className="text-lg font-semibold text-text-primary">
            {sportLabel(w.sport_name || "Atividade")}
          </h3>
          <p className="text-xs text-text-tertiary mt-0.5">
            {start.toLocaleDateString("pt-BR", { timeZone: "America/Sao_Paulo", weekday: "long", month: "short", day: "numeric", year: "numeric" })}
            {" · "}
            {start.toLocaleTimeString("pt-BR", { timeZone: "America/Sao_Paulo", hour: "numeric", minute: "2-digit" })}
          </p>
        </div>

        {/* Key stats */}
        <div className="grid grid-cols-2 gap-3 mb-5">
          <Stat icon={<Flame className="w-3.5 h-3.5" />} label="Esforço" value={w.strain ? formatNumber(Number(w.strain), 1) : "--"} color="text-strain" />
          <Stat icon={<Clock className="w-3.5 h-3.5" />} label="Duração" value={durationMs > 0 ? formatDuration(durationMs) : "--"} />
          <Stat label="Calorias" value={w.kilojoule ? formatCalories(Number(w.kilojoule)) : "--"} />
          <Stat label="Registro disponível" value={w.percent_recorded ? `${formatNumber(Number(w.percent_recorded), 0)}%` : "--"} />
          <Stat icon={<Heart className="w-3.5 h-3.5" />} label="FC média" value={w.average_heart_rate ? `${w.average_heart_rate} bpm` : "--"} />
          <Stat icon={<Zap className="w-3.5 h-3.5" />} label="FC máxima" value={w.max_heart_rate ? `${w.max_heart_rate} bpm` : "--"} />
          {w.distance_meter > 0 && (
            <Stat label="Distância" value={`${formatNumber((Number(w.distance_meter) / 1000), 2)} km`} />
          )}
          {w.altitude_gain_meter > 0 && (
            <Stat label="Ganho de elevação" value={`${formatNumber(Number(w.altitude_gain_meter), 0)} m`} />
          )}
        </div>

        {/* HR Zones breakdown */}
        {totalZoneMs > 0 && (
          <div>
            <h4 className="text-xs font-medium uppercase tracking-wider text-text-tertiary mb-3">Zonas de frequência cardíaca</h4>
            <div className="space-y-1.5">
              {zones.map((z, i) => {
                const pct = (z / totalZoneMs) * 100;
                return (
                  <div key={i} className="flex items-center gap-2">
                    <span className="text-[10px] text-text-muted w-12">{HR_ZONE_LABELS[i]}</span>
                    <div className="flex-1 h-2 rounded-full bg-surface-2/50 overflow-hidden">
                      <div
                        className="h-full rounded-full transition-all duration-700"
                        style={{ width: `${pct}%`, backgroundColor: HR_ZONE_COLORS[i] }}
                      />
                    </div>
                    <span className="text-[10px] text-text-muted w-10 text-right">{formatDuration(z)}</span>
                    <span className="text-[10px] text-text-muted w-8 text-right">{formatNumber(pct, 0)}%</span>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function Stat({
  icon,
  label,
  value,
  color,
}: {
  icon?: React.ReactNode;
  label: string;
  value: string;
  color?: string;
}) {
  return (
    <div className="rounded-lg bg-surface-1/30 p-2.5">
      <div className="flex items-center gap-1 text-[10px] text-text-muted uppercase tracking-wider mb-1">
        {icon}
        {label}
      </div>
      <div className={cn("text-sm font-semibold text-text-primary", color)}>{value}</div>
    </div>
  );
}
