import { UpstreamError, UpstreamTimeoutError, isAbortError } from '../../lib/errors.ts';
import { createOAuthState } from '../../lib/oauthState.ts';
import type { YouTubeOAuthConfig } from '../../lib/config.ts';
import type { YouTubePrivacy } from '../../../shared/types/youtubePublishing.ts';

const AUTHORIZE_URL = 'https://accounts.google.com/o/oauth2/v2/auth';
const TOKEN_URL = 'https://oauth2.googleapis.com/token';
const REVOKE_URL = 'https://oauth2.googleapis.com/revoke';
const API = 'https://www.googleapis.com/youtube/v3';
const UPLOAD_API = 'https://www.googleapis.com/upload/youtube/v3';

// upload videos and read the channel; nothing that can change or delete what is already on it
export const YOUTUBE_SCOPES = ['https://www.googleapis.com/auth/youtube.upload', 'https://www.googleapis.com/auth/youtube.readonly'];

// Google's answer when a call is refused; the reason decides retry, wait or reconnect
export class GoogleApiError extends UpstreamError {
    readonly httpStatus: number;
    readonly googleReason: string;

    constructor(message: string, httpStatus: number, googleReason: string) {
        super(message, { reason: googleReason, status: httpStatus });
        this.httpStatus = httpStatus;
        this.googleReason = googleReason;
    }
}

interface GoogleErrorBody {
    error?: string | { code?: number; message?: string; errors?: { reason?: string }[] };
    error_description?: string;
}

async function googleError(response: Response, what: string): Promise<GoogleApiError> {
    const body = await response.json().catch(() => ({})) as GoogleErrorBody;
    if (typeof body.error === 'string') {
        return new GoogleApiError(`Google refused ${what}: ${body.error_description ?? body.error}`, response.status, body.error);
    }
    const reason = body.error?.errors?.[0]?.reason ?? '';
    return new GoogleApiError(`YouTube refused ${what}: ${body.error?.message ?? `status ${response.status}`}`, response.status, reason);
}

async function send(url: string, init: RequestInit, what: string): Promise<Response> {
    try {
        return await fetch(url, init);
    } catch (err) {
        if (isAbortError(err)) throw new UpstreamTimeoutError('YouTube', err);
        throw new UpstreamError(`YouTube could not be reached while ${what} (${(err as Error).message})`, { reason: 'unreachable', cause: err });
    }
}

// the signed state names the person who started, so only they can finish the connection
export async function authorizationUrl(config: YouTubeOAuthConfig, userId: string): Promise<string> {
    const params = new URLSearchParams({
        client_id: config.clientId,
        redirect_uri: config.redirectUri,
        response_type: 'code',
        scope: YOUTUBE_SCOPES.join(' '),
        // offline and consent make Google return a refresh token every time, so a reconnect always gets one
        access_type: 'offline',
        prompt: 'consent',
        include_granted_scopes: 'true',
        state: await createOAuthState(userId, config.clientSecret),
    });
    return `${AUTHORIZE_URL}?${params}`;
}

export interface GoogleTokens {
    accessToken: string;
    refreshToken: string | null;
    expiresAt: string;
    scopes: string[];
}

interface TokenAnswer {
    access_token: string;
    refresh_token?: string;
    expires_in: number;
    scope?: string;
}

async function tokenRequest(params: Record<string, string>, what: string, signal?: AbortSignal): Promise<GoogleTokens> {
    const response = await send(TOKEN_URL, { method: 'POST', body: new URLSearchParams(params), signal }, what);
    if (!response.ok) throw await googleError(response, what);
    const answer = await response.json() as TokenAnswer;
    return {
        accessToken: answer.access_token,
        refreshToken: answer.refresh_token ?? null,
        expiresAt: new Date(Date.now() + answer.expires_in * 1000).toISOString(),
        scopes: (answer.scope ?? '').split(' ').filter(Boolean),
    };
}

export function exchangeCode(config: YouTubeOAuthConfig, code: string, signal?: AbortSignal): Promise<GoogleTokens> {
    return tokenRequest({
        code, client_id: config.clientId, client_secret: config.clientSecret, redirect_uri: config.redirectUri, grant_type: 'authorization_code',
    }, 'the sign-in code', signal);
}

export function refreshAccessToken(config: YouTubeOAuthConfig, refreshToken: string, signal?: AbortSignal): Promise<GoogleTokens> {
    return tokenRequest({
        refresh_token: refreshToken, client_id: config.clientId, client_secret: config.clientSecret, grant_type: 'refresh_token',
    }, 'the token refresh', signal);
}

// best effort: a token Google already dropped is the same outcome
export async function revokeToken(token: string, signal?: AbortSignal): Promise<void> {
    await send(REVOKE_URL, { method: 'POST', body: new URLSearchParams({ token }), signal }, 'revoking access').catch(() => undefined);
}

export interface GoogleChannel {
    id: string;
    title: string;
}

