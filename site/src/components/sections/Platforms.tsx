import { useRef } from 'react';
import { motion, useInView } from 'motion/react';
import { FoldBand } from '@/components/brand';
import { CheckCircle } from '@/components/icons';
import { formatNumber } from '@/lib/format';
import { PlatformMark } from '@/components/mockups/kit';
import { platformLabel } from '@/components/mockups/platforms';
import type { Platform } from '@/components/mockups/platforms';
import { AreaChart } from '@/components/mockups/AreaChart';
import type { ChartTone } from '@/components/mockups/AreaChart';
import { INSTAGRAM_WEEKS, YOUTUBE_WEEKS } from '@/components/mockups/sample';
import { FeatureNotes, SectionHeader } from './blocks';

interface Read {
  platform: Platform;
  role: string;
  items: string[];
  // one headline number from the sample creator, with its last 12 weeks
  metric: string;
  weeks: number[];
  tone: ChartTone;
}

const READS: Read[] = [
  {
    platform: 'youtube',
    role: 'Analytics',
    items: ['Subscribers and views', 'Likes and comments', 'Shorts against long videos', 'Tags and SEO'],
    metric: 'Subscribers',
    weeks: YOUTUBE_WEEKS,
    tone: 'accent',
  },
  {
    platform: 'instagram',
    role: 'Analytics and publishing',
    items: [
      'Followers and engagement',
      'Best day and hour to post',
      'Content types and hashtags',
      'Photos, Reels and Stories',
    ],
    metric: 'Followers',
    weeks: INSTAGRAM_WEEKS,
    tone: 'afterglow',
  },
  {
    platform: 'reddit',
    role: 'Analytics',
    items: ['Karma', 'Posts', 'Comments', 'Any post, tracked by its link'],
    metric: 'Karma',
    weeks: [9_800, 10_050, 10_120, 10_400, 10_760, 10_900, 11_200, 11_380, 11_650, 11_900, 12_180, 12_410],
    tone: 'accent',
  },
];

const EASE = [0.22, 1, 0.36, 1] as const;

function PlatformCard({ read, index }: { read: Read; index: number }) {
  const ref = useRef<HTMLLIElement>(null);
  const seen = useInView(ref, { once: true, amount: 0.4 });
  const latest = read.weeks[read.weeks.length - 1];
  return (
    <motion.li
      ref={ref}
      className="flex flex-col gap-4 rounded-lg border border-line bg-surface-raised p-6 shadow-window"
      initial={{ opacity: 0, y: 16 }}
      animate={seen ? { opacity: 1, y: 0 } : undefined}
      transition={{ duration: 0.6, ease: EASE, delay: index * 0.1 }}
    >
      <div className="flex items-center gap-3">
        <span className="grid size-11 place-items-center rounded-full bg-surface-sunken">
          <PlatformMark platform={read.platform} className="size-6" />
        </span>
        <div>
          <h3 className="text-lg font-semibold text-ink">{platformLabel(read.platform)}</h3>
          <p className="text-sm text-ink-muted">{read.role}</p>
        </div>
      </div>
      <ul className="flex flex-col gap-2.5">
        {read.items.map(item => (
          <li key={item} className="flex items-center gap-2.5 text-[15px] text-ink">
            <CheckCircle className="size-4 shrink-0 text-success" />
            {item}
          </li>
        ))}
      </ul>
      <div className="mt-auto rounded-md border border-line bg-surface-sunken/40 p-3.5">
        <div className="flex items-end justify-between gap-3">
          <div>
            <p className="text-[11px] text-ink-muted">{read.metric}, last 12 weeks</p>
            <p className="mt-0.5 font-display text-lg font-semibold text-ink tabular-nums">{formatNumber(latest)}</p>
          </div>
          <span className="font-mono text-[11px] text-success">+{formatNumber(latest - read.weeks[0])}</span>
        </div>
        <AreaChart
          series={[{ values: read.weeks, tone: read.tone }]}
          play={seen}
          gridLines={0}
          delay={250 + index * 120}
          className="mt-2 h-14"
        />
      </div>
    </motion.li>
  );
}

// the integrations wall from Activepieces, told honestly: three platforms, and what Twiligent reads from each
export function Platforms() {
  return (
    <section
      id="platforms"
      aria-labelledby="platforms-heading"
      className="container-page flex scroll-mt-24 flex-col gap-8 py-24 md:gap-12 md:py-32"
    >
      <SectionHeader
        id="platforms-heading"
        title="Three platforms. One dashboard."
        lead="YouTube and Reddit for analytics. Instagram for analytics and publishing."
      />
      <FoldBand placement="bottom-left" className="rounded-[32px] p-4 sm:p-8 lg:p-12">
        <ul className="grid gap-4 lg:grid-cols-3">
          {READS.map((read, i) => (
            <PlatformCard key={read.platform} read={read} index={i} />
          ))}
        </ul>
      </FoldBand>
      <FeatureNotes
        notes={[
          { title: 'Libraries', text: 'Every video, Short, reel, post and Reddit post, searchable and filterable.' },
          {
            title: 'Tracked content',
            text: 'Follow any Reddit post or YouTube video by its link, and group them into categories.',
          },
          { title: 'Open source', text: 'MIT licensed. Read every line on GitHub.' },
        ]}
      />
    </section>
  );
}
