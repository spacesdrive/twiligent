// shared by the build plugin that writes the index and the browser code that reads it, so both agree

export interface SearchDocument {
  id: string;
  // the page path, with the heading anchor for a section: docs/self-host/redis#create-a-database
  href: string;
  // the heading, or the page title for the part above the first heading
  title: string;
  page: string;
  text: string;
}

export const SEARCH_OPTIONS = {
  fields: ['title', 'page', 'text'],
  storeFields: ['href', 'title', 'page'],
  searchOptions: { boost: { title: 3, page: 1.5 }, prefix: true, fuzzy: 0.2 },
};

// heading text to an anchor id: lowercase words joined by hyphens
export function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, '')
    .trim()
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-');
}
