import type { ReactNode } from 'react';
import { cn } from '@/lib/cn';
import { FoldBand } from '@/components/brand';
import type { RibbonPlacement } from '@/components/brand';
import { Pill } from '@/components/Pill';

export interface SectionHeaderProps {
  id: string;
  title: string;
  lead?: string;
  children?: ReactNode;
}

// the Activepieces section opening: the headline on the left, one supporting line on the right
export function SectionHeader({ id, title, lead, children }: SectionHeaderProps) {
  return (
    <div className="flex flex-col gap-5 md:flex-row md:items-end md:justify-between md:gap-12">
      <h2 id={id} className="display max-w-[16ch] text-[36px] leading-[40px] text-ink md:text-[44px] md:leading-[50px]">
        {title}
      </h2>
      {(lead || children) && (
        <div className="flex max-w-md flex-col gap-4">
          {lead && <p className="text-lg leading-7 text-ink-muted">{lead}</p>}
          {children}
        </div>
      )}
    </div>
  );
}

export interface FeatureNote {
  title: string;
  text: string;
}

// three short notes under a feature panel, split by hairlines
export function FeatureNotes({ notes }: { notes: FeatureNote[] }) {
  return (
    <div className="grid gap-6 md:grid-cols-3 md:gap-0">
      {notes.map((note, i) => (
        <div
          key={note.title}
          className={cn(
            'flex flex-col gap-2',
            i > 0 && 'md:border-l md:border-line md:pl-6',
            i < notes.length - 1 && 'md:pr-6',
          )}
        >
          <h3 className="text-lg font-semibold text-ink">{note.title}</h3>
          <p className="text-base leading-6 text-ink-muted">{note.text}</p>
        </div>
      ))}
    </div>
  );
}

export interface FeatureSectionProps {
  id: string;
  title: string;
  lead: string;
  notes: FeatureNote[];
  placement?: RibbonPlacement;
  tone?: 'fold' | 'dusk';
  children: ReactNode;
}

// a headline, a wide brand panel holding one animated mockup, and three notes beneath
export function FeatureSection({
  id,
  title,
  lead,
  notes,
  placement = 'bottom-right',
  tone = 'fold',
  children,
}: FeatureSectionProps) {
  return (
    <section
      id={id}
      aria-labelledby={`${id}-heading`}
      className="container-page flex scroll-mt-24 flex-col gap-8 py-24 md:gap-12 md:py-32"
    >
      <SectionHeader id={`${id}-heading`} title={title} lead={lead} />
      <FoldBand
        tone={tone}
        placement={placement}
        className="flex min-h-[28rem] items-center justify-center rounded-[32px] px-4 py-10 sm:px-8 md:min-h-[34rem]"
      >
        {children}
      </FoldBand>
      <FeatureNotes notes={notes} />
    </section>
  );
}

export interface CtaBandProps {
  title: string;
  text: string;
  primary: { label: string; href: string };
  secondary: { label: string; href: string };
}

// the bordered call-to-action band between sections; buttons stay beside the text on wide screens and stack on phones
export function CtaBand({ title, text, primary, secondary }: CtaBandProps) {
  return (
    <section className="container-page py-12 md:py-16">
      <div className="flex flex-col gap-6 rounded-xl border border-line bg-surface-raised p-8 md:p-10 lg:flex-row lg:items-center lg:justify-between">
        <div className="max-w-2xl">
          <h2 className="display text-[26px] leading-8 text-ink md:text-[30px] md:leading-9">{title}</h2>
          <p className="mt-3 text-base leading-7 text-ink-muted md:text-[17px]">{text}</p>
        </div>
        <div className="flex flex-col gap-3 sm:flex-row lg:shrink-0 lg:flex-nowrap">
          <Pill href={primary.href} className="w-full sm:w-auto">
            {primary.label}
          </Pill>
          <Pill href={secondary.href} variant="soft" className="w-full sm:w-auto">
            {secondary.label}
          </Pill>
        </div>
      </div>
    </section>
  );
}

export interface BentoCardProps {
  title: string;
  text: string;
  placement?: RibbonPlacement;
  tone?: 'fold' | 'dusk';
  className?: string;
  children: ReactNode;
}

// a grid card: a name and one line, then a brand panel with a small mockup cropped by its lower edge
export function BentoCard({
  title,
  text,
  placement = 'bottom-right',
  tone = 'dusk',
  className,
  children,
}: BentoCardProps) {
  return (
    <article className={cn('flex flex-col overflow-hidden rounded-xl border border-line bg-surface-raised', className)}>
      <div className="px-6 pt-6 pb-5">
        <h3 className="text-xl font-semibold text-ink">{title}</h3>
        <p className="mt-1.5 text-[15px] leading-6 text-ink-muted">{text}</p>
      </div>
      <FoldBand
        tone={tone}
        placement={placement}
        className="relative flex min-h-[19rem] flex-1 flex-col px-6 pt-6 sm:px-9 sm:pt-8"
      >
        {children}
      </FoldBand>
    </article>
  );
}
