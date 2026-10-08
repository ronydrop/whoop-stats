import { readExtra } from "@/lib/whoop-extras-server";
import { parseTrends, type TrendWindow } from "@/lib/whoop-extras";
import { ExtraTrendChart, TrendWindows } from "./extra-trends";

export async function StressTrends({ end, window }: { end: string; window: TrendWindow }) {
  const stress = await readExtra(`/progression-service/v3/trends/STRESS?endDate=${end}`, raw => parseTrends(raw, "STRESS", end), 300_000);
  const sleep = await readExtra(`/progression-service/v3/trends/STRESS_DURING_SLEEP?endDate=${end}`, raw => parseTrends(raw, "STRESS_DURING_SLEEP", end), 300_000);
  return <section className="space-y-6">
    <div className="section-heading"><div><h2>Tendências de estresse</h2><p>Totais por registro e data de referência da WHOOP. Eles podem abranger mais de um dia; não dividimos esses totais em dias de 24 horas.</p></div></div>
    <TrendWindows pathname="/stress" end={end} selected={window} />
    <div className="grid gap-6 xl:grid-cols-2">
      <ExtraTrendChart title="Estresse ao longo dos dias" description="Tempo em estresse baixo, moderado e alto por registro WHOOP. Dados ausentes ficam sem valor." window={window} view={stress} />
      <ExtraTrendChart title="Estresse durante o sono" description="Tempo de estresse em cada faixa durante os registros de sono." window={window} view={sleep} />
    </div>
  </section>;
}
