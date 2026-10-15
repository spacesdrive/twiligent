import { useEffect, useState } from 'react';
import type { ComponentType } from 'react';
import { Link, useLocation } from 'react-router';
import { MDXProvider } from '@mdx-js/react';
import { usePageMeta } from '@/lib/seo';
import { DOCS_EDIT_URL, ISSUES_URL } from '@/lib/links';
import { AltArrowLeft, AltArrowRight, DangerTriangleLine, Pen } from '@/components/icons';
import { MDX_COMPONENTS } from './mdxComponents';
import { docEntry, docNeighbours, slugFromPath } from './nav';
import { Toc } from './Toc';

interface DocModule {
  default: ComponentType;
  meta: { title: string; description: string };
}

// every page under content/docs, loaded when it is opened
const PAGES = import.meta.glob<DocModule>('/content/docs/**/*.mdx');

function fileFor(slug: string): string | undefined {
  const candidates = slug
    ? [`/content/docs/${slug}.mdx`, `/content/docs/${slug}/index.mdx`]
    : ['/content/docs/index.mdx'];
  return candidates.find(path => path in PAGES);
}

export default function DocPage() {
  const { pathname } = useLocation();
  const slug = slugFromPath(pathname);
  const file = fileFor(slug);
  const entry = docEntry(slug);
  const [loaded, setLoaded] = useState<{ file: string; module: DocModule } | null>(null);
  const [article, setArticle] = useState<HTMLElement | null>(null);

  useEffect(() => {
    if (!file) return;
    let current = true;
    PAGES[file]().then(module => current && setLoaded({ file, module }));
    return () => {
      current = false;
    };
  }, [file]);

  const module = loaded && loaded.file === file ? loaded.module : null;
  usePageMeta({
    title: module?.meta.title ?? entry?.title ?? 'Page not found',
    description: module?.meta.description ?? 'Twiligent documentation.',
    path: pathname,
  });

  if (!file) {
    return (
      <article id="doc-content" className="min-w-0 flex-1 py-12">
        <p className="eyebrow text-accent-text">Error 404</p>
        <h1 className="display mt-3 text-[36px] leading-[42px] text-ink">This docs page is not here.</h1>
        <p className="mt-4 text-lg text-ink-muted">
          The link may be old. Use the search above, or{' '}
          <Link to="/docs" className="font-medium text-accent-text underline underline-offset-4">
            start from the docs home
          </Link>
          .
        </p>
      </article>
    );
  }

  const { prev, next } = docNeighbours(slug);
  const editPath = file.replace('/content/docs', '');
  const Content = module?.default;
  return (
    <>
      <article id="doc-content" ref={setArticle} className="min-w-0 flex-1 py-10 lg:max-w-[46rem]">
        {entry && <p className="text-sm font-semibold text-accent-text">{entry.group.label}</p>}
        <h1 className="display mt-2 text-[32px] leading-[40px] text-ink md:text-[36px] md:leading-[44px]">
          {module?.meta.title ?? entry?.title}
        </h1>
        {/* until the page arrives, its space is held so nothing below it jumps */}
        {module ? (
          <p className="mt-3 text-lg leading-7 text-ink-muted">{module.meta.description}</p>
        ) : (
          <div className="mt-3 h-7" aria-hidden="true" />
        )}
        <div className="mt-8" aria-busy={!Content}>
          {Content ? (
            <MDXProvider components={MDX_COMPONENTS}>
              <Content />
            </MDXProvider>
          ) : (
            <div className="flex min-h-[100svh] flex-col gap-3" aria-hidden="true">
              {[0, 1, 2, 3].map(i => (
                <div
                  key={i}
                  className="h-4 animate-pulse rounded bg-surface-sunken"
                  style={{ width: `${92 - i * 14}%` }}
                />
              ))}
            </div>
          )}
        </div>
        {Content && (
          <>
            <div className="mt-14 flex flex-wrap gap-2 border-t border-line pt-6">
              <a
                href={`${DOCS_EDIT_URL}${editPath}`}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 rounded-full border border-line px-3.5 py-1.5 text-sm text-ink-muted hover:border-line-strong hover:text-ink"
              >
                <Pen className="size-4" />
                Suggest edits
              </a>
              <a
                href={`${ISSUES_URL}?title=${encodeURIComponent(`Docs: ${entry?.title ?? slug}`)}`}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 rounded-full border border-line px-3.5 py-1.5 text-sm text-ink-muted hover:border-line-strong hover:text-ink"
              >
                <DangerTriangleLine className="size-4" />
                Raise issue
              </a>
            </div>

            <nav aria-label="Previous and next page" className="mt-8 flex justify-between gap-4">
              {prev ? (
                <Link
                  to={prev.path}
                  className="flex items-center gap-1.5 text-[15px] font-semibold text-ink hover:text-accent-text"
                >
                  <AltArrowLeft className="size-4" />
                  {prev.title}
                </Link>
              ) : (
                <span />
              )}
              {next && (
                <Link
                  to={next.path}
                  className="flex items-center gap-1.5 text-right text-[15px] font-semibold text-ink hover:text-accent-text"
                >
                  {next.title}
                  <AltArrowRight className="size-4" />
                </Link>
              )}
            </nav>
          </>
        )}
      </article>
      <aside className="sticky top-28 hidden h-[calc(100svh-7rem)] w-60 shrink-0 overflow-y-auto py-10 xl:block">
        <Toc article={article} pageKey={`${file}:${module ? 'ready' : 'loading'}`} />
      </aside>
    </>
  );
}
