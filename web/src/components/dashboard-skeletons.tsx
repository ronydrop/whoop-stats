import type { CSSProperties, ReactNode } from "react";
import { Skeleton } from "./ui/skeleton";

function Placeholder({ className = "" }: { className?: string }) {
  return <Skeleton className={`bg-surface-2 ${className}`} />;
}

function Page({ title, description, period = false, children }: { title: string; description?: string; period?: boolean; children: ReactNode }) {
  return <div className="dashboard-page" aria-busy="true">
    <p role="status" className="sr-only">Carregando {title.toLowerCase()}…</p>
    <header><span className="page-kicker">SEU PAINEL WHOOP</span><h1>{title}</h1><p>{description ?? <Placeholder className="h-5 w-64 max-w-full" />}</p></header>
    {period && <PeriodSkeleton />}
    {children}
  </div>;
}

function PeriodSkeleton() {
  return <section className="space-y-3" aria-label="Filtro de período"><div className="period-toolbar">
    {[false, true].map(compare => <div key={String(compare)} className="period-section">
      <div className="flex items-center gap-2 text-[13px] font-semibold">{compare ? "Comparar" : "Período:"}{!compare && <Placeholder className="h-4 w-44 max-w-full" />}</div>
      {!compare && <div className="period-presets" aria-hidden="true">{[48, 60, 54, 62, 78].map(width => <Skeleton key={width} className="h-7 bg-surface-2" style={{ width }} />)}</div>}
      <div className="period-form">{(compare ? ["Primeiro dia", "Comparar com"] : ["Data inicial", "Data final"]).map(label => <div key={label} className="min-w-0 text-[11px] text-text-secondary">{label}<Placeholder className="mt-1.5 h-[38px] w-full rounded-[9px]" /></div>)}<Placeholder className="h-[38px] w-28 max-md:col-span-2 max-md:w-full" /></div>
    </div>)}
  </div><p className="period-meta">Horário de Brasília</p></section>;
}

function Heading({ title, description }: { title: string; description?: string }) {
  return <div className="section-heading"><div><h2>{title}</h2>{description && <p>{description}</p>}</div></div>;
}

function MetricSkeleton({ title, featured = false, visual, details = false, icon = false }: { title: string; featured?: boolean; visual?: "history" | "scale" | "composition"; details?: boolean; icon?: boolean }) {
  const style: CSSProperties & { "--metric-color": string } = { "--metric-color": "var(--color-surface-3)" };
  return <div className={`metric-card ${featured ? "metric-featured" : ""}`} style={style}>
    <div className="flex items-center justify-between gap-3"><h3 className="metric-title">{title}</h3>{icon && <Placeholder className="size-[34px] shrink-0 rounded-[11px]" />}</div>
    <div className="metric-value"><Placeholder className={`h-[1.1em] max-w-full ${featured ? "w-28" : "w-24"}`} /></div>
    <div className="mt-2"><Placeholder className="h-4 w-4/5" /></div>
    {featured && <div className="record-context"><Placeholder className="h-3 w-full" /><Placeholder className="mt-2 h-3 w-3/4" /></div>}
    {visual && <div className="metric-visual">{visual === "scale" ? <div className="metric-scale"><Placeholder className="size-[86px] shrink-0 rounded-full max-md:size-[60px]" /><div className="min-w-0 flex-1 space-y-2"><Placeholder className="h-3 w-full" /><Placeholder className="h-3 w-3/4" /></div></div> : visual === "composition" ? <div className="metric-composition"><Placeholder className="h-4 w-full" /><div className="metric-composition-legend">{[0, 1].map(item => <Placeholder key={item} className="h-4 w-full" />)}</div></div> : <Placeholder className="h-32 w-full" />}</div>}
    {details && <span className="mt-4 text-[11px] text-text-muted">Ver detalhes</span>}
  </div>;
}

function Metrics({ titles, className, featured = false, visual = false, details = false, icon = false, icons = [], scales = [], compositions = [] }: { titles: string[]; className: string; featured?: boolean; visual?: boolean; details?: boolean; icon?: boolean; icons?: string[]; scales?: string[]; compositions?: string[] }) {
  return <div className={className}>{titles.map(title => <MetricSkeleton key={title} title={title} featured={featured} visual={scales.includes(title) ? "scale" : compositions.includes(title) ? "composition" : visual ? "history" : undefined} details={details} icon={icon || icons.includes(title)} />)}</div>;
}

function Chart({ title, description, height }: { title: string; description?: string; height: number }) {
  return <div className="glass-card p-5"><h3 className="mb-1 text-sm font-semibold text-text-primary">{title}</h3>{description && <p className="mb-3 text-xs text-text-tertiary">{description}</p>}<Skeleton className="w-full bg-surface-1" style={{ height }} /></div>;
}

