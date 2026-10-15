import { useId, useState } from 'react';
import type { ReactNode } from 'react';
import { Link } from 'react-router';
import { Add, Close } from '@/components/icons';
import { cn } from '@/lib/cn';

// the answers are the docs FAQ word for word, so the site and the docs never disagree
const QUESTIONS: { q: string; a: ReactNode }[] = [
  {
    q: 'What does running an instance cost?',
    a: 'For a small team, nothing. Supabase, Cloudflare, Cloudinary and Upstash free plans cover typical use, and the YouTube and Instagram APIs are free.',
  },
  {
    q: 'How fresh is the data?',
    a: 'Data is fetched when you open a page or choose Refresh, and cached for a short time when Redis is set up. Instagram tokens are renewed nightly.',
  },
  {
    q: 'Does Twiligent publish to YouTube or Reddit?',
    a: 'No. Publishing is Instagram only. YouTube and Reddit are analytics only.',
  },
  {
    q: 'Do I need my own Supabase project?',
    a: "Only if you run your own instance. Members of someone else's instance use theirs.",
  },
  {
    q: "Why can't I connect my Instagram account?",
    a: (
      <>
        It must be a Business or Creator account, and while the instance's Meta app is in development mode it must be
        added as a tester. See{' '}
        <Link to="/docs/use/connect-accounts" className="font-medium text-accent-text underline underline-offset-4">
          Connect your accounts
        </Link>
        .
      </>
    ),
  },
  {
    q: 'Do I need GitHub to schedule posts?',
    a: 'No. Members never do. Administrators only need the deployed Worker; the GitHub workflow is an optional backup.',
  },
];

function Question({ q, a, open, onToggle }: { q: string; a: ReactNode; open: boolean; onToggle: () => void }) {
  const id = useId();
  return (
    <li className="rounded-lg border border-line bg-surface-raised">
      <h3>
        <button
          type="button"
          aria-expanded={open}
          aria-controls={id}
          onClick={onToggle}
          className="flex w-full items-center justify-between gap-4 px-6 py-5 text-left text-[17px] font-semibold text-ink"
        >
          {q}
          {open ? (
            <Close className="size-5 shrink-0 text-ink-muted" />
          ) : (
            <Add className="size-5 shrink-0 text-ink-muted" />
          )}
        </button>
      </h3>
      <div id={id} hidden={!open} className={cn('px-6 pb-5 text-base leading-7 text-ink-muted')}>
        {a}
      </div>
    </li>
  );
}

export function Faq() {
  const [open, setOpen] = useState(0);
  return (
    <section
      id="faq"
      aria-labelledby="faq-heading"
      className="mx-auto w-full max-w-3xl scroll-mt-24 px-5 py-24 md:py-32"
    >
      <h2 id="faq-heading" className="display text-[36px] leading-[40px] text-ink md:text-[44px] md:leading-[50px]">
        Questions, answered
      </h2>
      <ul className="mt-8 flex flex-col gap-3">
        {QUESTIONS.map((item, i) => (
          <Question
            key={item.q}
            q={item.q}
            a={item.a}
            open={open === i}
            onToggle={() => setOpen(current => (current === i ? -1 : i))}
          />
        ))}
      </ul>
      <p className="mt-6 text-[15px] text-ink-muted">
        More in the{' '}
        <Link to="/docs/reference/faq" className="font-medium text-accent-text underline underline-offset-4">
          FAQ
        </Link>
        .
      </p>
    </section>
  );
}
