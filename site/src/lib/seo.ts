import { useEffect } from 'react';

const SITE_URL = 'https://twiligent.ujjwal.fyi';
const SITE_NAME = 'Twiligent';
const SHARE_IMAGE = `${SITE_URL}/brand/twiligent-og.png`;

export interface PageMeta {
  title: string;
  description: string;
  // the path without the domain, such as /docs/self-host
  path: string;
}

function setMeta(attribute: 'name' | 'property', key: string, content: string) {
  let tag = document.head.querySelector<HTMLMetaElement>(`meta[${attribute}="${key}"]`);
  if (!tag) {
    tag = document.createElement('meta');
    tag.setAttribute(attribute, key);
    document.head.appendChild(tag);
  }
  tag.content = content;
}

function setCanonical(href: string) {
  let link = document.head.querySelector<HTMLLinkElement>('link[rel="canonical"]');
  if (!link) {
    link = document.createElement('link');
    link.rel = 'canonical';
    document.head.appendChild(link);
  }
  link.href = href;
}

// title, description, canonical URL and the Open Graph and Twitter tags for the page on screen
export function usePageMeta({ title, description, path }: PageMeta): void {
  useEffect(() => {
    const fullTitle = title === SITE_NAME ? title : `${title} | ${SITE_NAME}`;
    const url = `${SITE_URL}${path}`;
    document.title = fullTitle;
    setMeta('name', 'description', description);
    setCanonical(url);
    setMeta('property', 'og:type', 'website');
    setMeta('property', 'og:site_name', SITE_NAME);
    setMeta('property', 'og:title', fullTitle);
    setMeta('property', 'og:description', description);
    setMeta('property', 'og:url', url);
    setMeta('property', 'og:image', SHARE_IMAGE);
    setMeta('name', 'twitter:card', 'summary_large_image');
    setMeta('name', 'twitter:title', fullTitle);
    setMeta('name', 'twitter:description', description);
    setMeta('name', 'twitter:image', SHARE_IMAGE);
  }, [title, description, path]);
}
