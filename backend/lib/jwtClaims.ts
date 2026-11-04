// reads the claims of a JWT whose signature Supabase Auth has already verified; never use it to trust an unchecked token
export function jwtClaims(token: string): Record<string, unknown> | null {
    const payload = token.split('.')[1];
    if (!payload) return null;
    try {
        const json = new TextDecoder().decode(Uint8Array.from(atob(payload.replace(/-/g, '+').replace(/_/g, '/')), char => char.charCodeAt(0)));
        const claims: unknown = JSON.parse(json);
        return typeof claims === 'object' && claims !== null && !Array.isArray(claims) ? claims as Record<string, unknown> : null;
    } catch {
        // not base64url JSON, so it is not a token Supabase issued
        return null;
    }
}

// OAuth access tokens from Supabase Auth's OAuth server name the client; an app session token has no client_id
export function oauthClientId(claims: Record<string, unknown> | null): string | null {
    const clientId = claims?.client_id;
    return typeof clientId === 'string' && clientId !== '' ? clientId : null;
}
