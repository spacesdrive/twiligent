// the rules for the instance's shared YouTube Data API quota; pure, so tests can check them without Redis

// a Google Cloud project gets 10,000 units a day by default; one member may use a quarter of them, so a single person can
// never spend the allowance every other member's analytics depend on
export const USER_DAILY_UNITS = 2500;

// search.list costs 100 units; every list call Twiligent makes (channels, playlistItems, videos) costs 1
const ENDPOINT_UNITS: Record<string, number> = { search: 100 };

export function unitsFor(endpoint: string): number {
    return ENDPOINT_UNITS[endpoint] ?? 1;
}

// YouTube resets the quota at midnight Pacific time, so the counters are kept per Pacific day
export function pacificDay(now: number = Date.now()): string {
    return new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Los_Angeles', year: 'numeric', month: '2-digit', day: '2-digit' }).format(now);
}

export const QUOTA_USED_MESSAGE = 'You have used your share of this instance\'s YouTube data for today. It resets at midnight Pacific time; cached analytics stay available.';
