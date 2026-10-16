// signs and builds Instagram webhook notifications the way Meta sends them, for the webhook tests

export async function metaSignature(secret: string, body: ArrayBuffer | string): Promise<string> {
    const bytes = typeof body === 'string' ? new TextEncoder().encode(body) : new Uint8Array(body);
    const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
    const signature = new Uint8Array(await crypto.subtle.sign('HMAC', key, bytes));
    return `sha256=${[...signature].map(byte => byte.toString(16).padStart(2, '0')).join('')}`;
}

export interface CommentChange {
    id: string;
    text?: string;
    fromId?: string;
    fromUsername?: string;
    mediaId?: string;
}

// one notification for one professional account, with a comments change per comment
export function commentNotification(igUserId: string, time: number, changes: CommentChange[]): Record<string, unknown> {
    return {
        object: 'instagram',
        entry: [{
            id: igUserId,
            time,
            changes: changes.map(change => ({
                field: 'comments',
                value: {
                    id: change.id,
                    text: change.text,
                    from: { id: change.fromId ?? `fan-${change.id}`, username: change.fromUsername ?? `fan_${change.id}` },
                    media: { id: change.mediaId ?? '9001', media_product_type: 'REELS' },
                },
            })),
        }],
    };
}
