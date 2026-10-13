import { optionalString } from './fields.ts';
import type { Fields } from './fields.ts';
import type { GitHubSettingsRequest } from '../../shared/types/domain.ts';

export function parseGithubSettings(body: Fields): GitHubSettingsRequest {
    return {
        repoOwner: optionalString(body, 'repoOwner'),
        repoName: optionalString(body, 'repoName'),
        branch: optionalString(body, 'branch'),
    };
}
