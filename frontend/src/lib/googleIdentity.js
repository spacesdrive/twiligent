export const GOOGLE_CLIENT_ID = import.meta.env?.VITE_GOOGLE_CLIENT_ID || '';

const GSI_SRC = 'https://accounts.google.com/gsi/client';
let scriptPromise = null;

// Loads Google Identity Services once per page; later calls reuse the same promise.
export function loadGoogleIdentity() {
  if (typeof window !== 'undefined' && window.google?.accounts?.id) return Promise.resolve(window.google.accounts.id);
  if (!scriptPromise) {
    scriptPromise = new Promise((resolve, reject) => {
      const script = document.createElement('script');
      script.src = GSI_SRC;
      script.async = true;
      script.onload = () => (window.google?.accounts?.id ? resolve(window.google.accounts.id) : reject(new Error('Google sign-in did not start.')));
      script.onerror = () => {
        scriptPromise = null;
        reject(new Error('Google sign-in could not load. Check your connection or any content blocker, then try again.'));
      };
      document.head.appendChild(script);
    });
  }
  return scriptPromise;
}

export async function sha256Hex(text) {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text));
  return Array.from(new Uint8Array(digest), b => b.toString(16).padStart(2, '0')).join('');
}

// supabase checks the raw nonce against the hash in the token, so a captured token cannot replay
export async function createNonce() {
  const bytes = crypto.getRandomValues(new Uint8Array(32));
  const raw = btoa(String.fromCharCode(...bytes)).replace(/[+/=]/g, '');
  return { raw, hashed: await sha256Hex(raw) };
}
