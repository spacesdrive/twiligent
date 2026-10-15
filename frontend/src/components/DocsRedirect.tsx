import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { docsUrl } from '../lib/docs';

// old links to the app's /docs pages land on the same page of the public docs
export default function DocsRedirect() {
  const { pathname, hash } = useLocation();
  useEffect(() => {
    window.location.replace(docsUrl(pathname.replace(/^\/docs/, '') + hash));
  }, [pathname, hash]);
  return null;
}
