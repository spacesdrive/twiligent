import { UpstreamError, UpstreamTimeoutError, isAbortError } from '../../lib/errors.ts';
import type { CloudinaryAdminConfig, CloudinaryConfig } from '../../lib/config.ts';

const CLOUDINARY_API = 'https://api.cloudinary.com/v1_1';

export type MediaResourceType = 'image' | 'video';

// the parts of Cloudinary's upload answer Twiligent keeps
export interface CloudinaryUpload {
    public_id: string;
    secure_url: string;
    resource_type: string;
    format?: string;
    bytes?: number;
    width?: number;
    height?: number;
    duration?: number;
}

interface CloudinaryErrorBody {
    error?: { message?: string };
}

async function post<T>(url: string, body: URLSearchParams, signal?: AbortSignal): Promise<T> {
    let response: Response;
    try {
        response = await fetch(url, { method: 'POST', body, signal });
    } catch (err) {
        if (isAbortError(err)) throw new UpstreamTimeoutError('Cloudinary', err);
        throw new UpstreamError(`Cloudinary could not be reached (${(err as Error).message})`, { reason: 'unreachable', cause: err });
    }
    const data = await response.json().catch(() => ({})) as T & CloudinaryErrorBody;
    if (!response.ok || data.error) throw new UpstreamError(`Cloudinary refused the request: ${data.error?.message ?? `status ${response.status}`}`, { status: response.status });
    return data;
}

// Cloudinary downloads the file itself, so the Worker never fetches an address a caller chose
export function uploadFromUrl(config: CloudinaryConfig, fileUrl: string, resourceType: MediaResourceType, signal?: AbortSignal): Promise<CloudinaryUpload> {
    const body = new URLSearchParams({ file: fileUrl, upload_preset: config.uploadPreset });
    return post<CloudinaryUpload>(`${CLOUDINARY_API}/${config.cloudName}/${resourceType}/upload`, body, signal);
}

// a signature is SHA-1 over the sorted signed parameters followed by the API secret
export async function signParams(params: Record<string, string>, apiSecret: string): Promise<string> {
    const serialized = Object.keys(params).sort().map(name => `${name}=${params[name]}`).join('&');
    const digest = await crypto.subtle.digest('SHA-1', new TextEncoder().encode(`${serialized}${apiSecret}`));
    return [...new Uint8Array(digest)].map(byte => byte.toString(16).padStart(2, '0')).join('');
}

// removes the file from the shared account; 'not found' means it was already gone, which is the same outcome
export async function destroyFile(config: CloudinaryAdminConfig, publicId: string, resourceType: MediaResourceType, signal?: AbortSignal): Promise<void> {
    const params = { public_id: publicId, timestamp: String(Math.floor(Date.now() / 1000)) };
    const body = new URLSearchParams({ ...params, api_key: config.apiKey, signature: await signParams(params, config.apiSecret) });
    const answer = await post<{ result?: string }>(`${CLOUDINARY_API}/${config.cloudName}/${resourceType}/destroy`, body, signal);
    if (answer.result !== 'ok' && answer.result !== 'not found') throw new UpstreamError(`Cloudinary did not delete the file (${answer.result ?? 'no answer'})`);
}
