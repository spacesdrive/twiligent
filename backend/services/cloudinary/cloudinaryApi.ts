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

// the runner reads only the instance's own Cloudinary files, so a changed row can never point the Worker elsewhere
function isCloudinaryFile(url: URL): boolean {
    return url.protocol === 'https:' && (url.hostname === 'res.cloudinary.com' || url.hostname.endsWith('.cloudinary.com'));
}

// one part of a stored file, exactly first..last; anything else is an error, since a short part would corrupt the upload
export async function fetchFileRange(fileUrl: string, first: number, last: number, signal?: AbortSignal): Promise<ArrayBuffer> {
    const url = new URL(fileUrl);
    if (!isCloudinaryFile(url)) throw new UpstreamError('The video is not stored on Cloudinary, so it cannot be read in parts.');
    let response: Response;
    try {
        response = await fetch(url, { headers: { Range: `bytes=${first}-${last}` }, signal });
    } catch (err) {
        if (isAbortError(err)) throw new UpstreamTimeoutError('Cloudinary', err);
        throw new UpstreamError(`Cloudinary could not be reached (${(err as Error).message})`, { reason: 'unreachable', cause: err });
    }
    if (response.status === 404) throw new UpstreamError('The video is no longer on Cloudinary. Upload it again.', { status: 404 });
    if (response.status !== 206 && !(response.status === 200 && first === 0)) {
        throw new UpstreamError(`Cloudinary did not return the part of the video asked for (status ${response.status})`, { reason: 'unreachable', status: response.status });
    }
    const part = await response.arrayBuffer();
    const wanted = last - first + 1;
    // a 200 for the first part holds the whole file; anything else must be exactly the range
    if (part.byteLength < wanted) throw new UpstreamError('Cloudinary returned less of the video than asked for', { reason: 'unreachable' });
    return part.byteLength === wanted ? part : part.slice(0, wanted);
}

// a small stored file read whole, such as a thumbnail, with the same Cloudinary-only rule as fetchFileRange
export async function fetchWholeFile(fileUrl: string, maxBytes: number, signal?: AbortSignal): Promise<ArrayBuffer> {
    const url = new URL(fileUrl);
    if (!isCloudinaryFile(url)) throw new UpstreamError('The file is not stored on Cloudinary.');
    let response: Response;
    try {
        response = await fetch(url, { signal });
    } catch (err) {
        if (isAbortError(err)) throw new UpstreamTimeoutError('Cloudinary', err);
        throw new UpstreamError(`Cloudinary could not be reached (${(err as Error).message})`, { reason: 'unreachable', cause: err });
    }
    if (!response.ok) throw new UpstreamError(`Cloudinary could not return the file (status ${response.status})`, { status: response.status });
    const file = await response.arrayBuffer();
    if (file.byteLength > maxBytes) throw new UpstreamError(`The file is larger than ${Math.round(maxBytes / 1024 / 1024)} MB.`);
    return file;
}
