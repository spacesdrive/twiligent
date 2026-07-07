import { getSupabaseAuth } from '../lib/supabase.js';

export async function requireAuth(c, next) {
    const token = c.req.header('Authorization')?.replace('Bearer ', '');
    if (!token) return c.json({ error: 'Unauthorized' }, 401);
    const supabaseAuth = getSupabaseAuth(c.env);
    const { data: { user }, error } = await supabaseAuth.auth.getUser(token);
    if (error || !user) return c.json({ error: 'Invalid or expired token' }, 401);
    c.set('userId', user.id);
    c.set('userEmail', user.email);
    await next();
}
