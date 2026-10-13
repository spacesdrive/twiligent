export const GOOGLE_CLIENT_ID: string = import.meta.env?.VITE_GOOGLE_CLIENT_ID || '';

export interface GoogleCredentialResponse {
  credential: string;
  select_by?: string;
}

export interface GoogleIdConfiguration {
  client_id: string;
  callback: (response: GoogleCredentialResponse) => void;
  nonce?: string;
  use_fedcm_for_button?: boolean;
}

export type GoogleButtonText = 'signin_with' | 'signup_with' | 'continue_with' | 'signin';

export interface GoogleButtonConfiguration {
  type?: 'standard' | 'icon';
  theme?: 'outline' | 'filled_blue' | 'filled_black';
  size?: 'large' | 'medium' | 'small';
  shape?: 'rectangular' | 'pill' | 'circle' | 'square';
  text?: GoogleButtonText;
  logo_alignment?: 'left' | 'center';
  width?: number;
}

// the part of google.accounts.id this app calls; Google ships no types package for it
export interface GoogleAccountsId {
  initialize(config: GoogleIdConfiguration): void;
  renderButton(parent: HTMLElement, options: GoogleButtonConfiguration): void;
}

type GoogleWindow = Window & { google?: { accounts?: { id?: GoogleAccountsId } } };

const GSI_SRC = 'https://accounts.google.com/gsi/client';
let scriptPromise: Promise<GoogleAccountsId> | null = null;

// Loads Google Identity Services once per page; later calls reuse the same promise.
export function loadGoogleIdentity(): Promise<GoogleAccountsId> {
  if (typeof window !== 'undefined' && (window as GoogleWindow).google?.accounts?.id) return Promise.resolve((window as GoogleWindow).google!.accounts!.id!);
  if (!scriptPromise) {
    scriptPromise = new Promise<GoogleAccountsId>((resolve, reject) => {
      const script = document.createElement('script');
      script.src = GSI_SRC;
      script.async = true;
      script.onload = () => ((window as GoogleWindow).google?.accounts?.id ? resolve((window as GoogleWindow).google!.accounts!.id!) : reject(new Error('Google sign-in did not start.')));
      script.onerror = () => {
        scriptPromise = null;
        reject(new Error('Google sign-in could not load. Check your connection or any content blocker, then try again.'));
      };
      document.head.appendChild(script);
    });
  }
  return scriptPromise;
}

export async function sha256Hex(text: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text));
  return Array.from(new Uint8Array(digest), b => b.toString(16).padStart(2, '0')).join('');
}

// supabase matches the raw nonce to the token's hash, so a token cannot replay
export async function createNonce(): Promise<{ raw: string; hashed: string }> {
  const bytes = crypto.getRandomValues(new Uint8Array(32));
  const raw = btoa(String.fromCharCode(...bytes)).replace(/[+/=]/g, '');
  return { raw, hashed: await sha256Hex(raw) };
}
