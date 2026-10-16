import { createFactory } from 'hono/factory';
import { createServices } from '../container.ts';
import { readConfig } from '../lib/config.ts';
import { ValidationError } from '../lib/errors.ts';
import { createLogger, errorFields } from '../lib/logger.ts';
import { requestContextOf } from '../middleware/requestContext.ts';
import type { Services } from '../container.ts';
import type { AppContext, AppEnv } from '../types/app.ts';

// createHandlers keeps the validator's types, so c.req.valid() is typed inside each controller
export const controller = createFactory<AppEnv>();

// controllers are declared apart from their routes, so Hono cannot type the path parameters
export function pathParam(c: AppContext, name: string): string {
    const value = c.req.param(name);
    if (!value) throw new ValidationError(`Missing path parameter: ${name}`);
    return value;
}

// the request's services, built from the clients the middleware created and the request context
export function servicesFor(c: AppContext): Services {
    const clients = { supabase: c.get('supabase'), redis: c.get('redis'), rateLimitRedis: c.get('rateLimitRedis') };
    return createServices(clients, readConfig(c.env), requestContextOf(c));
}

// work after the response gets its own deadline: the request's signal ends with the response, and the Worker keeps
// running waitUntil work for at most 30 seconds after it
const BACKGROUND_DEADLINE_MS = 25_000;

// runs work after the response is sent, with services of its own; a failure is logged, since nobody is waiting for it
export function inBackground(c: AppContext, label: string, work: (services: Services) => Promise<unknown>): void {
    const requestId = c.get('requestId');
    const log = createLogger({ requestId, background: label });
    const context = { requestId, signal: AbortSignal.timeout(BACKGROUND_DEADLINE_MS), log };
    const clients = { supabase: c.get('supabase'), redis: c.get('redis'), rateLimitRedis: c.get('rateLimitRedis') };
    const services = createServices(clients, readConfig(c.env), context);
    c.executionCtx.waitUntil(work(services).catch(err => log.error(`${label} failed`, errorFields(err))));
}
