"use client";

import { useEffect, useState } from "react";
import { Sunrise, Timer } from "lucide-react";
import { MetricCard } from "@/components/metric-card";
import { formatElapsedTime, formatFullDate, formatTime } from "@/lib/format";

export function WakeCards({ wakeTime, live, initialNow }: { wakeTime?: string | null; live: boolean; initialNow: number }) {
  const [now, setNow] = useState(initialNow);
  const wakeTimestamp = wakeTime ? Date.parse(wakeTime) : NaN;
  const hasWakeTime = Number.isFinite(wakeTimestamp) && wakeTimestamp <= now;

  useEffect(() => {
    if (!live || !hasWakeTime) return;
    const interval = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(interval);
  }, [wakeTime, live, hasWakeTime]);

  return <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
    <MetricCard title="Acordei às" description="Horário de término do último sono principal registrado pela WHOOP no período selecionado. Exibido no fuso de São Paulo; cochilos não alteram esse horário." value={hasWakeTime ? formatTime(wakeTime!) : "—"} subtitle={hasWakeTime ? `${formatFullDate(wakeTime!)} · horário de São Paulo` : "Sem horário de despertar registrado"} icon={<Sunrise className="size-4" />} accentColor="yellow" />
    <MetricCard title="Tempo acordado" description="Tempo decorrido desde o término desse sono principal, atualizado a cada segundo. É calculado pelo horário do dispositivo e não desconta cochilos ou períodos sem medição." value={live && hasWakeTime ? formatElapsedTime(now - wakeTimestamp) : "—"} subtitle={!hasWakeTime ? "Sem horário de despertar registrado" : live ? "Desde o último sono principal · atualização a cada segundo" : "Contador disponível em períodos que incluem hoje"} icon={<Timer className="size-4" />} accentColor="yellow" className="[&_.metric-value]:tabular-nums" />
  </div>;
}
