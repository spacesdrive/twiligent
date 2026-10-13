import { controller, servicesFor } from './http.ts';
import type { OverviewResponse } from '../../shared/types/domain.ts';

// the client polls again while accounts are syncing, so warming never holds up the response
export const getOverview = controller.createHandlers(async c => {
    const { tracked, analyticsCache, warmTasks } = await servicesFor(c).overview.summary(c.get('userId'));
    if (warmTasks.length > 0) c.executionCtx.waitUntil(Promise.allSettled(warmTasks));
    return c.json({ tracked, analyticsCache } satisfies OverviewResponse);
});
