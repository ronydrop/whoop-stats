"use client";

import { useModalFocus } from "./detail-popup";
import { formatRecordInterval } from "@/lib/format";
import { sportLabel } from "@/lib/sports";


import { X, Flame, Clock, Heart, Zap } from "lucide-react";
import { formatNumber, formatDuration, formatCalories, HR_ZONE_COLORS, HR_ZONE_LABELS } from "@/lib/format";
import { cn } from "@/lib/utils";

import type { Workout } from "@/lib/types";

interface WorkoutDetailProps {
  workout: Workout;
  onClose: () => void;
}

export function WorkoutDetail({ workout: w, onClose }: WorkoutDetailProps) {
  const modal = useModalFocus(onClose);
  const start = new Date(w.start_time);
  const end = w.end_time ? new Date(w.end_time) : null;
  const durationMs = end ? end.getTime() - start.getTime() : 0;

  const rawZones = [
    w.zone_zero_milli,
    w.zone_one_milli,
    w.zone_two_milli,
    w.zone_three_milli,
    w.zone_four_milli,
    w.zone_five_milli,
  ];
  const zones = rawZones.every((z): z is number => z != null) ? rawZones : [];
  const totalZoneMs = zones.reduce((a, b) => a + b, 0);

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4" onClick={onClose}>
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />
      <div ref={modal} role="dialog" aria-modal="true" aria-label="Detalhes do treino" tabIndex={-1}
        className="relative max-h-[85vh] overflow-y-auto w-full max-w-md rounded-2xl border border-border-subtle bg-surface-0/95 backdrop-blur-xl p-6 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Close */}
        <button
          aria-label="Fechar detalhes do treino"
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
            {formatRecordInterval(w.start_time, w.end_time)}
          </p>
        </div>

        {/* Key stats */}
        <div className="grid grid-cols-2 gap-3 mb-5">
          <Stat icon={<Flame className="w-3.5 h-3.5" />} label="Esforço" value={w.strain != null ? formatNumber(Number(w.strain), 1) : "--"} color="text-strain" />
          <Stat icon={<Clock className="w-3.5 h-3.5" />} label="Duração" value={end && durationMs >= 0 ? formatDuration(durationMs) : "--"} />
          <Stat label="Calorias" value={w.kilojoule != null ? formatCalories(Number(w.kilojoule)) : "--"} />
          <Stat label="Registro disponível" value={w.percent_recorded != null ? `${formatNumber(Number(w.percent_recorded), 0)}%` : "--"} />
          <Stat icon={<Heart className="w-3.5 h-3.5" />} label="FC média" value={w.average_heart_rate != null ? `${w.average_heart_rate} bpm` : "--"} />
          <Stat icon={<Zap className="w-3.5 h-3.5" />} label="FC máxima" value={w.max_heart_rate != null ? `${w.max_heart_rate} bpm` : "--"} />
          {w.distance_meter != null && (
            <Stat label="Distância" value={`${formatNumber((Number(w.distance_meter) / 1000), 2)} km`} />
          )}
          {w.altitude_gain_meter != null && (
            <Stat label="Ganho de elevação" value={`${formatNumber(Number(w.altitude_gain_meter), 0)} m`} />
          )}
        </div>

        <p className="text-xs text-text-tertiary mb-4">{w.score_state === "SCORED" ? "Fornecido pela WHOOP. Duração e kcal calculadas pelo painel." : "Pontuação em processamento ou não disponível."} As zonas representam tempos acumulados, sem distribuição por hora.</p>
        {!zones.length && <p className="text-xs text-text-muted">Zonas de frequência cardíaca não disponíveis.</p>}
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