function History({ title, columns = 3 }: { title: string; columns?: number }) {
  return <div className="glass-card overflow-x-auto p-5"><h3 className="mb-4 text-sm font-semibold">{title}</h3><div className="space-y-1">{[0, 1, 2, 3].map(row => <div key={row} className="grid items-center gap-3 border-b border-border-subtle py-3 last:border-0" style={{ gridTemplateColumns: `minmax(0, 2fr) repeat(${columns - 1}, minmax(0, 1fr))` }}>{Array.from({ length: columns }, (_, column) => <Placeholder key={column} className="h-4 w-full" />)}</div>)}</div></div>;
}

export function OverviewSkeleton() {
  return <Page title="Visão geral" description="Acompanhe sua recuperação, sono e atividades." period>
    <section><Heading title="Seus últimos registros" description="Último ciclo, sono principal e recuperação dentro do período selecionado." />
      <Metrics titles={["Recuperação", "Esforço do ciclo", "Horas de sono"]} className="grid grid-cols-1 gap-4 md:grid-cols-3" featured icon />
      <Metrics titles={["Acordei às", "Tempo acordado"]} className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2" icon />
      <Metrics titles={["VFC (HRV)", "Frequência cardíaca de repouso", "Consistência do sono", "Déficit de sono", "Passos do ciclo", "Calorias do ciclo"]} className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3" icons={["Passos do ciclo", "Calorias do ciclo"]} />
      <Placeholder className="mt-3 h-4 w-full" />
    </section>
    <section><Heading title="Atividade na semana" description="7 dias até o fim da seleção" /><Metrics titles={["Tempo em treinos de força", "Zonas cardíacas 1–3", "Zonas cardíacas 4–5"]} className="grid grid-cols-1 gap-3 md:grid-cols-3" /><Placeholder className="mt-3 h-4 w-48" /></section>
    <section><Heading title="Evolução no período" description="Esforço e recuperação lado a lado, respeitando a referência de cada registro." /><div className="grid gap-4 lg:grid-cols-2"><Chart title="Esforço por ciclo" height={180} /><Chart title="Recuperação após o sono" height={180} /></div></section>
    <History title="Atividades recentes" />
  </Page>;
}

export function RecoverySkeleton() {
  return <Page title="Recuperação" description="Medições do período, pela data de término do sono associado" period>
    <Placeholder className="h-4 w-80 max-w-full" />
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-3"><div className="glass-card flex flex-col items-center justify-center gap-3 p-6"><Placeholder className="size-[200px] rounded-full" /><Placeholder className="h-5 w-32" /><Placeholder className="h-4 w-48 max-w-full" /></div><div className="lg:col-span-2"><Metrics titles={["VFC", "FC em repouso", "SpO2", "Temperatura da pele"]} className="grid grid-cols-2 gap-3" visual details icon /></div></div>
    <h2 className="text-sm font-semibold">Resumo do período selecionado</h2><Placeholder className="h-5 w-96 max-w-full" />
    <Chart title="Distribuição da recuperação" height={48} />
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-2"><Chart title="Tendência da VFC" height={200} /><Chart title="Frequência cardíaca em repouso" height={200} /></div>
    <Chart title="Pontuação de recuperação" height={220} /><History title="Histórico de recuperação" />
  </Page>;
}

export function SleepSkeleton() {
  return <Page title="Sono" description="Sonos encerrados no período, com noites e cochilos separados" period>
    <Placeholder className="h-4 w-80 max-w-full" />
    <Metrics titles={["Desempenho do sono", "Tempo dormido no período", "Eficiência", "Frequência respiratória"]} className="grid grid-cols-2 gap-3 sm:grid-cols-4" visual details icon scales={["Desempenho do sono", "Eficiência"]} compositions={["Tempo dormido no período"]} />
    <div className="mt-3 flex flex-wrap gap-6 rounded-xl border border-border-subtle p-3">{[0, 1, 2].map(item => <Placeholder key={item} className="h-5 w-44 max-w-full" />)}</div>
    <Chart title="Composição do último sono principal" height={80} />
    <section className="space-y-4"><Heading title="Fases do sono por horário" description="Quando ocorreram os períodos acordado, REM, leve e profundo no sono principal mostrado acima." /><Chart title="Fases do sono" height={170} /><Heading title="Estresse durante este sono" description="Distribuição informada pela WHOOP para o mesmo registro." /><Metrics titles={["Estresse baixo", "Estresse moderado", "Estresse alto"]} className="grid gap-4 sm:grid-cols-3" /><MetricSkeleton title="Sono restaurador" /></section>
    <section className="space-y-4"><Heading title="Planejar o próximo sono" description="Necessidade atual calculada pela WHOOP e horário para atingir sua meta." /><div className="glass-card flex flex-wrap gap-4 p-4"><Placeholder className="h-14 w-40" /><Placeholder className="h-14 w-48" /></div><Metrics titles={["Horário para deitar", "Tempo recomendado na cama", "Necessidade atual de sono"]} className="grid gap-4 sm:grid-cols-3" /><Placeholder className="h-14 w-full" /></section>
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-2"><Chart title="Desempenho do sono" description="Sono principal e cochilos · pontuação por registro, na data de término" height={200} /><Chart title="Duração do sono" description="Sono principal e cochilos · horas efetivamente dormidas por registro" height={200} /></div>
    <History title="Histórico de sono" />
  </Page>;
}

