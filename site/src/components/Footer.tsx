import { Link } from 'react-router';
import { CHANGELOG_URL, GITHUB_URL, LICENSE_URL, PRIVACY_URL, SIGN_UP_URL } from '@/lib/links';
import { CheckCircle } from './icons';
import { Logo, RibbonCrop } from './brand';
import { Pill } from './Pill';

interface FooterLink {
  label: string;
  href: string;
}

const COLUMNS: { heading: string; links: FooterLink[] }[] = [
  {
    heading: 'Product',
    links: [
      { label: 'Analytics', href: '/#analytics' },
      { label: 'Publishing', href: '/#publishing' },
      { label: 'Tracked content', href: '/docs/use/tracked-content' },
      { label: 'Libraries', href: '/docs/use/analytics' },
    ],
  },
  {
    heading: 'Docs',
    links: [
      { label: 'Using Twiligent', href: '/docs/use/getting-started' },
      { label: 'Run your own', href: '/docs/self-host' },
      { label: 'Reference', href: '/docs/reference/environment' },
      { label: 'FAQ', href: '/docs/reference/faq' },
    ],
  },
  {
    heading: 'Project',
    links: [
      { label: 'GitHub', href: GITHUB_URL },
      { label: 'Changelog', href: CHANGELOG_URL },
      { label: 'MIT licence', href: LICENSE_URL },
      { label: 'Privacy policy', href: PRIVACY_URL },
    ],
  },
];

const TICKS = ['Open source', 'Your own data', 'Mostly free plans'];

function FooterAnchor({ link }: { link: FooterLink }) {
  const cls = 'text-[15px] text-ink-muted transition-colors hover:text-ink';
  if (link.href.startsWith('/'))
    return (
      <Link to={link.href} className={cls}>
        {link.label}
      </Link>
    );
  return (
    <a href={link.href} target="_blank" rel="noopener noreferrer" className={cls}>
      {link.label}
    </a>
  );
}

export function Footer() {
  return (
    <footer className="mt-24">
      <div className="relative isolate overflow-hidden bg-fold">
        <RibbonCrop placement="bottom-left" size="w-[40rem]" className="-z-10" />
        <RibbonCrop placement="bottom-right" size="w-[30rem]" className="-z-10" />
        <div className="container-page flex flex-col items-center py-24 text-center text-white md:py-32">
          <p className="eyebrow text-white/80">Intelligence, folded into everything</p>
          <h2 className="display mt-4 max-w-[16ch] text-[40px] leading-[46px] md:text-[56px] md:leading-[62px]">
            Bring every channel into view.
          </h2>
          <p className="mt-4 max-w-xl text-lg leading-7 text-white/85">Start on our instance, or run your own.</p>
          <div className="mt-8 flex w-full flex-col items-center justify-center gap-3 sm:w-auto sm:flex-row">
            <Pill href={SIGN_UP_URL} variant="dusk" size="lg" className="w-full sm:w-auto">
              Get started
            </Pill>
            <Pill href="/docs/self-host" variant="white" size="lg" className="w-full sm:w-auto">
              Run your own
            </Pill>
          </div>
          <ul className="mt-6 flex flex-wrap justify-center gap-x-5 gap-y-2 text-sm text-white/85">
            {TICKS.map(tick => (
              <li key={tick} className="flex items-center gap-1.5">
                <CheckCircle className="size-4" />
                {tick}
              </li>
            ))}
          </ul>
        </div>
      </div>

      <div className="bg-surface pb-10">
        <div className="container-page">
          <div className="relative -mt-10 rounded-xl border border-line bg-surface-raised px-6 py-10 md:px-12">
            <div className="grid gap-10 md:grid-cols-[1.4fr_repeat(3,1fr)]">
              <div className="flex flex-col gap-3">
                <Logo className="h-7" />
                <p className="max-w-xs text-[15px] leading-6 text-ink-muted">
                  YouTube, Instagram and Reddit in one dashboard you can run yourself.
                </p>
              </div>
              {COLUMNS.map(column => (
                <nav key={column.heading} aria-label={column.heading} className="flex flex-col gap-3">
                  <p className="eyebrow text-ink-muted">{column.heading}</p>
                  <ul className="flex flex-col gap-2.5">
                    {column.links.map(link => (
                      <li key={link.label}>
                        <FooterAnchor link={link} />
                      </li>
                    ))}
                  </ul>
                </nav>
              ))}
            </div>
            <div className="mt-10 border-t border-line pt-6 text-[13px] text-ink-muted">
              <p>&copy; {new Date().getFullYear()} Twiligent</p>
            </div>
          </div>
        </div>
      </div>
    </footer>
  );
}
