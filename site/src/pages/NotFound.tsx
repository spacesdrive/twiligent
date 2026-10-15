import { usePageMeta } from '@/lib/seo';
import { FoldBand } from '@/components/brand';
import { Pill } from '@/components/Pill';

export default function NotFound() {
  usePageMeta({
    title: 'Page not found',
    description: 'This page does not exist on the Twiligent site.',
    path: '/404',
  });
  return (
    <section className="container-page pt-32 md:pt-40">
      <FoldBand
        tone="dusk"
        placement="bottom-right"
        className="flex flex-col items-start gap-5 rounded-xl px-8 py-16 md:px-14 md:py-24"
      >
        <p className="eyebrow text-white/70">Error 404</p>
        <h1 className="display max-w-[14ch] text-[40px] leading-[46px] text-white md:text-[56px] md:leading-[62px]">
          This page is not here.
        </h1>
        <p className="max-w-lg text-lg leading-7 text-white/80">
          The link may be old, or the address may have a typo. Start from the home page, or look in the docs.
        </p>
        <div className="mt-2 flex flex-col gap-3 sm:flex-row">
          <Pill href="/" variant="white" size="lg">
            Go to the home page
          </Pill>
          <Pill href="/docs" variant="dusk" size="lg" className="ring-1 ring-white/30">
            Open the docs
          </Pill>
        </div>
      </FoldBand>
    </section>
  );
}
