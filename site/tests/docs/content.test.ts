import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const site = fileURLToPath(new URL('../../', import.meta.url));
const contentDir = join(site, 'content', 'docs');

function mdxFiles(dir: string): string[] {
  return readdirSync(dir).flatMap(name => {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) return mdxFiles(path);
    return name.endsWith('.mdx') ? [path] : [];
  });
}

const pages = new Map(
  mdxFiles(contentDir).map(path => {
    const slug = relative(contentDir, path)
      .split(sep)
      .join('/')
      .replace(/\.mdx$/, '')
      .replace(/(^|\/)index$/, '');
    return [slug, readFileSync(path, 'utf8')] as const;
  }),
);

// nav.ts imports the generated JSX icons, which Node cannot load, so its slugs are read from the source
const navSlugs = [...readFileSync(join(site, 'src', 'docs', 'nav.ts'), 'utf8').matchAll(/slug: '([^']*)'/g)].map(
  match => match[1],
);

test('every page in the navigation has a content file, and every content file is in the navigation', () => {
  assert.deepEqual([...pages.keys()].sort(), [...navSlugs].sort());
});

test('navigation slugs are unique', () => {
  assert.equal(new Set(navSlugs).size, navSlugs.length);
});

test('every page declares a title and a description', () => {
  for (const [slug, source] of pages) {
    assert.match(source, /^export const meta = \{ title: '.+', description: '.+' \}/, `${slug || 'index'}.mdx`);
  }
});

test('every link to another docs page points at a page that exists', () => {
  for (const [slug, source] of pages) {
    for (const match of source.matchAll(/(?:\]\(|href=")\/docs\/?([^)"#\s]*)/g)) {
      assert.ok(pages.has(match[1].replace(/\/$/, '')), `${slug || 'index'}.mdx links to /docs/${match[1]}`);
    }
  }
});

test('pages use no em or en dashes', () => {
  for (const [slug, source] of pages) {
    assert.doesNotMatch(source, /[\u2013\u2014]/, `${slug || 'index'}.mdx`);
  }
});
