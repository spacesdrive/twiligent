import { app } from './app.ts';
import { runScheduledJob } from './jobs/scheduled.ts';
import type { Env } from './types/env.ts';

// the Worker's two entry points: HTTP requests go through the pipeline in app.ts, cron triggers to jobs/
export default {
    fetch: app.fetch,

    // wrangler.toml schedules: due posts every 15 minutes, token refresh daily
    async scheduled(event: ScheduledController, env: Env, ctx: ExecutionContext) {
        ctx.waitUntil(runScheduledJob(event.cron, env));
    },
} satisfies ExportedHandler<Env>;