export function StrainSkeleton() {
  return <Page title="Esforço" description="Acompanhe a carga cardiovascular por ciclo" period>
    <Placeholder className="h-4 w-80 max-w-full" />
    <div><Metrics titles={["Esforço do último ciclo", "FC média", "FC máxima"]} className="grid grid-cols-1 gap-3 sm:grid-cols-3" visual details icon scales={["Esforço do último ciclo"]} /><h2 className="mt-6 text-sm font-semibold">Resumo dos ciclos incluídos</h2><Placeholder className="mt-1 h-5 w-96 max-w-full" /><Metrics titles={["Esforço médio por ciclo", "Pico de esforço", "Calorias dos ciclos incluídos", "Ciclos de esforço intenso"]} className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-4" /></div>
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-2"><Chart title="Esforço por ciclo" description="Pontuação de esforço por ciclo" height={220} /><Chart title="Calorias por ciclo" description="Estimativa de energia por ciclo" height={220} /></div><History title="Histórico de ciclos" />
  </Page>;
}

export function StressSkeleton() {
  return <Page title="Estresse" description="Observe como seu estresse fisiológico varia ao longo do dia.">
    <div className="glass-card flex flex-wrap items-end justify-between gap-4 p-4"><div className="flex items-end gap-3"><div className="text-xs text-text-secondary">Dia analisado<Placeholder className="mt-1 h-[38px] w-36" /></div><Placeholder className="h-[38px] w-20" /></div><Placeholder className="h-[38px] w-40" /></div>
    <Metrics titles={["Última leitura do dia", "Pico observado", "Mínimo observado"]} className="grid grid-cols-1 gap-4 sm:grid-cols-3" icons={["Última leitura do dia"]} />
    <Chart title="Estresse ao longo do dia" description="Horário de Brasília" height={280} />
    <section className="space-y-6"><Heading title="Tendências de estresse" description="Totais por registro e data de referência da WHOOP." /><div className="flex flex-wrap gap-2">{[0, 1, 2].map(item => <Placeholder key={item} className="h-9 w-24 rounded-xl" />)}</div><div className="grid gap-6 xl:grid-cols-2">{["Estresse ao longo dos dias", "Estresse durante o sono"].map(title => <section key={title} className="space-y-4"><Heading title={title} /><MetricSkeleton title="Média de tempo em estresse alto" /><Chart title="Tempo por faixa de estresse" height={220} /></section>)}</div></section>
  </Page>;
}

export function WorkoutsSkeleton() {
  return <Page title="Treinos" period>
    <div className="space-y-4"><Metrics titles={["Esforço médio por treino", "Tempo em atividades", "Calorias dos treinos"]} className="grid grid-cols-1 gap-3 sm:grid-cols-3" visual /><Placeholder className="h-4 w-96 max-w-full" /><div className="glass-card p-3 text-sm font-medium">Filtrar e ordenar treinos</div><div className="grid grid-cols-1 gap-3 sm:grid-cols-2"><Placeholder className="col-span-full mt-3 h-5 w-40" />{[0, 1, 2, 3].map(item => <div key={item} className="glass-card space-y-4 p-5"><Placeholder className="h-5 w-40 max-w-full" /><Placeholder className="h-4 w-full" /><Placeholder className="h-20 w-full" /></div>)}</div></div>
    <section className="space-y-4"><Heading title="Strength Trainer" description="Exercícios, volume e participação muscular dos treinos de força registrados." /><div className="grid gap-4 sm:grid-cols-2">{[0, 1].map(item => <div key={item} className="glass-card space-y-3 p-5"><Placeholder className="h-5 w-40 max-w-full" /><Placeholder className="h-4 w-full" /><Placeholder className="h-4 w-48 max-w-full" /></div>)}</div></section>
  </Page>;
}

export function StrengthSkeleton() {
  return <Page title="Detalhes de força"><Placeholder className="h-4 w-32" /><Placeholder className="h-4 w-80 max-w-full" /><Metrics titles={["Volume total", "Participação muscular no esforço"]} className="grid gap-4 sm:grid-cols-2" /><section className="space-y-4"><Heading title="Exercícios do treino" description="Totais por exercício disponibilizados pela WHOOP." /><History title="Exercícios" columns={5} /></section></Page>;
}
