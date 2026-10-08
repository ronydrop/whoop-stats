import Link from "next/link";
import type { ExtraView } from "@/lib/whoop-extras-server";
import { formatFullDate, formatTime } from "@/lib/format";

export function ExtraStatus({ view }: { view: ExtraView<unknown> }) {
  return <div className="space-y-2 text-xs leading-relaxed text-text-muted">
    {view.message && <p role="status" className="rounded-xl border border-border-default bg-surface-0 p-3 text-sm text-text-secondary">{view.message}{view.stale && " Exibindo a última consulta salva."} {!view.connected && <Link href="/stress" className="text-accent-hover underline">Abrir conexão</Link>}</p>}
    {view.fetchedAt && <p>Dados WHOOP · {view.stale ? "Consulta salva" : "Consultado"} em {formatFullDate(view.fetchedAt)} às {formatTime(view.fetchedAt)} · Horário de Brasília.</p>}
  </div>;
}

export function ExtraDayFilter({ date, today, pathname }: { date: string; today: string; pathname: string }) {
  return <form action={pathname} className="glass-card flex flex-wrap items-end gap-3 p-4">
    <label className="text-xs text-text-secondary">Dia analisado<input aria-label="Dia analisado" className="period-input mt-1" type="date" name="day" defaultValue={date} max={today} required /></label>
    <button className="primary-button">Ver dia</button>
  </form>;
}
