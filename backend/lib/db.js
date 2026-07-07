// All functions accept `supabase` as first argument so they work both in
// request handlers (where supabase comes from context) and in cron handlers
// (where supabase is created from env). userId=null means service-level
// (no user filter) - used by the scheduler and token refresh cron.

// ── Accounts ──────────────────────────────────────────────────────────────────

export async function getAccounts(supabase, userId = null) {
    let q = supabase.from('accounts').select('id, platform, data');
    if (userId) q = q.eq('user_id', userId);
    const { data, error } = await q;
    if (error) throw error;
    return (data || []).map(row => ({ id: row.id, platform: row.platform, ...row.data }));
}

export async function getAccountById(supabase, id, userId = null) {
    let q = supabase.from('accounts').select('id, platform, data').eq('id', id);
    if (userId) q = q.eq('user_id', userId);
    const { data, error } = await q.single();
    if (error || !data) return null;
    return { id: data.id, platform: data.platform, ...data.data };
}

export async function createAccount(supabase, account, userId) {
    const { id, platform, ...rest } = account;
    const { error } = await supabase
        .from('accounts')
        .insert({ id, user_id: userId, platform: platform || 'youtube', data: rest });
    if (error) throw error;
}

export async function updateAccount(supabase, id, updates, userId = null) {
    const current = await getAccountById(supabase, id, userId);
    if (!current) throw new Error('Account not found: ' + id);
    const { id: _, platform: currentPlatform, ...currentData } = current;
    const { platform: newPlatform, ...dataUpdates } = updates;
    let q = supabase.from('accounts').update({
        platform: newPlatform || currentPlatform,
        data: { ...currentData, ...dataUpdates },
    }).eq('id', id);
    if (userId) q = q.eq('user_id', userId);
    const { error } = await q;
    if (error) throw error;
}

export async function deleteAccount(supabase, id, userId = null) {
    let q = supabase.from('accounts').delete().eq('id', id);
    if (userId) q = q.eq('user_id', userId);
    const { error } = await q;
    if (error) throw error;
}

// ── Settings (API Keys) ───────────────────────────────────────────────────────
// Table: settings (user_id uuid, key text, value jsonb) - PK is (user_id, key)

const DEFAULT_KEYS = {};

export async function getSettings(supabase, userId) {
    const { data, error } = await supabase
        .from('settings')
        .select('value')
        .eq('key', 'api_keys')
        .eq('user_id', userId)
        .single();
    if (error || !data) return { ...DEFAULT_KEYS };
    return { ...DEFAULT_KEYS, ...data.value };
}

export async function saveSettings(supabase, keys, userId) {
    const { error } = await supabase
        .from('settings')
        .upsert({ user_id: userId, key: 'api_keys', value: keys }, { onConflict: 'user_id,key' });
    if (error) throw error;
}

// ── Scheduled Posts ───────────────────────────────────────────────────────────

function rowToPost(row) {
    return {
        id: row.id,
        accountId: row.account_id,
        status: row.status,
        scheduledAt: row.scheduled_at,
        ...(row.data || {}),
    };
}

export async function getPosts(supabase, userId) {
    let q = supabase
        .from('scheduled_posts')
        .select('id, account_id, status, scheduled_at, data')
        .order('scheduled_at', { ascending: true });
    if (userId) q = q.eq('user_id', userId);
    const { data, error } = await q;
    if (error) throw error;
    return (data || []).map(rowToPost);
}

export async function getPostById(supabase, id, userId = null) {
    let q = supabase
        .from('scheduled_posts')
        .select('id, account_id, status, scheduled_at, data')
        .eq('id', id);
    if (userId) q = q.eq('user_id', userId);
    const { data, error } = await q.single();
    if (error || !data) return null;
    return rowToPost(data);
}

export async function getDuePosts(supabase) {
    const { data, error } = await supabase
        .from('scheduled_posts')
        .select('id, account_id, status, scheduled_at, data')
        .eq('status', 'pending')
        .lte('scheduled_at', new Date().toISOString());
    if (error) throw error;
    return (data || []).map(rowToPost);
}

export async function createPost(supabase, post, userId) {
    const { id, accountId, status, scheduledAt, ...rest } = post;
    const { error } = await supabase.from('scheduled_posts').insert({
        id,
        user_id: userId,
        account_id: accountId,
        status: status || 'pending',
        scheduled_at: scheduledAt,
        data: rest,
    });
    if (error) throw error;
}

export async function updatePost(supabase, id, updates, userId = null) {
    const { status, scheduledAt, accountId: _, ...dataUpdates } = updates;
    const colUpdates = {};

    if (status !== undefined) colUpdates.status = status;
    if (scheduledAt !== undefined) colUpdates.scheduled_at = scheduledAt;

    if (Object.keys(dataUpdates).length > 0) {
        let q = supabase.from('scheduled_posts').select('data').eq('id', id);
        if (userId) q = q.eq('user_id', userId);
        const { data: rows } = await q;
        const currentData = rows?.[0]?.data || {};
        colUpdates.data = { ...currentData, ...dataUpdates };
    }

    let q = supabase.from('scheduled_posts').update(colUpdates).eq('id', id);
    if (userId) q = q.eq('user_id', userId);
    const { error } = await q;
    if (error) throw error;
}

export async function deletePost(supabase, id, userId = null) {
    let q = supabase.from('scheduled_posts').delete().eq('id', id);
    if (userId) q = q.eq('user_id', userId);
    const { error } = await q;
    if (error) throw error;
}

export async function deleteAllPosts(supabase, userId) {
    let countQ = supabase.from('scheduled_posts').select('*', { count: 'exact', head: true });
    let keepQ = supabase.from('scheduled_posts').select('*', { count: 'exact', head: true }).eq('status', 'publishing');
    let delQ = supabase.from('scheduled_posts').delete().neq('status', 'publishing');

    if (userId) {
        countQ = countQ.eq('user_id', userId);
        keepQ = keepQ.eq('user_id', userId);
        delQ = delQ.eq('user_id', userId);
    }

    const { count: total } = await countQ;
    const { count: keeping } = await keepQ;
    const { error } = await delQ;
    if (error) throw error;
    return { deleted: (total || 0) - (keeping || 0), kept: keeping || 0 };
}
