import type { HealthRepository } from '../repositories/healthRepository.ts';
import type { ReadinessResponse } from '../../shared/types/domain.ts';

export interface HealthDeps {
    health: HealthRepository;
}

export interface HealthService {
    readiness(): Promise<ReadinessResponse>;
}

// the core secrets are checked before any service is built, so ready means the database answered too
export function createHealthService({ health }: HealthDeps): HealthService {
    return {
        async readiness() {
            const started = Date.now();
            await health.ping();
            return { status: 'ready', databaseMs: Date.now() - started, timestamp: new Date().toISOString() };
        },
    };
}
