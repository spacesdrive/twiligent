// contact for access and scheduling help; self-hosters set VITE_ADMIN_EMAIL
export const ADMIN_EMAIL = import.meta.env?.VITE_ADMIN_EMAIL || 'ujjwal@aevrin.net';

export function adminMailto(subject, body = '') {
  const params = new URLSearchParams({ subject });
  if (body) params.set('body', body);
  // URLSearchParams encodes spaces as "+", which mail clients show literally
  return `mailto:${ADMIN_EMAIL}?${params.toString().replace(/\+/g, '%20')}`;
}

export const INSTAGRAM_TESTER_INVITES_URL = 'https://www.instagram.com/accounts/manage_access/';
