"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { RefreshCw, HeartPulse } from "lucide-react";
import { MetricCard } from "./metric-card";
import { formatNumber, formatFullDate, formatTime } from "@/lib/format";
import type { ExtraView } from "@/lib/whoop-extras-server";
import type { LiveHeart } from "@/lib/whoop-extras";

export function LiveHeartPanel({ initial }: { initial: ExtraView<LiveHeart> }) {
  const [view, setView] = useState(initial), [automatic, setAutomatic] = useState(true), [pending, setPending] = useState(false);
  const [expired, setExpired] = useState(false);
  const inflight = useRef<AbortController | null>(null);
  const refresh = useCallback(async () => {
    if (inflight.current) return;
    const controller = new AbortController();
    inflight.current = controller;
    setPending(true);
    try {
      const result = await fetch("/api/whoop/live", { cache: "no-store", signal: controller.signal });
      if (!result.ok) throw new Error("Consulta indisponível");
      const data: ExtraView<LiveHeart> = await result.json();
      setView(data);
      setExpired(false);
    } catch {
      if (!controller.signal.aborted) setView(previous => ({ ...previous, stale: Boolean(previous.data), message: "Não foi possível atualizar a frequência cardíaca. Tente novamente." }));
    } finally { inflight.current = null; if (!controller.signal.aborted) setPending(false); }
  }, []);
  useEffect(() => {
    if (!automatic || !view.connected) return;
    const timer = setInterval(() => { if (document.visibilityState === "visible") void refresh(); }, 30_000);
    return () => clearInterval(timer);
  }, [automatic, view.connected, refresh]);
  useEffect(() => () => inflight.current?.abort(), []);
  const data = view.data;
  useEffect(() => {
    if (!data?.timestamp || !data.fresh) return;
    const remaining = 90_000 - (Date.now() - Date.parse(data.timestamp));
    const timer = setTimeout(() => setExpired(true), Math.max(0, remaining));
    return () => clearTimeout(timer);
  }, [data?.timestamp, data?.fresh]);
  const current = data?.fresh && !view.stale && !expired;
  return <div className="space-y-5">
    <div className="glass-card flex flex-wrap items-center justify-between gap-4 p-4">
      <label className="flex items-center gap-2 text-xs text-text-secondary"><input type="checkbox" checked={automatic} onChange={event => setAutomatic(event.target.checked)} />Atualizar a cada 30 segundos</label>
      <button type="button" className="flex items-center gap-2 rounded-xl border border-border-default px-3 py-2 text-sm disabled:opacity-50" disabled={pending || !view.connected} onClick={() => void refresh()}><RefreshCw className={`size-4 ${pending ? "animate-spin motion-reduce:animate-none" : ""}`} />{pending ? "Atualizando…" : "Atualizar agora"}</button>
    </div>
    {view.message && <p role="status" className="glass-card p-4 text-sm text-text-secondary">{view.message} {!view.connected && <Link href="/stress" className="text-accent-hover underline">Abrir conexão WHOOP</Link>}</p>}
    {view.connected && !data?.streaming && <p role="status" className="glass-card p-4 text-sm text-text-secondary">A WHOOP não está disponibilizando uma transmissão de frequência cardíaca neste momento. Confira a conexão da pulseira com o aplicativo.</p>}
    {data?.streaming && !current && <p role="status" className="glass-card p-4 text-sm text-text-secondary">Esta leitura não tem um horário recente confirmado. Ela está sendo mostrada como última leitura recebida.</p>}
    <div className="grid gap-4 sm:grid-cols-2">
      <MetricCard title={current ? "Frequência cardíaca atual" : "Última frequência cardíaca recebida"} value={data?.bpm == null ? "—" : `${formatNumber(data.bpm)} bpm`} subtitle={data?.timestamp ? `${formatFullDate(data.timestamp)} às ${formatTime(data.timestamp)}` : "Horário da leitura não disponível"} icon={<HeartPulse className="size-4" />} accentColor="red" description="Leitura disponibilizada pelo servidor da WHOOP. Só é chamada atual quando a transmissão está ativa e o horário tem até 90 segundos." />
      <MetricCard title="Zona cardíaca" value={data?.streaming && data.zone != null ? `Zona ${data.zone}` : "—"} subtitle="Zona informada para a leitura recebida" description="Faixa de intensidade da frequência cardíaca que a WHOOP associou à leitura. Sem transmissão, a zona fica indisponível." />
    </div>
    <p className="text-xs leading-relaxed text-text-muted">A atualização consulta a WHOOP enquanto esta página está visível. A transmissão depende da pulseira e do aplicativo.{view.fetchedAt ? ` Última consulta: ${formatTime(view.fetchedAt)} · Horário de Brasília.` : ""}</p>
  </div>;
}
