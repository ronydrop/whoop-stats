"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Activity, RefreshCw } from "lucide-react";
import { CartesianGrid, Line, LineChart, ReferenceArea, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { connectStress, disconnectStress } from "@/app/stress/actions";
import { MetricCard } from "@/components/metric-card";
import { localStressMinute, stressChartPoints, stressClock, type StressAuthResult, type StressView } from "@/lib/stress";

const inputClass = "w-full rounded-xl border border-border-default bg-surface-1 px-3 py-2 text-sm text-text-primary";
const buttonClass = "rounded-xl bg-accent px-4 py-2 text-sm font-medium text-white disabled:opacity-50";
const number = (value: number | null | undefined) => value == null ? "Não disponível" : value.toLocaleString("pt-BR", { minimumFractionDigits: 1, maximumFractionDigits: 1 });
const stressBands = [
  { label: "Baixo", range: "0 a 1", min: 0, max: 1, color: "#69D39B" },
  { label: "Moderado", range: "> 1 até 2", min: 1, max: 2, color: "#FFB347" },
  { label: "Alto", range: "> 2 até 3", min: 2, max: 3, color: "#FF7878" },
];

export function StressPanel({ date, today, view }: { date: string; today: string; view: StressView }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [auth, setAuth] = useState<StressAuthResult | null>(null);
  const [actionMessage, setActionMessage] = useState("");
  const [showLogin, setShowLogin] = useState(false);
  const data = view.data;
  const levels = data?.points.filter(point => point.level !== null) ?? [];
  const points = stressChartPoints(data?.points ?? []);
  const latest = levels.at(-1);
  const graphEnd = date === today && data ? Math.max(1, localStressMinute(data.fetchedAt)) : 1439;

  function submit(form: FormData) {
    setActionMessage("");
    startTransition(async () => {
      try {
        const result = await connectStress(form);
        setAuth(previous => result.ok || result.challengeId ? result : { ...previous, ...result });
        if (result.ok) { setShowLogin(false); setAuth(null); router.refresh(); }
      } catch { setActionMessage("Não foi possível conectar. Abra o painel em localhost e tente novamente."); }
    });
  }

  function disconnect() {
    startTransition(async () => {
      try { await disconnectStress(); setAuth(null); setShowLogin(false); router.refresh(); }
      catch { setActionMessage("Não foi possível desconectar. Tente novamente."); }
    });
  }

  return <>
    <div className="glass-card flex flex-wrap items-end justify-between gap-4 p-4">
      <form action="/stress" className="flex flex-wrap items-end gap-3">
        <label className="space-y-1 text-xs text-text-secondary">Dia analisado<input className={inputClass} type="date" name="day" defaultValue={date} max={today} required /></label>
        <button className={buttonClass}>Ver dia</button>
      </form>
      <button className="flex items-center gap-2 rounded-xl border border-border-default px-3 py-2 text-sm disabled:opacity-50" disabled={pending || !view.connected} onClick={() => startTransition(() => router.refresh())}>
        <RefreshCw className={`size-4 ${pending ? "animate-spin motion-reduce:animate-none" : ""}`} />{pending ? "Atualizando…" : "Atualizar estresse"}
      </button>
    </div>

    {(view.message || actionMessage) && <div role="status" className="rounded-xl border border-border-default bg-surface-0 p-4 text-sm text-text-secondary">{actionMessage || view.message}{view.stale && " Exibindo a última consulta salva; ela pode estar desatualizada."}</div>}

    {(!view.connected || showLogin) && <section className="glass-card p-5 sm:p-6">
      <div className="mb-5 max-w-xl"><h2 className="text-lg font-semibold">Conectar WHOOP</h2><p className="mt-2 text-sm leading-relaxed text-text-secondary">Entre na mesma conta WHOOP do painel. Sua senha é enviada à WHOOP e não fica salva. A sessão é armazenada de forma criptografada neste computador.</p><p className="mt-2 text-xs leading-relaxed text-text-muted">Esta conexão complementar atende Estresse, Diário, Condicionamento, Sono e Ao vivo. Consulta somente dados e pode deixar de funcionar se a WHOOP mudar ou restringir o acesso. <a className="underline underline-offset-4" href="https://github.com/thebriangao/totem#faq" target="_blank" rel="noreferrer">Sobre a integração</a></p></div>
      <form action={submit} className="grid max-w-lg gap-4">
        {auth?.challengeId ? <>
          <input type="hidden" name="challengeId" value={auth.challengeId} />
          <label className="space-y-2 text-sm">{auth.challengeLabel}<input className={inputClass} name="code" autoComplete="one-time-code" inputMode="numeric" pattern="[0-9]{6}" maxLength={6} required /></label>
        </> : <>
          <label className="space-y-2 text-sm">E-mail WHOOP<input className={inputClass} type="email" name="email" autoComplete="username" maxLength={254} required /></label>
          <label className="space-y-2 text-sm">Senha WHOOP<input className={inputClass} type="password" name="password" autoComplete="current-password" maxLength={1024} required /></label>
        </>}
        {auth?.message && <p role="status" className="text-sm text-text-secondary">{auth.message}</p>}
        <div className="flex flex-wrap items-center gap-4"><button disabled={pending} className={buttonClass}>{pending ? "Conectando…" : auth?.challengeId ? "Verificar código" : "Conectar WHOOP"}</button>{auth?.challengeId && <button type="button" className="text-sm underline" disabled={pending} onClick={() => setAuth(null)}>Voltar ao login</button>}</div>
      </form>
    </section>}

    {data && <>
      {data.calibrating && <p role="status" className="text-sm text-text-secondary">O Stress Monitor está em calibração na WHOOP. As métricas ainda podem estar incompletas.</p>}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <MetricCard title="Última leitura do dia" value={number(data.score)} subtitle={latest ? `${stressClock(latest.minute)} · Escala de 0 a 3` : "Escala de 0 a 3"} icon={<Activity className="size-4" />} accentColor="yellow" />
        <MetricCard title="Pico observado" value={number(data.peak)} subtitle="Maior leitura disponível no dia" accentColor="red" />
        <MetricCard title="Mínimo observado" value={number(data.min)} subtitle="Menor leitura disponível no dia" accentColor="green" />
      </div>
      <section className="glass-card p-4 sm:p-6">
        <h2 className="text-base font-semibold">Estresse ao longo do dia</h2>
        <p className="mb-4 mt-1 text-xs leading-relaxed text-text-secondary">Horário de Brasília · {levels.length} leituras disponíveis{latest ? ` · Última leitura no gráfico: ${stressClock(latest.minute)}` : ""}. Lacunas maiores que 10 minutos ficam sem conexão no gráfico.</p>
        <ul aria-label="Faixas de estresse" className="mb-5 flex flex-wrap gap-x-5 gap-y-2 text-xs text-text-secondary">
          {stressBands.map(band => <li key={band.label} className="flex items-center gap-2"><span aria-hidden="true" className="size-2.5 rounded-sm" style={{ backgroundColor: band.color }} /><span><strong className="font-medium text-text-primary">{band.label}</strong> · {band.range}</span></li>)}
        </ul>
        {levels.length ? <div className="h-[280px] w-full" role="img" aria-label={`Histórico de estresse em ${date}, ${levels.length} leituras, mínimo ${number(data.min)} e pico ${number(data.peak)}. Faixas: baixo de 0 a 1, moderado acima de 1 até 2, alto acima de 2 até 3.`}>
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={points} margin={{ top: 10, right: 12, left: -22, bottom: 0 }}>
              {stressBands.map(band => <ReferenceArea key={band.label} x1={0} x2={graphEnd} y1={band.min} y2={band.max} fill={band.color} fillOpacity={0.1} stroke="none" />)}
              <CartesianGrid stroke="rgba(255,255,255,0.06)" vertical={false} />
              <XAxis dataKey="minute" type="number" domain={[0, graphEnd]} ticks={[0, Math.round(graphEnd / 4), Math.round(graphEnd / 2), Math.round(3 * graphEnd / 4), graphEnd]} tickFormatter={stressClock} tick={{ fill: "#989A94", fontSize: 11 }} axisLine={false} tickLine={false} minTickGap={20} />
              <YAxis domain={[0, 3]} ticks={[0, 1, 2, 3]} tick={{ fill: "#989A94", fontSize: 11 }} axisLine={false} tickLine={false} />
              <ReferenceLine y={1} stroke={stressBands[0].color} strokeOpacity={0.45} strokeDasharray="4 4" />
              <ReferenceLine y={2} stroke={stressBands[2].color} strokeOpacity={0.6} strokeDasharray="4 4" />
              <Tooltip labelFormatter={value => stressClock(Number(value))} formatter={value => [number(Number(value)), `Estresse ${stressBands.find(band => Number(value) <= band.max)?.label.toLowerCase()}`]} contentStyle={{ background: "#242424", border: "1px solid #484844", borderRadius: 12, color: "#F5F3ED" }} />
              <Line dataKey="level" type="linear" stroke="#F5F3ED" strokeWidth={2} dot={levels.length === 1} connectNulls={false} isAnimationActive={false} />
            </LineChart>
          </ResponsiveContainer>
        </div> : <p className="py-12 text-center text-sm text-text-secondary">A WHOOP ainda não disponibilizou leituras por horário para este dia.</p>}
      </section>
      <p className="text-xs leading-relaxed text-text-muted">Consulta {view.stale ? "salva" : "realizada"} em {new Date(data.fetchedAt).toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo" })}. Mede estresse fisiológico; não identifica se a causa foi emocional, exercício ou relacionamento.</p>
    </>}

    {view.connected && <div className="flex flex-wrap gap-5 text-xs text-text-muted"><span>Conexão complementar WHOOP ativa · Estresse atualizado com intervalo mínimo de um minuto</span><button className="underline underline-offset-4" disabled={pending} onClick={() => setShowLogin(!showLogin)}>{showLogin ? "Fechar login" : "Reconectar"}</button><button className="underline underline-offset-4" disabled={pending} onClick={disconnect}>Desconectar WHOOP</button></div>}
  </>;
}
