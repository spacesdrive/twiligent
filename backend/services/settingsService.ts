import type { SettingsRepository } from '../repositories/settingsRepository.ts';
import type { AppConfig } from '../lib/config.ts';
import type { GitHubSettingsRequest, GitHubSettingsResponse, KeysStatusResponse } from '../../shared/types/domain.ts';

export interface SettingsDeps {
    settings: SettingsRepository;
    config: AppConfig;
}

export interface SettingsService {
    githubSettings(userId: string): Promise<GitHubSettingsResponse>;
    saveGithubSettings(userId: string, input: GitHubSettingsRequest): Promise<void>;
    serverKeyStatus(): KeysStatusResponse;
}

export function createSettingsService({ settings, config }: SettingsDeps): SettingsService {
    return {
        async githubSettings(userId) {
            const github = ((await settings.getForUser(userId)).github || {}) as GitHubSettingsRequest;
            return { repoOwner: github.repoOwner || '', repoName: github.repoName || '', branch: github.branch || 'main' };
        },

        // rewrites settings.github whole, so a token saved by older versions is dropped
        async saveGithubSettings(userId, { repoOwner, repoName, branch }) {
            const current = await settings.getForUser(userId);
            const github: GitHubSettingsResponse = { repoOwner: repoOwner || '', repoName: repoName || '', branch: branch || 'main' };
            await settings.saveForUser({ ...current, github }, userId);
        },

        // the keys are Worker secrets; this only reports which are set, for the Settings page
        serverKeyStatus() {
            return {
                youtube: { configured: !!config.youtubeApiKey },
                instagram: { configured: !!(config.instagram.appId && config.instagram.appSecret) },
                cloudinary: { configured: config.cloudinary !== null },
            };
        },
    };
}
