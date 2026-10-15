import { useRef } from 'react';
import { motion } from 'motion/react';
import { cn } from '@/lib/cn';
import { useAutoplay } from '@/hooks/useAutoplay';
import { Key, LockKeyhole, UsersGroup } from '@/components/icons';
import { PlatformMark } from '../kit';
import type { Platform } from '../platforms';
import { Frame } from './Frame';

interface Person {
  name: string;
  email: string;
  role: 'Administrator' | 'Member';
  accounts: Platform[];
}

const PEOPLE: Person[] = [
  {
    name: 'Asha',
    email: 'asha@northwind.kitchen',
    role: 'Administrator',
    accounts: ['youtube', 'instagram', 'youtube', 'reddit'],
  },
  { name: 'Ben', email: 'ben@northwind.kitchen', role: 'Member', accounts: ['youtube', 'reddit'] },
  { name: 'Chloe', email: 'chloe@northwind.kitchen', role: 'Member', accounts: ['instagram', 'reddit'] },
];

const STEPS = [0.3, 7];
const EASE = [0.22, 1, 0.36, 1] as const;

// who is on an instance: one administrator who runs it, members who sign in and connect their own accounts,
// and the keys everyone shares
export function MembersMock() {
  const ref = useRef<HTMLDivElement>(null);
  const { phase, loop } = useAutoplay(ref, STEPS);
  const shown = phase >= 1;

  return (
    <Frame
      ref={ref}
      label="One administrator and two members on the same instance, each with their own connected accounts, sharing the keys the administrator set up."
      icon={<UsersGroup className="size-5" />}
      title="People"
      meta={<span className="font-mono text-[11px] text-ink-muted">{PEOPLE.length} on this instance</span>}
    >
      <ul key={loop} className="flex flex-col">
        {PEOPLE.map((person, i) => (
          <motion.li
            key={person.name}
            className="flex items-center gap-3 border-b border-line px-5 py-3"
            initial={{ opacity: 0, x: -10 }}
            animate={shown ? { opacity: 1, x: 0 } : { opacity: 0, x: -10 }}
            transition={{ duration: 0.45, ease: EASE, delay: i * 0.12 }}
          >
            <span className="grid size-9 shrink-0 place-items-center rounded-full bg-accent-soft text-xs font-semibold text-accent-text">
              {person.name[0]}
            </span>
            <div className="min-w-0 flex-1">
              <p className="text-[13px] font-medium text-ink">{person.name}</p>
              <p className="truncate font-mono text-[10px] text-ink-muted">{person.email}</p>
            </div>
            <div className="flex flex-col items-end gap-1.5">
              <span
                className={cn(
                  'rounded-full px-2.5 py-0.5 text-[10px] font-semibold',
                  person.role === 'Administrator'
                    ? 'bg-afterglow-soft text-afterglow-text'
                    : 'bg-surface-sunken text-ink-muted',
                )}
              >
                {person.role}
              </span>
              <span className="flex gap-1">
                {person.accounts.map((platform, j) => (
                  <PlatformMark key={j} platform={platform} className="size-3" />
                ))}
              </span>
            </div>
          </motion.li>
        ))}
      </ul>
      <motion.div
        key={`shared-${loop}`}
        className="mx-4 mt-3 rounded-md border border-dashed border-line-strong p-3"
        initial={{ opacity: 0, y: 8 }}
        animate={shown ? { opacity: 1, y: 0 } : { opacity: 0, y: 8 }}
        transition={{ duration: 0.5, ease: EASE, delay: 0.5 }}
      >
        <p className="flex items-center gap-1.5 text-[11px] font-semibold text-ink">
          <Key className="size-3.5 text-afterglow-text" />
          Shared, set up by the administrator
        </p>
        <p className="mt-1 text-[11px] text-ink-muted">YouTube API key, Instagram app, Cloudinary</p>
        <p className="mt-2 flex items-center gap-1.5 text-[11px] font-semibold text-ink">
          <LockKeyhole className="size-3.5 text-success" />
          Each person's accounts stay their own
        </p>
      </motion.div>
    </Frame>
  );
}
