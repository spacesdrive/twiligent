import { useRef } from 'react';
import { motion } from 'motion/react';
import { useAutoplay } from '@/hooks/useAutoplay';
import { Cloud, Database, Gallery, ServerSquare, Widget } from '@/components/icons';
import type { Icon } from '@/components/icons';
import { Frame } from './Frame';

interface Service {
  name: string;
  use: string;
  icon: Icon;
  // a sample share of the free plan in use, for the meter only
  used: number;
}

// what each service does for Twiligent, as the self-hosting guide sets them up
const SERVICES: Service[] = [
  { name: 'Supabase', use: 'Database and sign-in', icon: Database, used: 18 },
  { name: 'Cloudflare', use: 'The Worker and the website', icon: Cloud, used: 9 },
  { name: 'Cloudinary', use: 'Photos and videos to publish', icon: Gallery, used: 24 },
  { name: 'Upstash Redis', use: 'Cache, optional', icon: ServerSquare, used: 6 },
];

const STEPS = [0.5, 6];
const EASE = [0.22, 1, 0.36, 1] as const;

// the services an instance runs on, each on its free plan, with a meter of how little of it is used
export function FreePlansMock() {
  const ref = useRef<HTMLDivElement>(null);
  const { phase, loop } = useAutoplay(ref, STEPS);
  return (
    <Frame
      ref={ref}
      label="Supabase, Cloudflare, Cloudinary and Upstash Redis, each on its free plan, with most of each plan unused."
      icon={<Widget className="size-5" />}
      title="Services"
      meta={<span className="font-mono text-[11px] text-ink-muted">4 free plans</span>}
    >
      <ul className="flex flex-col gap-2.5 p-4">
        {SERVICES.map((service, i) => {
          const Glyph = service.icon;
          return (
            <li key={service.name} className="rounded-md border border-line px-3.5 py-3">
              <div className="flex items-center gap-3">
                <span className="grid size-8 shrink-0 place-items-center rounded-md bg-surface-sunken text-ink-muted">
                  <Glyph className="size-4" />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="text-[13px] font-semibold text-ink">{service.name}</p>
                  <p className="truncate text-[11px] text-ink-muted">{service.use}</p>
                </div>
                <span className="rounded-full bg-success-soft px-2.5 py-0.5 text-[10px] font-semibold text-success">
                  Free plan
                </span>
              </div>
              <span className="mt-2.5 block h-1 overflow-hidden rounded-full bg-surface-sunken">
                <motion.span
                  key={loop}
                  className="block h-full rounded-full bg-success"
                  initial={{ width: '0%' }}
                  animate={{ width: phase >= 1 ? `${service.used}%` : '0%' }}
                  transition={{ duration: 1.1, ease: EASE, delay: i * 0.12 }}
                />
              </span>
            </li>
          );
        })}
      </ul>
    </Frame>
  );
}
