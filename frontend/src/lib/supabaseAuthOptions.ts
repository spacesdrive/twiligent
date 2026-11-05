// the PKCE flow only takes a sign-in back from a URL when this browser started it (a code plus the verifier it stored);
// the default implicit flow would adopt any #access_token fragment, so a crafted link could sign a person in as someone
// else and make them connect their accounts to that person (audit run 2, N2)
export const SUPABASE_AUTH_OPTIONS = { flowType: 'pkce' } as const;
