import path from 'node:path';
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import mdx from '@mdx-js/rollup';
import remarkGfm from 'remark-gfm';
import rehypeShiki from '@shikijs/rehype';
import { docsPlugin } from './build/docsPlugin.ts';

export default defineConfig({
  plugins: [
    // MDX must compile before the React plugin transforms the result
    {
      enforce: 'pre',
      ...mdx({
        providerImportSource: '@mdx-js/react',
        remarkPlugins: [remarkGfm],
        // both themes are written as CSS variables; index.css picks one by data-theme
        rehypePlugins: [[rehypeShiki, { themes: { light: 'github-light', dark: 'github-dark' }, defaultColor: false }]],
      }),
    },
    react({ include: /\.(mdx|tsx|ts)$/ }),
    tailwindcss(),
    docsPlugin(path.resolve(__dirname, 'content/docs')),
  ],
  resolve: {
    alias: { '@': path.resolve(__dirname, './src') },
  },
});
