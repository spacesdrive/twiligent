import { controller, servicesFor } from './http.ts';
import type { HealthResponse, ReadinessResponse } from '../../shared/types/domain.ts';

// liveness: the Worker answers; it never touches the database, so it stays cheap for frequent checks
export const getHealth = controller.createHandlers(c => {
    return c.json({ status: 'ok', timestamp: new Date().toISOString() } satisfies HealthResponse);
});

// readiness: the secrets are set and the database answers
export const getReadiness = controller.createHandlers(async c => {
    const result = await servicesFor(c).health.readiness();
    return c.json(result satisfies ReadinessResponse);
});
