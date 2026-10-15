// the documentation lives on the public site, not in the app
export const DOCS_URL = 'https://twiligent.ujjwal.fyi/docs';

// a docs page by its path under /docs, such as '/self-host/github'
export function docsUrl(path = ''): string {
  return `${DOCS_URL}${path}`;
}
