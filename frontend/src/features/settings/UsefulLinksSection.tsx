import React from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, BookOpen, ExternalLink } from 'lucide-react';
import SurfaceBox from '@/components/SurfaceBox';
import SettingsSection from './SettingsSection';
import { DOC_LINKS, EXTERNAL_LINKS } from './settingsData';

export default function UsefulLinksSection() {
  return (
    <SettingsSection id="links" title="Useful links">
      <SurfaceBox content={false} className="divide-y divide-divider">
        {DOC_LINKS.map(({ label, to }) => (
          <Link
            key={label}
            to={to}
            className="flex items-center justify-between gap-2 px-5 py-3 text-sm text-ink transition-colors duration-(--duration-fast) hover:bg-surface-hover"
          >
            <span className="flex items-center gap-2"><BookOpen className="size-4 shrink-0 stroke-[1.75] text-ink-faint" />{label}</span>
            <ArrowRight className="size-4 shrink-0 text-ink-faint" />
          </Link>
        ))}
        {EXTERNAL_LINKS.map(({ label, href }) => (
          <a
            key={label}
            href={href}
            target="_blank"
            rel="noreferrer"
            className="flex items-center justify-between gap-2 px-5 py-3 text-sm text-ink transition-colors duration-(--duration-fast) hover:bg-surface-hover"
          >
            {label}
            <ExternalLink className="size-4 shrink-0 text-ink-faint" />
          </a>
        ))}
      </SurfaceBox>
    </SettingsSection>
  );
}
