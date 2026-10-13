import { createFactory } from 'hono/factory';
import { createServices } from '../container.ts';
import { readConfig } from '../lib/config.ts';
import { ValidationError } from '../lib/errors.ts';
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
    return createServices({ supabase: c.get('supabase'), redis: c.get('redis') }, readConfig(c.env), requestContextOf(c));
}