export async function fetchMyChannel(accessToken: string, signal?: AbortSignal): Promise<GoogleChannel> {
    const response = await send(`${API}/channels?part=snippet&mine=true`, { headers: { Authorization: `Bearer ${accessToken}` }, signal }, 'reading the channel');
    if (!response.ok) throw await googleError(response, 'reading the channel');
    const answer = await response.json() as { items?: { id: string; snippet?: { title?: string } }[] };
    const channel = answer.items?.[0];
    if (!channel) throw new GoogleApiError('This Google account has no YouTube channel. Create one on YouTube, then connect again.', 404, 'noChannel');
    return { id: channel.id, title: channel.snippet?.title ?? '' };
}

export interface VideoInsert {
    title: string;
    description: string;
    tags: string[];
    categoryId: string;
    privacy: YouTubePrivacy;
    publishAt: string | null;
    madeForKids: boolean;
    syntheticMedia: boolean;
    notifySubscribers: boolean;
}

// opens a resumable session; Google answers with the session address in Location, which the caller saves before sending bytes
export async function startUploadSession(accessToken: string, video: VideoInsert, bytes: number, contentType: string, signal?: AbortSignal): Promise<string> {
    const url = `${UPLOAD_API}/videos?uploadType=resumable&part=snippet,status&notifySubscribers=${video.notifySubscribers}`;
    const body = {
        snippet: { title: video.title, description: video.description, tags: video.tags, categoryId: video.categoryId },
        status: {
            privacyStatus: video.privacy,
            ...(video.publishAt ? { publishAt: video.publishAt } : {}),
            selfDeclaredMadeForKids: video.madeForKids,
            containsSyntheticMedia: video.syntheticMedia,
        },
    };
    const response = await send(url, {
        method: 'POST',
        headers: {
            Authorization: `Bearer ${accessToken}`,
            'Content-Type': 'application/json; charset=UTF-8',
            'X-Upload-Content-Length': String(bytes),
            'X-Upload-Content-Type': contentType,
        },
        body: JSON.stringify(body),
        signal,
    }, 'starting the upload');
    if (!response.ok) throw await googleError(response, 'starting the upload');
    const session = response.headers.get('Location');
    if (!session?.startsWith('https://')) throw new GoogleApiError('YouTube did not return an upload address.', 502, 'noSession');
    return session;
}

export type SessionStatus = { kind: 'incomplete'; range: string | null } | { kind: 'done'; videoId: string };

async function sessionAnswer(response: Response, what: string): Promise<SessionStatus> {
    if (response.status === 308) return { kind: 'incomplete', range: response.headers.get('Range') };
    if (response.status === 200 || response.status === 201) {
        const video = await response.json() as { id?: string };
        if (!video.id) throw new GoogleApiError('YouTube finished the upload without a video id.', 502, 'noVideoId');
        return { kind: 'done', videoId: video.id };
    }
    throw await googleError(response, what);
}

// asks how much of the file Google holds; the answer is the truth after any lost response
export async function querySession(accessToken: string, session: string, total: number, signal?: AbortSignal): Promise<SessionStatus> {
    const response = await send(session, {
        method: 'PUT',
        headers: { Authorization: `Bearer ${accessToken}`, 'Content-Length': '0', 'Content-Range': `bytes */${total}` },
        signal,
    }, 'checking the upload');
    return sessionAnswer(response, 'checking the upload');
}

export async function sendChunk(accessToken: string, session: string, chunk: ArrayBuffer, first: number, total: number, signal?: AbortSignal): Promise<SessionStatus> {
    const last = first + chunk.byteLength - 1;
    const response = await send(session, {
        method: 'PUT',
        headers: { Authorization: `Bearer ${accessToken}`, 'Content-Length': String(chunk.byteLength), 'Content-Range': `bytes ${first}-${last}/${total}` },
        body: chunk,
        signal,
    }, 'sending part of the video');
    return sessionAnswer(response, 'sending part of the video');
}

export interface VideoProcessing {
    id: string;
    uploadStatus: string;
    failureReason: string | null;
    processingStatus: string | null;
}

export async function videoStatus(accessToken: string, videoId: string, signal?: AbortSignal): Promise<VideoProcessing | null> {
    const response = await send(`${API}/videos?part=status,processingDetails&id=${encodeURIComponent(videoId)}`, { headers: { Authorization: `Bearer ${accessToken}` }, signal }, 'checking the video');
    if (!response.ok) throw await googleError(response, 'checking the video');
    const answer = await response.json() as { items?: { id: string; status?: { uploadStatus?: string; failureReason?: string; rejectionReason?: string }; processingDetails?: { processingStatus?: string } }[] };
    const video = answer.items?.[0];
    if (!video) return null;
    return {
        id: video.id,
        uploadStatus: video.status?.uploadStatus ?? 'uploaded',
        failureReason: video.status?.failureReason ?? video.status?.rejectionReason ?? null,
        processingStatus: video.processingDetails?.processingStatus ?? null,
    };
}

export async function setThumbnail(accessToken: string, videoId: string, image: ArrayBuffer, contentType: string, signal?: AbortSignal): Promise<void> {
    const response = await send(`${UPLOAD_API}/thumbnails/set?videoId=${encodeURIComponent(videoId)}`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': contentType, 'Content-Length': String(image.byteLength) },
        body: image,
        signal,
    }, 'setting the thumbnail');
    if (!response.ok) throw await googleError(response, 'setting the thumbnail');
}
