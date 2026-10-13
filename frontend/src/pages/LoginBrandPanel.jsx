import { Clock, TrendingUp } from 'lucide-react';
import { YouTubeIcon, InstagramIcon, RedditIcon } from '@/components/brand/platform-icons';

const PLATFORMS = [
  { icon: YouTubeIcon, label: 'YouTube' },
  { icon: InstagramIcon, label: 'Instagram' },
  { icon: RedditIcon, label: 'Reddit' },
];

// decorative preview, hidden from assistive technology and on small screens
export default function LoginBrandPanel() {
  return (
    <aside aria-hidden="true" className="hidden p-3 lg:block">
      <div className="sticky top-3 flex h-[calc(100svh-1.5rem)] flex-col overflow-hidden rounded-panel fold-band p-10 text-white xl:p-12">
        <img
          src="/Logos/twiligent-mark-white.svg"
          alt=""
          className="pointer-events-none absolute -right-24 -bottom-28 w-[70%] max-w-[40rem] opacity-[0.07] select-none"
          draggable={false}
        />

        <div className="relative flex items-center gap-2">
          {PLATFORMS.map(platform => {
            const Icon = platform.icon;
            return (
              <span key={platform.label} className="inline-flex h-8 items-center gap-1.5 rounded-pill border border-white/15 bg-white/10 px-3 text-small font-medium backdrop-blur-sm">
                <Icon className="size-3.5" />
                {platform.label}
              </span>
            );
          })}
        </div>

        <div className="relative flex min-h-0 flex-1 items-center justify-center py-8">
          <div className="relative w-full max-w-[25rem]">
            <div className="rounded-card border border-white/15 bg-white/10 p-5 shadow-lg backdrop-blur-md">
              <div className="flex items-center justify-between text-small text-white/75">
                <span>Audience</span>
                <span className="inline-flex items-center gap-1 rounded-pill bg-white/15 px-2 py-0.5 text-caption font-medium text-white">
                  <TrendingUp className="size-3" />
                  12.6%
                </span>
              </div>
              <p className="mt-2 font-heading text-[2.75rem] leading-none font-semibold tracking-[-0.03em] tabular-nums">128.4K</p>
              <svg viewBox="0 0 320 72" className="mt-4 h-16 w-full" fill="none" preserveAspectRatio="none">
                <defs>
                  <linearGradient id="login-spark" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="white" stopOpacity="0.35" />
                    <stop offset="100%" stopColor="white" stopOpacity="0" />
                  </linearGradient>
                </defs>
                <path d="M0 58 C30 54 48 60 72 50 S118 30 146 36 S196 44 222 26 S276 14 320 6 L320 72 L0 72 Z" fill="url(#login-spark)" />
                <path d="M0 58 C30 54 48 60 72 50 S118 30 146 36 S196 44 222 26 S276 14 320 6" stroke="white" strokeWidth="2.5" strokeLinecap="round" />
              </svg>
            </div>

            <div className="absolute -bottom-14 -left-10 flex w-64 items-center gap-3 rounded-card border border-white/15 bg-white/15 p-3.5 shadow-lg backdrop-blur-md xl:-left-14">
              <span className="grid size-10 shrink-0 place-items-center rounded-control bg-white/15">
                <InstagramIcon className="size-5" />
              </span>
              <div className="min-w-0 flex-1">
                <p className="text-small font-semibold">Reel scheduled</p>
                <p className="flex items-center gap-1 text-caption text-white/75"><Clock className="size-3" />Tomorrow, 09:00</p>
              </div>
            </div>

            <div className="absolute -top-[4.5rem] right-10 flex items-center gap-2.5 rounded-card border border-white/15 bg-white/15 px-3.5 py-3 shadow-lg backdrop-blur-md xl:-right-10">
              <YouTubeIcon className="size-5" />
              <div>
                <p className="text-caption text-white/75">Top video</p>
                <p className="text-small font-semibold tabular-nums">1.2M views</p>
              </div>
            </div>
          </div>
        </div>

        <div className="relative flex flex-col gap-3">
          <p className="max-w-md font-heading text-[clamp(1.75rem,min(2.8vw,5vh),2.5rem)] leading-[1.12] font-semibold tracking-[-0.025em]">
            Every channel, folded into one clear picture.
          </p>
          <p className="max-w-sm text-sm text-white/75">Analytics for YouTube, Instagram and Reddit, with scheduled publishing to Instagram.</p>
        </div>
      </div>
    </aside>
  );
}
