import { controller } from './http.ts';
import type { HealthResponse } from '../../shared/types/domain.ts';

export const getHealth = controller.createHandlers(c => {
    return c.json({ status: 'ok', timestamp: new Date().toISOString() } satisfies HealthResponse);
});
