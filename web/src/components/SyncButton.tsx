"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { RefreshCw } from "lucide-react";
import { syncWhoopData, getSyncStatus } from "@/app/actions";
import { formatRecordInterval } from "@/lib/format";
import type { SyncStatus } from "@/lib/types";

const labels: Record<string, string> = { cycles_recoveries: "Ciclos e recuperação", sleeps: "Sono", workouts: "Treinos", profile: "Perfil" };
export function SyncButton() {
  const [status, setStatus] = useState<SyncStatus | null>(null);
  const [starting, setStarting] = useState(false);
  const [requestError, setRequestError] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const lastVersion = useRef<string | null>(null);
  const router = useRouter();
  const refresh = useCallback(async () => {
    try {
      const next = await getSyncStatus();
      const version = next.resources.map(r => r.last_success_at ?? "").join("|");
      if (lastVersion.current !== null && version !== lastVersion.current) router.refresh();
      lastVersion.current = version;
      setStatus(next); setError(null);
    } catch { setError("Estado da sincronização indisponível. Os dados exibidos podem estar desatualizados."); }
  }, [router]);
  useEffect(() => { const first = setTimeout(() => void refresh(), 0); const timer = setInterval(() => void refresh(), status?.running || starting ? 2000 : 15000); return () => { clearTimeout(first); clearInterval(timer); }; }, [refresh, status?.running, starting]);
  async function start() {
    setStarting(true); setRequestError(null);
    try {
      const result = await syncWhoopData();
      if (result.ok) await refresh(); else setRequestError(result.message);
    } catch { setRequestError("Não foi possível iniciar a sincronização. Tente novamente."); } finally { setStarting(false); }
  }
  const failures = status?.resources.filter(r => r.state === "error" || r.state === "interrupted" || (r.state === "running" && !status?.running)) ?? [];
  const lastSuccess = status?.resources.map(r => r.last_success_at).filter((v): v is string => !!v).sort().at(-1);
  return <div className="space-y-2 text-xs text-text-secondary">
    <div className="flex flex-wrap items-center gap-3">
      <button onClick={start} disabled={starting || status?.running} className="flex gap-2 items-center rounded-full border border-border-subtle px-4 py-2 text-sm disabled:opacity-60"><RefreshCw className={`h-4 w-4 ${status?.running ? "animate-spin motion-reduce:animate-none" : ""}`} />{starting || status?.running ? "Sincronizando…" : "Sincronizar"}</button>
      <p role="status" aria-live="polite">{requestError ?? error ?? (status?.running ? "Atualização em andamento" : failures.length ? "Alguns dados não foram atualizados" : lastSuccess ? "Últimos dados recebidos em: " + formatRecordInterval(lastSuccess, lastSuccess).split(" → ")[0] : "Ainda não há atualização confirmada")}</p>
    </div>
    {status && <details><summary className="cursor-pointer text-text-tertiary">Detalhes da atualização</summary><ul className="mt-2 space-y-1">{status.resources.map(r => <li key={r.resource}>{labels[r.resource] ?? r.resource}: {r.state === "success" ? "Concluído" : r.state === "running" ? "Em andamento" : "Não concluído"}{r.last_success_at ? ` · Atualizado em: ${formatRecordInterval(r.last_success_at, r.last_success_at).split(" → ")[0]}` : " · Ainda não atualizado"}{r.error_message ? ` · ${r.error_message}` : ""}</li>)}</ul></details>}
  </div>;
}
