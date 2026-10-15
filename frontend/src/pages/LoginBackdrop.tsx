import { Eye, Heart, MessageCircle, Users } from 'lucide-react';
import { Logo } from '@/components/brand/Logo';
import PageHeader from '@/components/PageHeader';
import MetricBox from '@/components/MetricBox';
import SurfaceBox from '@/components/SurfaceBox';
import ListRow, { RankNumber } from '@/components/ListRow';
import MetricAreaChart from '@/components/MetricAreaChart';
import { PlatformIcon } from '@/components/platform';
import { NAV_GROUPS } from '@/layout/navigation';
import { cn } from '@/lib/utils';

// sample figures for a picture of the Overview; nothing here is read from an account
const METRICS = [
  { label: 'Audience', value: '151,265', trend: 3.1, icon: <Users />, highlight: true },
  { label: 'Views', value: '1.9M', trend: 12.6, icon: <Eye /> },
  { label: 'Likes', value: '84.7K', trend: 5.4, icon: <Heart /> },
  { label: 'Comments', value: '6,213', trend: 2.2, icon: <MessageCircle /> },
];
const ACCOUNTS = [
  { platform: 'youtube', name: 'Northwind Kitchen', value: '84,213' },
  { platform: 'instagram', name: '@northwind.kitchen', value: '31,702' },
  { platform: 'youtube', name: 'Northwind Shorts', value: '22,940' },
  { platform: 'reddit', name: 'u/northwind_cooks', value: '12,410' },
];
const WEEKS = [128, 130, 131, 134, 137, 138, 141, 144, 145, 148, 150, 151].map((value, i) => ({
  name: `W${i + 1}`,
  value: value * 1000,
}));

// the dashboard behind the sign-in card, built from the app's own components with sample figures, the way
// Activepieces shows its app behind its sign-in; hidden from assistive technology and the pointer, loaded after the card
export default function LoginBackdrop() {
  return (
    <div
      aria-hidden="true"
      className="pointer-events-none fixed inset-0 flex animate-in overflow-hidden duration-500 select-none fade-in"
    >
      <aside className="hidden w-(--sidebar-w) shrink-0 flex-col gap-5 border-r border-sidebar-border bg-sidebar px-3 py-4 md:flex">
        <Logo className="ml-2 h-6" />
        {NAV_GROUPS.map(group => (
          <div key={group.label} className="flex flex-col gap-0.5">
            <p className="px-2 pb-1 text-caption font-medium text-ink-faint">{group.label}</p>
            {group.items.map((item, i) => {
              const Icon = item.icon;
              const active = group === NAV_GROUPS[0] && i === 0;
              return (
                <span
                  key={item.path}
                  className={cn(
                    'flex h-(--nav-row-h) items-center gap-2.5 rounded-row px-2 text-sm',
                    active ? 'bg-sidebar-accent font-medium text-ink' : 'text-ink-muted',
                  )}
                >
                  <Icon className="size-[18px]" strokeWidth={1.75} />
                  {item.label}
                </span>
              );
            })}
          </div>
        ))}
      </aside>

      <div className="flex min-w-0 flex-1 flex-col bg-surface">
        <div className="flex h-(--topbar-h) shrink-0 items-center border-b border-line px-6 text-sm font-medium text-ink">
          Overview
        </div>
        <main className="flex flex-col gap-6 p-8">
          <PageHeader
            size="display"
            title="Good morning, Asha"
            description="4 accounts across YouTube, Instagram and Reddit"
          />
          <div className="grid grid-cols-2 gap-4 xl:grid-cols-4">
            {METRICS.map(metric => (
              <MetricBox
                key={metric.label}
                icon={metric.icon}
                label={metric.label}
                value={metric.value}
                trend={metric.trend}
                trendLabel="this month"
                highlight={metric.highlight}
              />
            ))}
          </div>
          <div className="grid gap-4 lg:grid-cols-[1fr_22rem]">
            <SurfaceBox title="Audience" subheader="Last 12 weeks">
              <MetricAreaChart data={WEEKS} dataKey="value" label="Audience" height={260} />
            </SurfaceBox>
            <SurfaceBox title="Top accounts" subheader="By audience" className="hidden lg:flex">
              {ACCOUNTS.map((account, i) => (
                <ListRow
                  key={account.name}
                  leading={<RankNumber rank={i + 1} />}
                  title={
                    <span className="flex items-center gap-2">
                      <PlatformIcon platform={account.platform} />
                      {account.name}
                    </span>
                  }
                  trailing={<span className="font-mono text-small text-ink-muted">{account.value}</span>}
                />
              ))}
            </SurfaceBox>
          </div>
        </main>
      </div>
    </div>
  );
}
