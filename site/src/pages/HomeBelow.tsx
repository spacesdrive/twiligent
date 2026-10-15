import { MotionConfig } from 'motion/react';
import { GITHUB_URL, SIGN_UP_URL } from '@/lib/links';
import { Story } from '@/components/sections/Story';
import { BentoCard, CtaBand, FeatureSection, SectionHeader } from '@/components/sections/blocks';
import { Platforms } from '@/components/sections/Platforms';
import { Faq } from '@/components/sections/Faq';
import { AnalyticsCard } from '@/components/mockups/AnalyticsCard';
import { ScheduleCard } from '@/components/mockups/ScheduleCard';
import { BackupSchedulerMock } from '@/components/mockups/bento/BackupSchedulerMock';
import { DatabaseMock } from '@/components/mockups/bento/DatabaseMock';
import { EdgeMock } from '@/components/mockups/bento/EdgeMock';
import { FreePlansMock } from '@/components/mockups/bento/FreePlansMock';
import { LeaderboardMock } from '@/components/mockups/bento/LeaderboardMock';
import { LibraryMock } from '@/components/mockups/bento/LibraryMock';
import { MembersMock } from '@/components/mockups/bento/MembersMock';
import { SignInMock } from '@/components/mockups/bento/SignInMock';
import { TokenMock } from '@/components/mockups/bento/TokenMock';
import { TrackedMock } from '@/components/mockups/bento/TrackedMock';

// the home page below the hero, in the order of the Activepieces home page
export default function HomeBelow() {
  return (
    // every animation below follows the reader's reduced motion setting
    <MotionConfig reducedMotion="user">
      <Story />

      <CtaBand
        title="See every account in one place."
        text="Sign in with Google or email, add a channel link or connect Instagram. The Overview fills in within a minute or two."
        primary={{ label: 'Get started', href: SIGN_UP_URL }}
        secondary={{ label: 'Read the docs', href: '/docs' }}
      />

      <FeatureSection
        id="analytics"
        title="Every number, side by side."
        lead="Subscribers, followers, karma, views, likes and comments across YouTube, Instagram and Reddit, with a detail page for each account."
        notes={[
          {
            title: 'YouTube in depth',
            text: 'Videos and Shorts, engagement, publishing patterns, growth, tags and SEO.',
          },
          {
            title: 'Instagram in depth',
            text: 'Engagement, the best day and hour to post, consistency, content types and hashtags.',
          },
          { title: 'Reddit too', text: 'Karma, posts and comments for every profile you add.' },
        ]}
      >
        <AnalyticsCard />
      </FeatureSection>

      <FeatureSection
        id="publishing"
        title="Post now, or at the hour you pick."
        lead="Publish photos, Reels and Stories to Instagram, schedule them for later, or upload many files at once."
        placement="bottom-left"
        tone="dusk"
        notes={[
          {
            title: 'Scheduled on the server',
            text: 'The server publishes within 15 minutes of the time you pick, even with your browser closed.',
          },
          { title: 'Bulk upload', text: 'Add many files, give each its own caption or share one, and space them out.' },
          { title: 'Status you can read', text: 'Every post shows Pending, Published or Failed, with the reason.' },
        ]}
      >
        <ScheduleCard />
      </FeatureSection>

      <section
        id="own"
        aria-labelledby="own-heading"
        className="container-page flex scroll-mt-24 flex-col gap-8 py-24 md:gap-12 md:py-32"
      >
        <SectionHeader id="own-heading" title="Runs on accounts you own." />
        <div className="grid gap-5 md:grid-cols-2">
          <BentoCard
            title="Your own database"
            text="Everything lives in your Supabase project, and each member's data is kept apart."
            tone="fold"
          >
            <DatabaseMock />
          </BentoCard>
          <BentoCard
            title="At the edge"
            text="One Cloudflare Worker serves the app. There is no server to patch."
            placement="bottom-left"
          >
            <EdgeMock />
          </BentoCard>
        </div>
        <div className="grid gap-5 md:grid-cols-[5fr_8fr]">
          <BentoCard
            title="Mostly free plans"
            text="Supabase, Cloudflare, Cloudinary and Upstash free plans are enough to start."
            placement="bottom-left"
          >
            <FreePlansMock />
          </BentoCard>
          <BentoCard
            title="Sign in your way"
            text="Google, or email with a 6-digit code."
            tone="fold"
            placement="bottom-right"
          >
            <SignInMock />
          </BentoCard>
        </div>
        <div className="grid gap-5 md:grid-cols-[8fr_5fr]">
          <BentoCard
            title="Access that stays fresh"
            text="Instagram access renews by itself every day."
            tone="fold"
            placement="bottom-left"
          >
            <TokenMock />
          </BentoCard>
          <BentoCard
            title="A backup scheduler"
            text="GitHub Actions can publish due posts as a second scheduler."
            placement="bottom-right"
          >
            <BackupSchedulerMock />
          </BentoCard>
        </div>
      </section>

      <CtaBand
        title="Run your own copy."
        text="Set up Supabase, the platform keys and Cloudflare step by step, mostly on free plans."
        primary={{ label: 'Read the self-hosting guide', href: '/docs/self-host' }}
        secondary={{ label: 'View on GitHub', href: GITHUB_URL }}
      />

      <Platforms />

      <section
        id="team"
        aria-labelledby="team-heading"
        className="container-page flex scroll-mt-24 flex-col gap-8 py-24 md:gap-12 md:py-32"
      >
        <SectionHeader id="team-heading" title="Made for the team behind the channels." />
        <div className="grid gap-5 md:grid-cols-2">
          <BentoCard title="Overview" text="Totals, comparisons and leaderboards across every account." tone="fold">
            <LeaderboardMock />
          </BentoCard>
          <BentoCard title="Libraries" text="Search and filter every video, reel and post." placement="bottom-left">
            <LibraryMock />
          </BentoCard>
          <BentoCard title="Tracked content" text="Watch the posts that matter, side by side." placement="bottom-left">
            <TrackedMock />
          </BentoCard>
          <BentoCard
            title="Members and administrators"
            text="One person runs the instance. Everyone else signs in and connects their own accounts."
            tone="fold"
            placement="bottom-right"
          >
            <MembersMock />
          </BentoCard>
        </div>
      </section>

      <Faq />
    </MotionConfig>
  );
}
