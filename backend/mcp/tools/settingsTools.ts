import { READ_ONLY, defineTool, noInput } from '../tool.ts';
import { idProperty, objectSchema, requiredId } from '../schemas.ts';
import { parseGithubSettings } from '../../validators/settingsValidators.ts';
import type { GitHubSettingsRequest } from '../../../shared/types/domain.ts';

export const getSettings = defineTool<Record<string, never>>({
    name: 'get_settings',
    title: 'Get settings',
    description: 'Gets the settings Claude can read: which platform keys the server has (never the keys themselves) and the GitHub repository used for the scheduling guide.',
    inputSchema: noInput(),
    annotations: READ_ONLY,
    permission: 'read',
    parse: () => ({}),
    async run(_input, { services, principal }) {
        return { serverKeys: services.settings.serverKeyStatus(), github: await services.settings.githubSettings(principal.userId) };
    },
});

export const updateGithubSettings = defineTool<GitHubSettingsRequest>({
    name: 'update_github_settings',
    title: 'Change the GitHub repository setting',
    description: 'Sets the GitHub repository (owner, name, branch) that the scheduling setup guide links to. It stores no token.',
    inputSchema: objectSchema({
        repoOwner: { type: 'string', maxLength: 100 },
        repoName: { type: 'string', maxLength: 100 },
        branch: { type: 'string', maxLength: 255 },
    }),
    annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: true, openWorldHint: false },
    permission: 'write',
    parse: args => parseGithubSettings(args),
    async run(input, { services, principal }) {
        await services.settings.saveGithubSettings(principal.userId, input);
        return { github: await services.settings.githubSettings(principal.userId) };
    },
});

export const getInstagramPublishingLimit = defineTool<{ accountId: string }>({
    name: 'get_instagram_publishing_limit',
    title: 'Get the Instagram publishing limit',
    description: 'Gets how many posts an Instagram account has published in the last 24 hours and its limit, so Claude can tell whether another post fits.',
    inputSchema: objectSchema({ accountId: idProperty('Instagram account') }, ['accountId']),
    annotations: { ...READ_ONLY, openWorldHint: true },
    permission: 'read',
    parse: args => ({ accountId: requiredId(args, 'accountId', 'Instagram account') }),
    async run({ accountId }, { services, principal }) {
        return { limits: await services.publishing.publishingLimit(principal.userId, accountId) };
    },
});

export const SETTINGS_TOOLS = [getSettings, updateGithubSettings, getInstagramPublishingLimit];
