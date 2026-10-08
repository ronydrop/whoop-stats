import Link from "next/link";
import { addDays, dateKey, periodQuery, type Period } from "@/lib/period";
import { formatFullDate, formatShortDate } from "@/lib/format";

const inputClass = "period-input";
const buttonClass = "primary-button";

export function PeriodFilter({ period, pathname }: { period: Period; pathname: string }) {
  const today = dateKey(new Date());
  const label = period.start === period.end ? formatFullDate(period.start + "T12:00:00Z") : `${formatShortDate(period.start + "T12:00:00Z")} a ${formatFullDate(period.end + "T12:00:00Z")}`;
  return (
    <section className="space-y-3" aria-label="Filtro de período">
      <div className="period-toolbar">
        <details className="period-section" open>
          <summary className="cursor-pointer text-sm font-medium">Período: {label}</summary>
          <div className="">
            <div className="period-presets" aria-label="Atalhos de período">
              {[{ label: "Hoje", days: 1, offset: 0 }, { label: "Ontem", days: 1, offset: -1 }, { label: "7 dias", days: 7, offset: 0 }, { label: "30 dias", days: 30, offset: 0 }, { label: "Este mês", days: Number(today.slice(-2)), offset: 0 }].map(preset => {
                const last = addDays(today, preset.offset);
                const start = addDays(last, 1 - preset.days);
                return <Link key={preset.label} href={pathname + "?" + periodQuery({ start, end: last })} aria-current={start === period.start && last === period.end ? "date" : undefined}
                  >{preset.label}</Link>;
              })}
            </div>
            <form action={pathname} method="get" className="period-form">
              <label className="min-w-0 text-sm text-text-secondary">Data inicial<input aria-label="Data inicial" name="start" type="date" defaultValue={period.start} max={today} required className={inputClass} /></label>
              <label className="min-w-0 text-sm text-text-secondary">Data final<input aria-label="Data final" name="end" type="date" defaultValue={period.end} max={today} required className={inputClass} /></label>
              <button type="submit" className={buttonClass}>Aplicar período</button>
            </form>
          </div>
        </details>
        <details className="period-section" open>
          <summary className="cursor-pointer text-sm">Comparar</summary>
          <form action={pathname} method="get" className="period-form">
            <input type="hidden" name="start" value={period.start} /><input type="hidden" name="end" value={period.end} />
            <label className="block text-sm text-text-secondary">Primeiro dia<input aria-label="Primeiro dia" type="date" name="first" defaultValue={period.first ?? period.end} min={period.start} max={period.end} required className={inputClass} /></label>
            <label className="block text-sm text-text-secondary">Comparar com<input aria-label="Comparar com" type="date" name="compare" defaultValue={period.compare ?? period.start} min={period.start} max={period.end} required className={inputClass} /></label>
            <button type="submit" className={buttonClass}>Comparar dias</button>
          </form>
        </details>
      </div>
      {period.error && <p role="alert" className="text-sm text-rose-400">{period.error}</p>}
      {period.first && period.compare && <div className="flex flex-wrap items-center gap-3 text-sm"><span>Comparando {formatFullDate(period.first + "T12:00:00Z")} com {formatFullDate(period.compare + "T12:00:00Z")}</span><Link className="text-accent-hover underline" href={`${pathname}?${periodQuery({ start: period.start, end: period.end })}`}>Limpar comparação</Link></div>}
      <p className="period-meta">Horário de Brasília</p>
    </section>
  );
}
