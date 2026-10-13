import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip as ReTooltip, ResponsiveContainer,
} from 'recharts';
import { axisProps, gridProps, tooltipStyle } from '@/lib/chart';
import { fmtNum, fmtNumFull } from '../../../utils/formatters';
import { audienceDotColor } from './overviewCharts.js';

function formatAudienceTooltip(value, name, props) {
  return [fmtNumFull(value), props.payload.type === 'category' ? 'Karma' : 'Audience'];
}

function renderAudienceDot({ cx, cy, payload, index }) {
  return (
    <circle
      key={`dot-${index}`}
      cx={cx}
      cy={cy}
      r={4.5}
      fill={audienceDotColor(payload.type)}
      stroke="var(--surface-raised)"
      strokeWidth={2}
    />
  );
}

export default function AudienceChart({ data, legend }) {
  return (
    <>
      <ResponsiveContainer width="100%" height={260} debounce={200}>
        <AreaChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
          <defs>
            <linearGradient id="audienceAreaGrad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%"  stopColor="var(--chart-1)" stopOpacity={0.22} />
              <stop offset="95%" stopColor="var(--chart-1)" stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid {...gridProps} vertical={false} />
          <XAxis dataKey="name" {...axisProps} />
          <YAxis {...axisProps} tickFormatter={fmtNum} width={48} />
          <ReTooltip contentStyle={tooltipStyle} cursor={{ stroke: 'var(--line-strong)' }} formatter={formatAudienceTooltip} />
          <Area
            type="monotone"
            dataKey="value"
            stroke="var(--chart-1)"
            strokeWidth={2}
            fill="url(#audienceAreaGrad)"
            dot={renderAudienceDot}
            activeDot={{ r: 6 }}
          />
        </AreaChart>
      </ResponsiveContainer>
      <ul className="mt-3 flex flex-wrap gap-x-4 gap-y-1.5">
        {legend.map(({ color, label }) => (
          <li key={label} className="flex items-center gap-1.5 text-caption text-ink-muted">
            <span className="size-2.5 shrink-0 rounded-full" style={{ background: color }} />
            {label}
          </li>
        ))}
      </ul>
    </>
  );
}
