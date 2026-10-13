import { test, describe, before, after, afterEach, mock } from 'node:test';
import { fetchRedditProfile, fetchRedditPosts, fetchTrackedPostData, autoRefreshRedditSessions } from '../../services/reddit.ts';
import { assertGolden } from '../fixtures/golden.ts';
import { installFetch, reply } from '../fixtures/fakeFetch.ts';
import { FIXED_NOW, rawRedditPosts } from '../fixtures/redditFixtures.ts';

let fetchMock = null;
afterEach(() => fetchMock?.restore());

async function outcomeOf(promise) {
    try {
        return { value: await promise };
    } catch (err) {
        return { error: err.message };
    }
}

function listing(children, after = null) {
    return reply({ data: { children: children.map(data => ({ data })), after } });
}

describe('reddit api golden output', () => {
    before(() => mock.timers.enable({ apis: ['Date'], now: FIXED_NOW }));
    after(() => mock.timers.reset());

    test('maps a profile with and without optional fields', async () => {
        const bodies = [
            { data: { name: 'ribbon', total_karma: 900, link_karma: 600, comment_karma: 300, awardee_karma: 5, awarder_karma: 2, icon_img: 'https://i/a.png?x=1&amp;y=2', created_utc: 1600000000, is_gold: true, is_mod: true, verified: true } },
            { data: { name: 'plain', link_karma: 4, comment_karma: 6, snoovatar_img: 'https://i/s.png' } },
            { data: { name: 'empty' } },
        ];
        fetchMock = installFetch((_request, count) => reply(bodies[count - 1]));
        const profiles = [
            await fetchRedditProfile('ribbon', 'COOKIE'),
            await fetchRedditProfile('plain', ''),
            await fetchRedditProfile('empty', null),
        ];
        assertGolden({ profiles, requests: fetchMock.requests }, 'reddit.profile');
    });

    test('maps posts, follows pages and stops at the limit', async () => {
        fetchMock = installFetch((request) => {
            const after = new URL(request.url).searchParams.get('after');
            if (!after) return listing(rawRedditPosts.slice(0, 3), 't3_c');
            if (after === 't3_c') return listing(rawRedditPosts.slice(3), 't3_e');
            return listing([]);
        });
        const posts = await fetchRedditPosts('ribbon', 'COOKIE');
        const limited = await fetchRedditPosts('ribbon', 'COOKIE', 2);
        assertGolden({ posts, limited, requests: fetchMock.requests }, 'reddit.posts');
    });

    test('maps a tracked post and rejects bad links and responses', async () => {
        const bodies = [
            [{ data: { children: [{ data: { id: 'p1', title: 'Tracked', subreddit: 'webdev', score: 77, upvote_ratio: 0.93, num_comments: 8, permalink: '/r/webdev/comments/p1/tracked/', over_18: false, created_utc: 1785000000 } }] } }],
            [{ data: { children: [{ data: { id: 'p2', title: 'Sparse', subreddit: 'misc', permalink: '/r/misc/comments/p2/' } }] } }],
            { kind: 'Listing' },
            [{ data: { children: [] } }],
        ];
        fetchMock = installFetch((_request, count) => reply(bodies[count - 1]));
        const outcomes = [];
        const links = [
            'https://www.reddit.com/r/webdev/comments/p1/tracked/',
            'https://old.reddit.com/r/misc/comments/p2',
            'https://reddit.com/r/misc/comments/p3/x/',
            'https://reddit.com/r/misc/comments/p4/x',
            'not a url',
            'https://example.com/r/misc/comments/p5/',
            'https://reddit.com/user/ribbon/',
        ];
        for (const link of links) outcomes.push(await outcomeOf(fetchTrackedPostData(link, 'COOKIE')));
        assertGolden({ outcomes, requests: fetchMock.requests }, 'reddit.tracked');
    });

    test('turns http failures and api errors into messages', async () => {
        const script = [
            reply({}, 404, 'Not Found'), reply({}, 403, 'Forbidden'), reply({}, 429, 'Too Many Requests'),
            reply({}, 500, 'Server Error'), reply({ error: 400, message: 'Bad request' }), reply({ error: 401 }),
        ];
        fetchMock = installFetch((_request, count) => script[count - 1]);
        const outcomes = [];
        for (let i = 0; i < script.length; i++) outcomes.push(await outcomeOf(fetchRedditProfile('ribbon', 'COOKIE')));
        outcomes.push(await outcomeOf(autoRefreshRedditSessions()));
        assertGolden(outcomes, 'reddit.errors');
    });
});
