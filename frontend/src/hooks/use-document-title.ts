import { useEffect } from 'react';
import { documentTitle } from '@/layout/routes';

// a detail page names its tab after what it shows (a channel, an account, a category); the app shell sets the
// route's own title in a layout effect first, and this passive effect runs after it, so the page's name wins
export function useDocumentTitle(pageTitle: string | null | undefined): void {
  useEffect(() => {
    if (pageTitle) document.title = documentTitle(pageTitle);
  }, [pageTitle]);
}
