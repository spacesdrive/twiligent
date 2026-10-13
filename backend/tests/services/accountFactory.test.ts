import { test, describe, before, after, beforeEach, afterEach, mock } from 'node:test';
import assert from 'node:assert/strict';
import {
    newAccountId, tokenExpiryIso, buildYouTubeAccount, buildRedditAccount, buildInstagramAccount,
} from '../../services/accountFactory.ts';

const FIXED_NOW = Date.parse('2026-09-01T12:00:00Z');
const NOW_ISO = '2026-09-01T12:00:00.000Z';
const ACCOUNT_ID = '17882640000004fzz';

describe('accountFactory', () => {
    before(() => mock.timers.enable({ apis: ['Date'], now: FIXED_NOW }));
    after(() => mock.timers.reset());
    beforeEach(() => mock.method(Math, 'random', () => 0.123456789));
    afterEach(() => mock.restoreAll());

    test('newAccountId joins the time and four random base 36 characters', () => {
        assert.equal(newAccountId(), ACCOUNT_ID);
    });

    test('tokenExpiryIso adds seconds to now, or returns null without a lifetime', () => {
        assert.equal(tokenExpiryIso(3600), '2026-09-01T13:00:00.000Z');
        assert.equal(tokenExpiryIso(0), null);
        assert.equal(tokenExpiryIso(undefined), null);
    });

    test('buildYouTubeAccount copies the channel fields in a fixed order', () => {
        const channelData = {
            channelId: 'UC1', title: 'T', description: 'D', customUrl: '@c', publishedAt: 'P', country: 'GB',
            thumbnails: { default: 'd' }, subscriberCount: 1, viewCount: 2, videoCount: 3, hiddenSubscriberCount: false,
            uploadsPlaylistId: 'UU1', keywords: 'k', topicCategories: ['t'], madeForKids: false, bannerUrl: 'ignored',
        };
        const account = buildYouTubeAccount(channelData);
        assert.deepStrictEqual(Object.keys(account), [
            'id', 'channelId', 'title', 'description', 'customUrl', 'publishedAt', 'country', 'thumbnails',
            'subscriberCount', 'viewCount', 'videoCount', 'hiddenSubscriberCount', 'uploadsPlaylistId', 'keywords',
            'topicCategories', 'madeForKids', 'addedAt', 'lastUpdated',
        ]);
        assert.equal(account.id, ACCOUNT_ID);
        assert.equal(account.addedAt, NOW_ISO);
        assert.equal(account.lastUpdated, NOW_ISO);
    });

    test('buildRedditAccount keeps the cookie and prefixes the title', () => {
        const profile = { username: 'ribbon', totalKarma: 3, postKarma: 2, commentKarma: 1, iconUrl: 'i', createdAt: 'c', isGold: true };
        assert.deepStrictEqual(buildRedditAccount(profile, 'COOKIE'), {
            id: ACCOUNT_ID, platform: 'reddit', username: 'ribbon', title: 'u/ribbon',
            totalKarma: 3, postKarma: 2, commentKarma: 1, iconUrl: 'i', createdAt: 'c', cookie: 'COOKIE',
            addedAt: NOW_ISO, lastUpdated: NOW_ISO,
        });
    });

    test('buildInstagramAccount falls back to the username as title and sets the expiry', () => {
        const profile = {
            igUserId: '9', username: 'ribbon', name: '', biography: 'b', website: 'w', profilePictureUrl: 'p',
            followersCount: 5, followsCount: 6, mediaCount: 7,
        };
        const account = buildInstagramAccount(profile, 'TOKEN', 60);
        assert.deepStrictEqual(account, {
            id: ACCOUNT_ID, platform: 'instagram', igUserId: '9', username: 'ribbon', title: 'ribbon',
            biography: 'b', website: 'w', profilePictureUrl: 'p', followersCount: 5, followsCount: 6, mediaCount: 7,
            accessToken: 'TOKEN', tokenExpiresAt: '2026-09-01T12:01:00.000Z', addedAt: NOW_ISO, lastUpdated: NOW_ISO,
        });
        assert.deepStrictEqual(Object.keys(account), Object.keys(buildInstagramAccount(profile, 'TOKEN', 0)));
        assert.equal(buildInstagramAccount({ ...profile, name: 'Ribbon' }, 'TOKEN', 0).tokenExpiresAt, null);
    });
});
