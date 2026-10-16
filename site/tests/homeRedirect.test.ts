import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';

// the inline script in index.html that runs before the first paint
const html = readFileSync(new URL('../index.html', import.meta.url), 'utf8');
const script = html.match(/<script>\s*(\/\/ the app leaves[\s\S]*?)<\/script>/)?.[1];

function visit(pathname: string, cookie: string): string | null {
  assert.ok(script, 'index.html has the signed-in redirect script');
  let target: string | null = null;
  runInNewContext(script, { document: { cookie }, location: { pathname, replace: (url: string) => (target = url) } });
  return target;
}

test('the home page opens the dashboard for someone signed in to the app', () => {
  assert.equal(visit('/', 'twiligent_signed_in=1'), 'https://app.twiligent.ujjwal.fyi/');
  assert.equal(visit('/', 'twiligent-theme=dark; twiligent_signed_in=1'), 'https://app.twiligent.ujjwal.fyi/');
});

test('the home page stays for everyone else', () => {
  for (const cookie of ['', 'twiligent_signed_in=', 'twiligent_signed_in=0', 'other_twiligent_signed_in=1']) {
    assert.equal(visit('/', cookie), null, cookie);
  }
});

test('docs and other pages stay readable when signed in', () => {
  for (const pathname of ['/docs', '/docs/use/automations', '/privacy']) {
    assert.equal(visit(pathname, 'twiligent_signed_in=1'), null, pathname);
  }
});
