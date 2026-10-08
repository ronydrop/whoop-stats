import { LiveHeartPanel } from "@/components/live-heart-panel";
import { liveHeartView } from "@/lib/live-server";

export const dynamic = "force-dynamic";
export default async function LivePage() {
  return <div className="dashboard-page"><header><span className="page-kicker">SEU PAINEL WHOOP</span><h1 className="text-2xl font-semibold tracking-tight">Ao vivo</h1><p className="mt-1 text-sm text-text-secondary">Acompanhe a última frequência cardíaca disponibilizada pela WHOOP.</p></header><LiveHeartPanel initial={await liveHeartView()} /></div>;
}
