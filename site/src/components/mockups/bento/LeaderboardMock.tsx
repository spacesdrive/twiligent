import { useRef } from 'react';
import { motion } from 'motion/react';
import { cn } from '@/lib/cn';
import { useAutoplay } from '@/hooks/useAutoplay';
import { Chart } from '@/components/icons';
import { PlatformMark } from '../kit';
import { platformLabel } from '../platforms';
import { CountUp } from '../CountUp';
import { ACCOUNTS } from '../sample';
import { Frame } from './Frame';

const GAINED = ['+1,063', '+322', '+415', '+96'];
const STEPS = [0.4, 7];
const EASE = [0.22, 1, 0.36, 1] as const;

// the Overview leaderboard: every account ranked by audience, its count ticking up and its bar growing
export function LeaderboardMock() {
  const ref = useRef<HTMLDivElement>(null);
  const { phase, loop } = useAutoplay(ref, STEPS);
  const top = ACCOUNTS[0].audience;
  const play = phase >= 1;

  return (
    <Frame
      ref={ref}
      label="The Overview leaderboard ranking four accounts across YouTube, Instagram and Reddit by audience, with each one's gain this week."
      icon={<Chart className="size-5" />}
      title="Top accounts"
      meta={
        <span className="rounded-full bg-surface-sunken px-2.5 py-1 text-[11px] font-medium text-ink-muted">
          Audience
        </span>
      }
    >
      <ul className="flex flex-col">
        {ACCOUNTS.map((account, i) => (
          <li key={account.name} className="border-b border-line px-5 py-3.5">
            <div className="flex items-center gap-3">
              <span className="w-3 font-mono text-[11px] text-ink-muted">{i + 1}</span>
              <span className="grid size-8 shrink-0 place-items-center rounded-full bg-surface-sunken">
                <PlatformMark platform={account.platform} className="size-4" />
              </span>
              <div className="min-w-0 flex-1">
                <p className="truncate text-[13px] font-medium text-ink">{account.name}</p>
                <p className="text-[10px] text-ink-muted">{platformLabel(account.platform)}</p>
              </div>
              <div className="text-right">
                <CountUp
                  key={loop}
                  value={account.audience}
                  active={play}
                  from={Math.round(account.audience * 0.96)}
                  className="block font-mono text-xs text-ink"
                />
                <p className="font-mono text-[10px] text-success">{GAINED[i]}</p>
              </div>
            </div>
            <span className="mt-2.5 ml-6 block h-1 overflow-hidden rounded-full bg-surface-sunken">
              <motion.span
                key={loop}
                className={cn('block h-full rounded-full', i === 0 ? 'bg-accent' : 'bg-line-strong')}
                initial={{ width: '0%' }}
                animate={{ width: play ? `${(account.audience / top) * 100}%` : '0%' }}
                transition={{ duration: 1.1, ease: EASE, delay: 0.1 + i * 0.12 }}
              />
            </span>
          </li>
        ))}
      </ul>
    </Frame>
  );
}
