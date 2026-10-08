import { formatRecordInterval } from "@/lib/format";
import { dateKey } from "@/lib/period";
export function RecordContext({ start, end, label = "Últimos dados disponíveis", state, day }: { start?: string | null; end?: string | null; label?: string; state?: string | null; day?: string }) {
  return <div className="record-context"><p>{start ? `${label}: ${(start === end ? formatRecordInterval(start, end).split(" → ")[0] : formatRecordInterval(start, end))}` : "Nenhum registro disponível na seleção."} {state === "PENDING_SCORE" ? "· Em processamento" : state === "UNSCORABLE" ? "· Pontuação não disponível" : ""}</p>{start && start === end && day && dateKey(start) !== day && <p className="mt-1 text-amber-300">Referência de outro dia, exibida como contexto do ciclo. Não é uma medição deste dia.</p>}</div>;
}
