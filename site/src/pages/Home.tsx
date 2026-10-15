import { lazy, Suspense } from 'react';
import { usePageMeta } from '@/lib/seo';
import { SIGN_UP_URL } from '@/lib/links';
import { AltArrowRight } from '@/components/icons';
import { FoldBand } from '@/components/brand';
import { Pill } from '@/components/Pill';
import { OverviewWindow } from '@/components/mockups/OverviewWindow';
import { PlatformMark } from '@/components/mockups/kit';
import { platformLabel } from '@/components/mockups/platforms';
import type { Platform } from '@/components/mockups/platforms';

// everything below the hero loads after it, so the first screen paints from the smallest bundle
const HomeBelow = lazy(() => import('./HomeBelow'));

const PLATFORMS: Platform[] = ['youtube', 'instagram', 'reddit'];

function Hero() {
  return (
    <section aria-labelledby="hero-heading" className="relative overflow-hidden pt-32 md:pt-40">
      <div className="container-page flex flex-col items-center text-center">
        <p className="eyebrow fold-in text-accent-text">YouTube, Instagram and Reddit, in one dashboard</p>
        <h1
          id="hero-heading"
          className="display fold-in mt-5 max-w-[17ch] text-[40px] leading-[44px] tracking-[-0.03em] text-ink sm:text-[52px] sm:leading-[56px] lg:text-[64px] lg:leading-[68px]"
        >
          Every channel, folded into one clear picture.
        </h1>
        <p className="fold-in mt-6 max-w-[40rem] text-lg leading-7 text-balance text-ink-muted">
          Twiligent puts your YouTube, Instagram and Reddit numbers side by side, publishes and schedules your Instagram
          posts, and runs on accounts you own.
        </p>
        <div className="fold-in mt-9 flex w-full flex-col items-center justify-center gap-3 sm:w-auto sm:flex-row">
          <Pill href={SIGN_UP_URL} size="lg" className="w-full sm:w-auto">
            Get started
            <AltArrowRight className="size-5 transition-transform group-hover:translate-x-0.5" />
          </Pill>
          <Pill href="/docs/self-host" variant="soft" size="lg" className="w-full sm:w-auto">
            Run your own
          </Pill>
        </div>
        <p className="mt-5 text-sm text-ink-muted">Free and open source under the MIT licence.</p>
        <div className="mt-10 flex flex-wrap items-center justify-center gap-x-8 gap-y-3">
          <span className="eyebrow text-ink-muted">Works with</span>
          {PLATFORMS.map(platform => (
            <span key={platform} className="flex items-center gap-2 text-[15px] font-semibold text-ink">
              <PlatformMark platform={platform} className="size-5" />
              {platformLabel(platform)}
            </span>
          ))}
        </div>
      </div>

      <div className="container-page mt-14 md:mt-16">
        <FoldBand
          placement="top-right"
          className="h-[24rem] rounded-t-[32px] px-3 pt-6 [mask-image:linear-gradient(to_bottom,black_78%,transparent)] sm:px-8 sm:pt-10 md:h-[34rem] lg:px-14 lg:pt-14"
        >
          <OverviewWindow className="mx-auto max-w-[68rem]" />
        </FoldBand>
      </div>
    </section>
  );
}

export default function Home() {
  usePageMeta({
    title: 'Twiligent',
    description:
      'Twiligent puts your YouTube, Instagram and Reddit numbers side by side, publishes and schedules your Instagram posts, and runs on accounts you own.',
    path: '/',
  });
  return (
    <>
      <Hero />
      <Suspense fallback={<div className="min-h-[100svh]" />}>
        <HomeBelow />
      </Suspense>
    </>
  );
}
