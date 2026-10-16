import { AlertTriangle, Clock, Gauge, MessageCircle, MessageSquareReply, MessagesSquare, Send } from 'lucide-react';
import MetricBox from '@/components/MetricBox';
import { fmtNumFull } from '../../utils/formatters';
import type { AutomationSummary } from './automationData.ts';

interface AutomationMetricsProps {
  summary: AutomationSummary | null;
  loading: boolean;
}

// counts for the chosen period, account and rule; accepted means Instagram took the reply, not that it was read
export default function AutomationMetrics({ summary, loading }: AutomationMetricsProps) {
  const value = (n: number | undefined) => (n === undefined ? '-' : fmtNumFull(n));
  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4 2xl:grid-cols-7">
      <MetricBox small loading={loading} icon={<MessageCircle />} label="Comments received" value={value(summary?.received)} subtitle="On accounts with an active rule" />
      <MetricBox small loading={loading} icon={<MessageSquareReply />} label="Keyword matches" value={value(summary?.matched)} subtitle="Comments a rule answered" />
      <MetricBox small highlight loading={loading} icon={<Send />} label="Accepted by Instagram" value={value(summary?.accepted)} subtitle="Private replies; Instagram does not report reads" />
      <MetricBox small loading={loading} icon={<MessagesSquare />} label="Public replies posted" value={value(summary?.publicPosted)} subtitle="Under the comments" />
      <MetricBox small loading={loading} icon={<Clock />} label="Waiting" value={value(summary?.waiting)} subtitle="Queued, sending or trying again" />
      <MetricBox small loading={loading} icon={<AlertTriangle />} label="Needs attention" value={value(summary?.attention)} subtitle="Private or public, failed or needs review" />
      <MetricBox small loading={loading} icon={<Gauge />} label="Rate limited" value={value(summary?.rateLimited)} subtitle="Requests Instagram slowed down" />
    </div>
  );
}
