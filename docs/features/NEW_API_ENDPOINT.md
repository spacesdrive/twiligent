# Guide: Adding a New API Endpoint

Write the code in the style described in `docs/guidelines/CODE_STYLE.md` and run its checklist before each commit.

Follow this guide when adding a route to the Hono backend. Read `docs/architecture/backend/REQUEST_PIPELINE.md` for the layers, then the tracked content feature as a reference implementation: `backend/validators/trackedContentValidators.ts`, `repositories/trackedPostRepository.ts`, `services/trackedContentService.ts`, `controllers/trackedContentController.ts` and `routes/trackedContentRoutes.ts`. `docs/guidelines/TYPESCRIPT.md` has the typing rules.

## Files to Create or Modify

| Action | File |
|---|---|
| Modify | `shared/types/domain.ts` (or the platform file) - request and response types |
| Create or modify | `backend/validators/myFeatureValidators.ts` - body and query parsers |
| Create or modify | `backend/repositories/myResourceRepository.ts` - queries (if the endpoint needs new ones) |
| Create or modify | `backend/services/myFeatureService.ts` - the business rules |
| Modify (new service or repository) | `backend/container.ts` - wire it into `Services` |
| Create or modify | `backend/controllers/myFeatureController.ts` |
| Create or modify | `backend/routes/myFeatureRoutes.ts`, and `backend/routes/index.ts` for a new table |
| Modify | `frontend/src/services/api.ts` (add frontend method) |
| Create | `backend/tests/routes/myFeatureRoutes.test.ts`, plus service, repository and validator tests as needed |
| Update | `docs/architecture/backend/ROUTES.md` |

## Step 1: Define the Request and Response Types

Add the shapes the endpoint sends and receives to `shared/types/` first. Use `domain.ts` for cross-platform data, or `youtube.ts`, `instagram.ts` or `reddit.ts` for platform data. These files hold types only and never import runtime code.

```ts
// shared/types/domain.ts
export interface MyResource {
    id: string;
    name: string;
}

export interface MyResourceCreateRequest {
    name: string;
}

export interface MyResourceCreateResponse {
    success: true;
    id: string;
}
```

When you change an existing route's response, change its type here first: `npm run typecheck` then lists every backend and frontend file that reads the old shape. Failures need no type of their own: every error is an `ApiFailure`.

## Step 2: Add a Validator

In `backend/validators/myFeatureValidators.ts`, add a parser that reads the body with the helpers in `validators/fields.ts` and returns the request type. A missing or malformed field throws `ValidationError` (400) with a message the user can act on:

```ts
import { requiredString } from './fields.ts';
import type { Fields } from './fields.ts';
import type { MyResourceCreateRequest } from '../../shared/types/domain.ts';

export function parseMyResource(body: Fields): MyResourceCreateRequest {
    return { name: requiredString(body, 'name', 'Enter a name') };
}
```

Validators check shape and presence only. Rules that need stored data belong in the service. Query strings use the same helpers through `queryParams(parse)`.

## Step 3: Add Repository Methods (if needed)

In `backend/repositories/`, add the queries to the table's repository, or create one for a new table (see `NEW_DATABASE_TABLE.md`). Every user-scoped method takes the verified `userId`, ends in `ForUser`, and filters by it. Run every query through `rows`, `maybeRow` or `execute` from `repositories/query.ts`, which turn a failure into a `DatabaseError`:

```ts
// backend/repositories/myResourceRepository.ts
import { execute, rows } from './query.ts';
import type { SupabaseClient } from '../types/app.ts';
import type { MyResource } from '../../shared/types/domain.ts';

interface MyResourceRow {
    id: string;
    name: string;
    data: Record<string, unknown> | null;
}

export interface MyResourceRepository {
    listForUser(userId: string): Promise<MyResource[]>;
    create(resource: MyResource, userId: string): Promise<void>;
}

export function createMyResourceRepository(db: SupabaseClient): MyResourceRepository {
    return {
        async listForUser(userId) {
            const found = await rows<MyResourceRow>('myResources.listForUser', () => db
                .from('my_table')
                .select('id, name, data')
                .eq('user_id', userId)
                .order('created_at', { ascending: false }));
            return found.map(row => ({ id: row.id, name: row.name, ...(row.data || {}) }));
        },

        async create(resource, userId) {
            const { id, name, ...rest } = resource;
            await execute('myResources.create', () => db.from('my_table').insert({ id, user_id: userId, name, data: rest }));
        },
    };
}
```

## Step 4: Add the Service Method

In `backend/services/myFeatureService.ts`, put the business rules. A service is a factory that receives repositories, `config` and `context`, never the Hono context, and throws typed errors from `lib/errors.ts`:

```ts
import { NotFoundError } from '../lib/errors.ts';
import type { MyResourceRepository } from '../repositories/myResourceRepository.ts';
import type { MyResource, MyResourceCreateRequest } from '../../shared/types/domain.ts';

export interface MyFeatureDeps {
    resources: MyResourceRepository;
}

export interface MyFeatureService {
    list(userId: string): Promise<MyResource[]>;
    create(userId: string, request: MyResourceCreateRequest): Promise<string>;
}

export function createMyFeatureService({ resources }: MyFeatureDeps): MyFeatureService {
    return {
        list: userId => resources.listForUser(userId),

        async create(userId, { name }) {
            const id = crypto.randomUUID();
            await resources.create({ id, name }, userId);
            return id;
        },
    };
}
```

