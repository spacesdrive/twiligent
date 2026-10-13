import type { Logger } from '../lib/logger.ts';

// the request metadata services may read, free of Hono types so a cron job can build one too
export interface RequestContext {
    requestId: string;
    // aborts when the client disconnects or the deadline passes; platform calls hand it to fetch
    signal: AbortSignal;
    log: Logger;
}
