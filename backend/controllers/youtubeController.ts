import { controller, pathParam, servicesFor } from './http.ts';
import { jsonBody, queryParams } from '../middleware/validate.ts';
import { requestLogger } from '../middleware/requestContext.ts';
import { parseYouTubeCallback, parseYouTubeComplete, parseYouTubeUpload, parseYouTubeUploadUpdate } from '../validators/youtubeValidators.ts';
import { errorFields } from '../lib/logger.ts';
import type { SuccessResponse } from '../../shared/types/domain.ts';
import type {
    YouTubeAuthUrlResponse, YouTubeConnectCompleteResponse, YouTubeConnectionListResponse, YouTubeUploadListResponse, YouTubeUploadResponse,
} from '../../shared/types/youtubePublishing.ts';

// protected: the signed state carries the user id to the public callback
export const getYouTubeAuthUrl = controller.createHandlers(async c => {
    const url = await servicesFor(c).youtubeConnect.authorizationUrl(c.get('userId'));
    return c.json({ success: true, url } satisfies YouTubeAuthUrlResponse);
});

// public: Google sends the browser here. The state proves the sign-in came from this app but not who opened the link,
// so the code goes back to the app in the fragment and the signed-in person finishes through the complete route
export const handleYouTubeCallback = controller.createHandlers(queryParams(parseYouTubeCallback), async c => {
    const { code, state, error } = c.req.valid('query');
    const connect = servicesFor(c).youtubeConnect;
    if (!connect.configured()) return c.text('YouTube publishing is not set up on this server.', 503);
    const backToAccounts = (query: string) => c.redirect(`${connect.accountsPageUrl()}?${query}`);
    if (error || !code || !state) return backToAccounts(`yt_error=${encodeURIComponent(error || 'cancelled')}`);
    try {
        if (!await connect.stateIsValid(state)) return backToAccounts('yt_error=invalid_state');
    } catch (err) {
        requestLogger(c).error('youtube callback failed', errorFields(err));
        return backToAccounts('yt_error=invalid_state');
    }
    return c.redirect(`${connect.accountsPageUrl()}#yt_code=${encodeURIComponent(code)}&yt_state=${encodeURIComponent(state)}`);
});

// protected: connects the channel only when the sign-in was started by the person now signed in
export const completeYouTubeConnection = controller.createHandlers(jsonBody(parseYouTubeComplete), async c => {
    const { code, state } = c.req.valid('json');
    const { connection, outcome } = await servicesFor(c).youtubeConnect.completeForUser(c.get('userId'), code, state);
    return c.json({ success: true, connection, outcome } satisfies YouTubeConnectCompleteResponse);
});

export const listYouTubeConnections = controller.createHandlers(async c => {
    const connect = servicesFor(c).youtubeConnect;
    return c.json({ success: true, connections: await connect.list(c.get('userId')), configured: connect.configured() } satisfies YouTubeConnectionListResponse);
});

export const deleteYouTubeConnection = controller.createHandlers(async c => {
    await servicesFor(c).youtubeConnect.disconnect(c.get('userId'), pathParam(c, 'id'));
    return c.json({ success: true } satisfies SuccessResponse);
});

export const listYouTubeUploads = controller.createHandlers(async c => {
    return c.json({ success: true, uploads: await servicesFor(c).youtubeUploads.list(c.get('userId')) } satisfies YouTubeUploadListResponse);
});

export const createYouTubeUpload = controller.createHandlers(jsonBody(parseYouTubeUpload), async c => {
    const { upload, existing } = await servicesFor(c).youtubeUploads.create(c.get('userId'), c.req.valid('json'));
    return c.json({ success: true, upload } satisfies YouTubeUploadResponse, existing ? 200 : 201);
});

export const updateYouTubeUpload = controller.createHandlers(jsonBody(parseYouTubeUploadUpdate), async c => {
    const upload = await servicesFor(c).youtubeUploads.update(c.get('userId'), pathParam(c, 'id'), c.req.valid('json'));
    return c.json({ success: true, upload } satisfies YouTubeUploadResponse);
});

export const cancelYouTubeUpload = controller.createHandlers(async c => {
    const upload = await servicesFor(c).youtubeUploads.cancel(c.get('userId'), pathParam(c, 'id'));
    return c.json({ success: true, upload } satisfies YouTubeUploadResponse);
});

export const retryYouTubeUpload = controller.createHandlers(async c => {
    const upload = await servicesFor(c).youtubeUploads.retry(c.get('userId'), pathParam(c, 'id'));
    return c.json({ success: true, upload } satisfies YouTubeUploadResponse);
});
