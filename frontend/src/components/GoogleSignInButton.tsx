import { useEffect, useRef, useState } from 'react';
import { Skeleton } from '@/components/ui/skeleton';
import { GOOGLE_CLIENT_ID, createNonce, googleButtonLabel, loadGoogleIdentity } from '@/lib/googleIdentity';
import type { GoogleButtonConfiguration } from '@/lib/googleIdentity';

// Google renders its own button inside an iframe; its width is capped at 400px by Google.
const MAX_WIDTH = 400;

export interface GoogleSignInButtonProps {
  onCredential: (credential: string, rawNonce: string) => void;
  onError?: (err: Error) => void;
  text?: GoogleButtonConfiguration['text'];
}

// Google's own button cannot take the app's style (in dark mode it puts the G on a white square), so the app draws
// an outline button and lays Google's real button over it, nearly transparent: clicks, keyboard focus and the
// sign-in itself stay Google's, and hover and focus show on the button underneath
export default function GoogleSignInButton({ onCredential, onError, text = 'continue_with' }: GoogleSignInButtonProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const handlers = useRef({ onCredential, onError });
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
          theme: 'outline',
          size: 'large',
          shape: 'rectangular',
          text,
          logo_alignment: 'center',
          width: Math.min(containerRef.current.offsetWidth || MAX_WIDTH, MAX_WIDTH),
        });
        setReady(true);
      } catch (err) {
        if (!cancelled) handlers.current.onError?.(err as Error);
      }
    })();

    return () => { cancelled = true; };
  }, [text]);

  if (!GOOGLE_CLIENT_ID) return null;

  return (
    <div className="group relative h-(--control-h-lg) w-full">
      <span
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 flex items-center justify-center gap-2.5 rounded-control border border-line-control bg-surface-raised text-sm font-medium text-ink shadow-sm transition-colors duration-(--duration-base) group-hover:bg-surface-hover group-has-[iframe:focus]:ring-3 group-has-[iframe:focus]:ring-ring/50"
      >
        <img src="/icons/google-g.svg" alt="" className="size-4.5" draggable={false} />
        {googleButtonLabel(text)}
      </span>
      {!ready && <Skeleton className="absolute inset-0 rounded-control" />}
      <div ref={containerRef} className="absolute inset-0 flex justify-center overflow-hidden opacity-[0.01] [color-scheme:normal]" />
    </div>
  );
}
