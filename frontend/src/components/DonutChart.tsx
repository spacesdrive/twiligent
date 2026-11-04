import { Cell, Pie, PieChart } from 'recharts';
import { Chart, ChartLegend, ChartTooltip } from '@/components/ui/chart';
import ExactTooltip from './ExactTooltip';

export interface DonutSlice {
  name: string;
  value: number;
  // a design token colour, such as SERIES.primary
  color: string;
}

export interface DonutChartProps {
  data: readonly DonutSlice[];
  height: number;
  // the ring sits higher in a short card so the legend fits under it
  cy?: string;
  innerRadius?: number;
  outerRadius?: number;
  format?: (value: number) => string;
}

function legendText(value: string) {
  return <span className="text-ink-muted">{value}</span>;
}

// parts of a whole as a ring inside Intent UI's chart frame and tooltip; Intent's set has no pie of its own
export default function DonutChart({ data, height, cy = '50%', innerRadius = 55, outerRadius = 95, format }: DonutChartProps) {
  const rows = data.map(slice => ({ ...slice, fill: slice.color }));
  return (
    <Chart config={{}} data={rows} dataKey="name" containerHeight={height}>
      <PieChart>
        <Pie data={rows} dataKey="value" nameKey="name" cx="50%" cy={cy} outerRadius={outerRadius} innerRadius={innerRadius} paddingAngle={2} strokeWidth={0}>
          {rows.map(slice => <Cell key={slice.name} fill={slice.color} />)}
        </Pie>
        <ChartTooltip content={<ExactTooltip hideLabel format={format} />} />
        <ChartLegend iconType="circle" iconSize={8} formatter={legendText} />
      </PieChart>
    </Chart>
  );
}
