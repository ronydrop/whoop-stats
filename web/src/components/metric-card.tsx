"use client";
import { type ReactNode, type CSSProperties } from "react";
import { ArrowUpRight } from "lucide-react";
import { cn } from "@/lib/utils";
import { InfoTooltip } from "@/components/info-tooltip";

interface MetricCardProps {
  title: string; value: string | number; subtitle?: ReactNode; icon?: ReactNode; description?: string;
  accentColor?: "green" | "yellow" | "red" | "blue" | "violet" | "none";
  className?: string; children?: ReactNode; visual?: ReactNode; onClick?: () => void;
}
const colors = { green: "var(--color-recovery-green)", yellow: "var(--color-recovery-yellow)", red: "var(--color-recovery-red)", blue: "var(--color-strain)", violet: "var(--color-sleep)", none: "var(--color-accent-hover)" };
export function MetricCard({ title, value, subtitle, icon, description, accentColor = "none", className, children, visual, onClick }: MetricCardProps) {
  return <div className={cn("metric-card", className)} style={{ "--metric-color": colors[accentColor] } as CSSProperties} data-interactive={!!onClick} onClick={onClick} role={onClick ? "button" : undefined} tabIndex={onClick ? 0 : undefined} onKeyDown={onClick ? e => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); onClick(); } } : undefined}>
    <div className="flex items-center justify-between gap-3"><div className="flex min-w-0 items-center gap-1"><h3 className="metric-title">{title}</h3>{description && <InfoTooltip title={title} description={description} />}</div>{icon && <span className="metric-icon">{icon}</span>}</div>
    <div className={cn("metric-value break-words", String(value).length > 12 && "!text-xl")}>{value}</div>
    {subtitle && <div className="mt-2 text-xs leading-relaxed text-text-secondary">{subtitle}</div>}
    {visual && <div className="metric-visual">{visual}</div>}
    {children && <div className="mt-3 flex flex-1 flex-col justify-end">{children}</div>}
    {onClick && <span className="mt-4 flex items-center gap-1 text-[11px] text-text-muted">Ver detalhes<ArrowUpRight className="size-3" aria-hidden="true" /></span>}
  </div>;
}
