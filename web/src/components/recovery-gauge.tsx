"use client";
import { getRecoveryColorValue } from "@/lib/format";
export function RecoveryGauge({ score, size = 200 }: { score: number | null; size?: number }) {
  const color = score == null ? "var(--color-text-muted)" : getRecoveryColorValue(score);
  const circumference = 2 * Math.PI * 76;
  return <div className="relative mx-auto" style={{ width: size, height: size }}>
    <svg width={size} height={size} viewBox="0 0 180 180" role="img" aria-label={score == null ? "Recuperação não disponível" : `Recuperação: ${score}%`}>
      <circle cx="90" cy="90" r="76" fill="none" stroke="var(--color-surface-2)" strokeWidth="10" />
      {score != null && <circle cx="90" cy="90" r="76" fill="none" stroke={color} strokeWidth="10" strokeLinecap="round" strokeDasharray={`${circumference * Math.max(0, Math.min(score, 100)) / 100} ${circumference}`} transform="rotate(-90 90 90)" />}
    </svg>
    <div aria-hidden="true" className="absolute inset-0 flex flex-col items-center justify-center gap-2"><strong className="text-4xl font-semibold tracking-tight" style={{ color }}>{score == null ? "—" : `${score}%`}</strong><span className="text-[10px] uppercase tracking-[.16em] text-text-muted">Recuperação</span></div>
  </div>;
}