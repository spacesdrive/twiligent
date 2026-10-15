import type { MDXComponents } from 'mdx/types';
import { Badge, Callout, Card, Cards, CodeBlock, DocLink, Heading, InlineCode, Step, Steps } from './mdx';

// every MDX page renders through these, so the content files stay plain Markdown with a few named components
export const MDX_COMPONENTS: MDXComponents = {
  h2: ({ children }) => <Heading level={2}>{children}</Heading>,
  h3: ({ children }) => <Heading level={3}>{children}</Heading>,
  p: props => (
    <p className="my-4 text-base leading-7 text-ink-muted [&_strong]:font-semibold [&_strong]:text-ink" {...props} />
  ),
  ul: props => (
    <ul
      className="my-4 flex list-disc flex-col gap-2 pl-6 text-base leading-7 text-ink-muted marker:text-line-strong"
      {...props}
    />
  ),
  ol: props => (
    <ol
      className="my-4 flex list-decimal flex-col gap-2 pl-6 text-base leading-7 text-ink-muted marker:text-ink-muted"
      {...props}
    />
  ),
  strong: props => <strong className="font-semibold text-ink" {...props} />,
  a: DocLink,
  pre: CodeBlock,
  code: InlineCode,
  hr: () => <hr className="my-10 border-line" />,
  table: props => (
    <div className="my-6 overflow-x-auto rounded-lg border border-line">
      <table className="w-full min-w-[34rem] text-left text-sm leading-6" {...props} />
    </div>
  ),
  thead: props => <thead className="border-b border-line bg-surface-sunken" {...props} />,
  th: props => <th className="px-4 py-2.5 font-semibold text-ink" {...props} />,
  tr: props => <tr className="border-b border-line align-top last:border-0" {...props} />,
  td: props => <td className="px-4 py-3 text-ink-muted [&_strong]:font-semibold [&_strong]:text-ink" {...props} />,
  Callout,
  Steps,
  Step,
  Cards,
  Card,
  Badge,
};
