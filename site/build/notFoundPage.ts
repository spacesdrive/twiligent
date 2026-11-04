import { copyFileSync } from 'node:fs';
import { join } from 'node:path';
import type { Plugin, ResolvedConfig } from 'vite';

// Cloudflare Pages answers a path with no file with the top-level 404.html and a real 404 status; that page is the app
// itself, so the router still draws the not found page. The docs routes are rewritten to index.html in _redirects.
export function notFoundPage(): Plugin {
  let outDir = 'dist';
  return {
    name: 'twiligent-not-found-page',
    apply: 'build',
    configResolved(config: ResolvedConfig) {
      outDir = join(config.root, config.build.outDir);
    },
    closeBundle() {
      copyFileSync(join(outDir, 'index.html'), join(outDir, '404.html'));
    },
  };
}
