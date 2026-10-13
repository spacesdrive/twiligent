import { controller, servicesFor } from './http.ts';
import { jsonBody } from '../middleware/validate.ts';
import { parseGithubSettings } from '../validators/settingsValidators.ts';
import type { GitHubSettingsResponse, KeysStatusResponse, SuccessResponse } from '../../shared/types/domain.ts';

export const getGithubSettings = controller.createHandlers(async c => {
    const settings = await servicesFor(c).settings.githubSettings(c.get('userId'));
    return c.json(settings satisfies GitHubSettingsResponse);
});

export const saveGithubSettings = controller.createHandlers(jsonBody(parseGithubSettings), async c => {
    await servicesFor(c).settings.saveGithubSettings(c.get('userId'), c.req.valid('json'));
    return c.json({ success: true } satisfies SuccessResponse);
});

export const getKeyStatus = controller.createHandlers(c => {
    return c.json(servicesFor(c).settings.serverKeyStatus() satisfies KeysStatusResponse);
});
