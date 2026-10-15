import { readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { join, relative, resolve, sep } from 'node:path';
import MiniSearch from 'minisearch';
import type { Plugin } from 'vite';
import { SEARCH_OPTIONS, slugify } from '../src/docs/searchShared.ts';
import type { SearchDocument } from '../src/docs/searchShared.ts';

export const SITE_URL = 'https://twiligent.ujjwal.fyi';
const VIRTUAL_ID = 'virtual:docs-search';
const RESOLVED_ID = `\0${VIRTUAL_ID}`;
const MARKETING_ROUTES = ['/'];

interface DocFile {
  path: string;
  // the URL path under /docs, '' for the docs home
  slug: string;
  source: string;
}

function listDocs(root: string): DocFile[] {
  const files: DocFile[] = [];
  const walk = (dir: string) => {
    for (const name of readdirSync(dir)) {
      const path = join(dir, name);
      if (statSync(path).isDirectory()) walk(path);
      else if (name.endsWith('.mdx')) {
        const slug = relative(root, path)
          .split(sep)
          .join('/')
          .replace(/\.mdx$/, '')
          .replace(/(^|\/)index$/, '');
        files.push({ path, slug, source: readFileSync(path, 'utf8') });
      }
    }
  };
  walk(root);
  return files;
}

function pageTitle(source: string, fallback: string): string {
  return source.match(/title:\s*'([^']+)'/)?.[1] ?? source.match(/title:\s*"([^"]+)"/)?.[1] ?? fallback;
}

// MDX to the words a reader sees: no imports, exports, tags, link targets or markdown marks
function plainText(mdx: string): string {
  return mdx
    .split('\n')
    .filter(line => !/^\s*(import|export)\s/.test(line))
    .join('\n')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\{[^}]*\}/g, ' ')
    .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
    .replace(/[`*_|>#]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

// one search entry for the top of each page and one for every h2 and h3, so results can open the right section
function documentsFor(file: DocFile): SearchDocument[] {
  const page = pageTitle(file.source, file.slug || 'Docs');
  const href = `/docs${file.slug ? `/${file.slug}` : ''}`;
  const parts: { title: string; anchor: string; lines: string[] }[] = [{ title: page, anchor: '', lines: [] }];
  for (const line of file.source.split('\n')) {
    const heading = line.match(/^#{2,3}\s+(.+)$/);
    if (heading) parts.push({ title: heading[1].trim(), anchor: slugify(heading[1]), lines: [] });
    else parts[parts.length - 1].lines.push(line);
  }
  return parts.map((part, index) => ({
    id: `${href}#${index}`,
    href: part.anchor ? `${href}#${part.anchor}` : href,
    title: part.title,
    page,
    text: plainText(part.lines.join('\n')),
  }));
}

function pageDescription(source: string): string {
  return source.match(/description:\s*'((?:[^'\\]|\\.)*)'/)?.[1]?.replace(/\\'/g, "'") ?? '';
}

// llms.txt (llmstxt.org): a title, a summary and a link to every docs page, for tools that read the site
function llmsTxt(files: DocFile[]): string {
  const lines = files
    .sort((a, b) => a.slug.localeCompare(b.slug))
    .map(
      file =>
        `- [${pageTitle(file.source, file.slug || 'Docs')}](${SITE_URL}/docs${file.slug ? `/${file.slug}` : ''}): ${pageDescription(file.source)}`,
    );
  const summary =
    'Twiligent puts YouTube, Instagram and Reddit analytics side by side, publishes and schedules Instagram posts, and runs on accounts you own. It is open source under the MIT licence.';
  return `# Twiligent\n\n> ${summary}\n\n## Docs\n\n${lines.join('\n')}\n`;
}

function sitemap(files: DocFile[]): string {
  const paths = [...MARKETING_ROUTES, ...files.map(file => `/docs${file.slug ? `/${file.slug}` : ''}`)];
  const urls = paths.map(path => `  <url><loc>${SITE_URL}${path}</loc></url>`).join('\n');
  return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls}\n</urlset>\n`;
}

// builds the docs search index at build time and writes the sitemap next to the site
export function docsPlugin(contentDir: string): Plugin {
  const root = resolve(contentDir);
  let outDir = 'dist';
  return {
    name: 'twiligent-docs',
    configResolved(config) {
      outDir = resolve(config.root, config.build.outDir);
    },
    resolveId: id => (id === VIRTUAL_ID ? RESOLVED_ID : undefined),
    load(id) {
      if (id !== RESOLVED_ID) return undefined;
      const index = new MiniSearch<SearchDocument>(SEARCH_OPTIONS);
      index.addAll(listDocs(root).flatMap(documentsFor));
      return `export default ${JSON.stringify(JSON.stringify(index))};`;
    },
    handleHotUpdate({ file, server }) {
      if (!file.startsWith(root)) return;
      const module = server.moduleGraph.getModuleById(RESOLVED_ID);
      if (module) server.moduleGraph.invalidateModule(module);
    },
    closeBundle() {
      const files = listDocs(root);
      writeFileSync(join(outDir, 'sitemap.xml'), sitemap(files));
      writeFileSync(join(outDir, 'llms.txt'), llmsTxt(files));
    },
  };
}