If the endpoint calls a platform API, put the call in the platform module (`services/youtube/`, `services/instagram/`, `services/reddit/`) and pass it `context.signal`. A missing Worker secret is a `NotConfiguredError` (503); a record the user does not own is a `NotFoundError` (404).

Wire a new repository or service in `backend/container.ts`: build the repository from `clients.supabase`, add the service to the `Services` interface, and create it in `createServices()`.

## Step 5: Add the Controller

```ts
// backend/controllers/myFeatureController.ts
import { controller, servicesFor } from './http.ts';
import { jsonBody } from '../middleware/validate.ts';
import { parseMyResource } from '../validators/myFeatureValidators.ts';
import type { MyResource, MyResourceCreateResponse } from '../../shared/types/domain.ts';

export const listMyResources = controller.createHandlers(async c => {
    const resources = await servicesFor(c).myFeature.list(c.get('userId'));
    return c.json(resources satisfies MyResource[]);
});

export const createMyResource = controller.createHandlers(jsonBody(parseMyResource), async c => {
    const id = await servicesFor(c).myFeature.create(c.get('userId'), c.req.valid('json'));
    return c.json({ success: true, id } satisfies MyResourceCreateResponse, 201);
});
```

A controller reads the user id, path parameters (`pathParam(c, 'id')`) and validated input, calls one service method, and builds the response. It never catches errors, never queries the database and never builds an error body.

## Step 6: Add the Route

```ts
// backend/routes/myFeatureRoutes.ts
import { Hono } from 'hono';
import { listMyResources, createMyResource } from '../controllers/myFeatureController.ts';
import type { AppEnv } from '../types/app.ts';

const router = new Hono<AppEnv>();

router.get('/my-resources', ...listMyResources);
router.post('/my-resources', ...createMyResource);

export default router;
```

Add a new table to the list in `backend/routes/index.ts`:

```ts
import myFeatureRoutes from './myFeatureRoutes.ts';
// ...
for (const routes of [
    accountRoutes, analyticsRoutes, /* ... */, myFeatureRoutes,
]) {
    protectedRoutes.route('/', routes);
}
```

Routes on `protectedRoutes` get authentication and the per-IP and per-user rate limits automatically. If the endpoint spends platform API quota or publishes, add it to `QUOTA_ROUTES` or `PUBLISH_ROUTES` in `backend/lib/rateLimit/rules.ts` (see `docs/architecture/backend/RATE_LIMITING.md`).

## Step 7: Add Frontend API Methods

```ts
// frontend/src/services/api.ts
import type { MyResource, MyResourceCreateRequest, MyResourceCreateResponse } from '@shared/types/domain.ts';

export const api = {
    // ... existing methods
    getMyResources: () => request<MyResource[]>('/my-resources'),
    createMyResource: (data: MyResourceCreateRequest) => request<MyResourceCreateResponse>('/my-resources', { method: 'POST', body: JSON.stringify(data) }),
};
```

`request()` throws on any non-2xx status with the backend's message, so the method returns the success type and callers never check `success` (see `docs/architecture/frontend/API_LAYER.md`).

## Step 8: Type-check

```bash
npm run typecheck
```

Fix every error before moving on. Wrangler and Vite strip types without checking them, so this is the only place a wrong shape is caught.

## Step 9: Update Documentation

Add the new routes to `docs/architecture/backend/ROUTES.md` with their route table and controller, and any status that is specific to them.

## Security Checklist

- [ ] Route is registered on `protectedRoutes` (protected by `requireAuth`), unless it must be public
- [ ] Controller reads `userId` from `c.get('userId')` and passes it to the service - never from the request body or query
- [ ] Every repository method the service calls for user data ends in `ForUser` and filters by `user_id`
- [ ] Any account data in the response passes through `safeAccount()`
- [ ] Input goes through a validator, so a missing or malformed field is a 400 before the service runs
- [ ] Failures are typed errors; nothing builds `{ error }` or catches an error only to reformat it

## Testing

Tests live in `backend/tests/`, at the path that mirrors the source file. A route table gets an end-to-end test in `backend/tests/routes/myFeatureRoutes.test.ts`: `mountWithContext()` from `fixtures/routeHarness.ts` mounts the table behind the error handler and a request id, with the fake Supabase client from `fixtures/fakeSupabase.ts` and, for platform calls, `fixtures/fakeFetch.ts`. Assert the status and body, or compare with a `*.golden.json` snapshot through `fixtures/golden.ts`; see `backend/tests/routes/settingsRoutes.test.ts` and `accountRoutes.test.ts`. Add `backend/tests/services/`, `repositories/` or `validators/` tests for logic worth testing on its own. Run `npm test` and `npm run typecheck` from the repository root.

```bash
# Local test, from the repository root
npm run dev:backend

# Test with curl (replace TOKEN)
curl http://localhost:8787/api/my-resources \
  -H "Authorization: Bearer TOKEN"

curl -X POST http://localhost:8787/api/my-resources \
  -H "Authorization: Bearer TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"name":"test"}'

# A missing field answers 400 with { success: false, code: "VALIDATION_ERROR", message, requestId }
curl -X POST http://localhost:8787/api/my-resources \
  -H "Authorization: Bearer TOKEN" \
  -H "Content-Type: application/json" \
  -d '{}'
```
