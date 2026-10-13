import { Link } from 'react-router-dom';
import { Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';

export default function GettingStarted() {
  return (
    <section className="relative overflow-hidden rounded-panel border border-line bg-surface-raised">
      <div aria-hidden="true" className="fold-band absolute inset-y-0 right-0 hidden w-2/5 [clip-path:polygon(35%_0,100%_0,100%_100%,0_100%)] md:block" />
      <div className="relative flex max-w-xl flex-col gap-4 p-8">
        <p className="eyebrow text-brand-text">Getting started</p>
        <h2 className="font-heading text-page-title font-semibold text-ink">Bring your channels into one picture.</h2>
        <p className="text-sm text-ink-muted">Add a YouTube channel, connect an Instagram Business or Creator account, or add a Reddit profile. Analytics start filling in as soon as an account is added.</p>
        <div><Button render={<Link to="/accounts?add=1" />}><Plus data-icon="inline-start" />Add an account</Button></div>
      </div>
    </section>
  );
}
