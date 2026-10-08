import { RecordChart } from "./record-chart";
import type { ChartRecord, ChartSelection } from "@/lib/chart-timeline";

interface TrendChartProps {
  data: ChartRecord[];
  label: string;
  color: string;
  selection: ChartSelection;
  unit?: string;
  domain?: [number, number];
  height?: number;
  intervals?: boolean;
}

export function TrendChart({ data, label, color, selection, unit, domain, height, intervals }: TrendChartProps) {
  return <RecordChart selection={selection} height={height} series={[{ label, color, unit, domain, intervals, records: data }]} />;
}
