import { controller, pathParam, servicesFor } from './http.ts';
import { jsonBody } from '../middleware/validate.ts';
import { parseChannelInput, parseInstagramToken, parseRedditAccount } from '../validators/accountValidators.ts';
import { safeAccount } from '../lib/safeAccount.ts';
import type {
    AccountListResponse, AccountRefreshAllResponse, AccountResponse, SuccessResponse, YouTubeAccountAddResponse,
} from '../../shared/types/domain.ts';
import type { ResolveChannelResponse } from '../../shared/types/youtube.ts';
import type { InstagramTokenRefreshResponse } from '../../shared/types/instagram.ts';

// stored credentials never leave the Worker: every account in a response goes through safeAccount()

export const listAccounts = controller.createHandlers(async c => {
    const accounts = await servicesFor(c).accounts.list(c.get('userId'));
    return c.json(accounts.map(safeAccount) satisfies AccountListResponse);
});

export const resolveChannel = controller.createHandlers(jsonBody(parseChannelInput), async c => {
    const data = await servicesFor(c).accounts.resolveChannel(c.req.valid('json').input);
    return c.json({ success: true, data } satisfies ResolveChannelResponse);
});

export const addYouTubeAccount = controller.createHandlers(jsonBody(parseChannelInput), async c => {
    const account = await servicesFor(c).accounts.addYouTube(c.get('userId'), c.req.valid('json').input);
    return c.json({ success: true, account } satisfies YouTubeAccountAddResponse);
});

export const addRedditAccount = controller.createHandlers(jsonBody(parseRedditAccount), async c => {
    const account = await servicesFor(c).accounts.addReddit(c.get('userId'), c.req.valid('json'));
    return c.json({ success: true, account: safeAccount(account) } satisfies AccountResponse);
});

export const addInstagramAccount = controller.createHandlers(jsonBody(parseInstagramToken), async c => {
    const account = await servicesFor(c).accounts.addInstagram(c.get('userId'), c.req.valid('json').accessToken);
    return c.json({ success: true, account: safeAccount(account) } satisfies AccountResponse);
});

export const refreshAllAccounts = controller.createHandlers(async c => {
    const { accounts, results } = await servicesFor(c).accounts.refreshAll(c.get('userId'));
    return c.json({
        success: true,
        accounts: accounts.map(safeAccount),
        results,
        updatedAt: new Date().toISOString(),
    } satisfies AccountRefreshAllResponse);
});

export const refreshAccount = controller.createHandlers(async c => {
    const account = await servicesFor(c).accounts.refresh(c.get('userId'), pathParam(c, 'id'));
    return c.json({ success: true, account: safeAccount(account) } satisfies AccountResponse);
});

export const refreshInstagramToken = controller.createHandlers(async c => {
    const expiresAt = await servicesFor(c).accounts.refreshInstagramToken(c.get('userId'), pathParam(c, 'id'));
    return c.json({ success: true, message: 'Token refreshed for another 60 days', expiresAt } satisfies InstagramTokenRefreshResponse);
});

export const deleteAccount = controller.createHandlers(async c => {
    await servicesFor(c).accounts.remove(c.get('userId'), pathParam(c, 'id'));
    return c.json({ success: true } satisfies SuccessResponse);
});
