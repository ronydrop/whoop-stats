import { periodRecords } from "@/lib/api/period-records";
import { compareDays, type DayRecords } from "@/lib/comparison";
import { formatFullDate, formatNumber, formatRecordInterval } from "@/lib/format";
import type { Period } from "@/lib/period";

export async function DayComparison({ period, pathname }: { period: Period; pathname: string }) {
  if (!period.first || !period.compare) return null;
  const loadDay = async (day: string): Promise<DayRecords> => {
    const selection = { start: day, end: day, singleDay: true };
    const [cycles, sleeps, recoveries, workouts] = await Promise.all([
      ["/", "/strain"].includes(pathname) ? periodRecords("cycles", selection) : [],
      ["/", "/sleep"].includes(pathname) ? periodRecords("sleeps", selection) : [],
      ["/", "/recovery"].includes(pathname) ? periodRecords("recoveries", selection) : [],
      ["/", "/workouts", "/strain"].includes(pathname) ? periodRecords("workouts", selection) : [],
    ]);
    return { cycles, sleeps, recoveries, workouts };
  };
  const [a, b] = await Promise.all([loadDay(period.first), loadDay(period.compare)]);
  const comparison = compareDays(a, b, period.first, period.compare);
  const visible = pathname === "/" ? [0, 1, 2, 3, 4, 5] : pathname === "/recovery" ? [1, 2] : pathname === "/sleep" ? [3] : pathname === "/strain" ? [0, 4, 5] : [4];
  return <div className="comparison-panel space-y-3">
    <h3 className="font-semibold">Comparação entre dias</h3>
    <p className="text-xs text-text-tertiary">Diferença calculada: segundo dia menos primeiro. Sem dados comparáveis, a diferença fica indisponível.</p>
    {visible.includes(3) && <p className="text-xs text-text-secondary">Tempo dormido inclui sonos principais e cochilos encerrados em cada dia, com a duração integral de cada registro. Cobertura: {comparison.sleepCoverage.map(s => `${s.measuredCount}/${s.recordCount}`).join(" e ")} registros com duração.{comparison.sleepCoverage.some(s => s.measuredCount < s.recordCount) ? " Total parcial; diferença de sono não calculada." : ""}</p>}
    {comparison.sameCycle && <p className="text-sm text-amber-300">Mesmo ciclo; sem valores diários separados.</p>}
    {(a.cycles.length > 1 || b.cycles.length > 1) && <p className="text-xs text-text-secondary">Há mais de um ciclo em um dos dias; seus valores não são somados para criar uma pontuação diária.</p>}
    <div className="overflow-x-auto"><table className="w-full text-left text-xs"><thead><tr><th className="p-2">Métrica</th><th>{formatFullDate(`${period.first}T12:00:00Z`)}</th><th>{formatFullDate(`${period.compare}T12:00:00Z`)}</th><th>Diferença</th></tr></thead><tbody>
      {comparison.rows.filter((_, i) => visible.includes(i)).map(row => <tr key={row.label} className="border-t border-border-subtle"><th className="p-2 font-normal">{row.label}</th><td>{row.a == null ? "Não disponível" : formatNumber(row.a, row.unit === "treinos" ? 0 : 1)}</td><td>{row.b == null ? "Não disponível" : formatNumber(row.b, row.unit === "treinos" ? 0 : 1)}</td><td>{row.comparable && row.a != null && row.b != null ? `${row.b - row.a > 0 ? "+" : ""}${formatNumber(row.b - row.a, row.unit === "treinos" ? 0 : 1)} ${row.unit === "treinos" && Math.abs(row.b - row.a) === 1 ? "treino" : row.unit}` : "Não disponível"}</td></tr>)}
    </tbody></table></div>
    {b.cycles.map(c => <p key={c.id} className="text-xs text-text-tertiary">Ciclo do segundo dia: {formatRecordInterval(c.start_time, c.end_time)}</p>)}
    {visible.includes(4) && <p className="text-xs text-text-muted">Contagem zero indica nenhum treino nos registros disponíveis; não comprova ausência de atividade física.</p>}
  </div>;
}
