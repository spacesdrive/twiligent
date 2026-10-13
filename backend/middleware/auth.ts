import type { Next } from 'hono';
import { getSupabaseAuth } from '../database/supabase.ts';
import { UnauthorizedError } from '../lib/errors.ts';
import type { AppContext } from '../types/app.ts';

const BEARER = /^Bearer\s+(\S+)$/i;

// the only source of identity: the user id comes from the verified JWT, never from the request body or query
export async function requireAuth(c: AppContext, next: Next): Promise<void> {
    const token = c.req.header('Authorization')?.match(BEARER)?.[1];
    if (!token) throw new UnauthorizedError('Sign in to use the API');
    const { data: { user }, error } = await getSupabaseAuth(c.env).auth.getUser(token);
    if (error || !user) throw new UnauthorizedError('Your session has expired - sign in again');
    c.set('userId', user.id);
    c.set('userEmail', user.email);
    await next();
}
