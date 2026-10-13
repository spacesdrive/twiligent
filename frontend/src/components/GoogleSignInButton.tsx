import { useEffect, useRef, useState } from 'react';
import { useTheme } from 'next-themes';
import { Skeleton } from '@/components/ui/skeleton';
import { GOOGLE_CLIENT_ID, createNonce, loadGoogleIdentity } from '@/lib/googleIdentity';

// Google renders its own button inside an iframe; its width is capped at 400px by Google.
const MAX_WIDTH = 400;

export default function GoogleSignInButton({ onCredential, onError, text = 'continue_with' }) {
  const containerRef = useRef(null);
  const handlers = useRef({ onCredential, onError });
  const { resolvedTheme } = useTheme();
  const [ready, setReady] = useState(false);

  useEffect(() => {
    handlers.current = { onCredential, onError };
  }, [onCredential, onError]);

  useEffect(() => {
    if (!GOOGLE_CLIENT_ID) return undefined;
    let cancelled = false;

    (async () => {
      try {
        const [gsi, nonce] = await Promise.all([loadGoogleIdentity(), createNonce()]);
        if (cancelled || !containerRef.current) return;
        gsi.initialize({
          client_id: GOOGLE_CLIENT_ID,
          nonce: nonce.hashed,
          use_fedcm_for_button: true,
          callback: response => handlers.current.onCredential(response.credential, nonce.raw),
        });
        containerRef.current.replaceChildren();
        gsi.renderButton(containerRef.current, {
          type: 'standard',
          theme: resolvedTheme === 'dark' ? 'filled_black' : 'outline',
          size: 'large',
          shape: 'rectangular',
          text,
          logo_alignment: 'center',
          width: Math.min(containerRef.current.offsetWidth || MAX_WIDTH, MAX_WIDTH),
        });
        setReady(true);
      } catch (err) {
        if (!cancelled) handlers.current.onError?.(err);
      }
    })();

    return () => { cancelled = true; };
  }, [resolvedTheme, text]);

  if (!GOOGLE_CLIENT_ID) return null;

  return (
    <div className="relative min-h-10 w-full">
      {!ready && <Skeleton className="absolute inset-0 h-10 rounded-control" />}
      <div ref={containerRef} className="flex w-full justify-center [color-scheme:normal]" />
    </div>
  );
}
