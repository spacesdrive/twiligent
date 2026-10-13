import { controller, pathParam, servicesFor } from './http.ts';
import { jsonBody } from '../middleware/validate.ts';
import { parseNewTrackedContent, parseTrackedContentChanges } from '../validators/trackedContentValidators.ts';
import type { SuccessResponse, TrackedContentListResponse } from '../../shared/types/domain.ts';

export const listTrackedContent = controller.createHandlers(async c => {
    const items = await servicesFor(c).trackedContent.list(c.get('userId'));
    return c.json(items satisfies TrackedContentListResponse);
});

export const addTrackedContent = controller.createHandlers(jsonBody(parseNewTrackedContent), async c => {
    const item = await servicesFor(c).trackedContent.add(c.get('userId'), c.req.valid('json'));
    return c.json(item, 201);
});

export const updateTrackedContent = controller.createHandlers(jsonBody(parseTrackedContentChanges), async c => {
    const item = await servicesFor(c).trackedContent.update(c.get('userId'), pathParam(c, 'id'), c.req.valid('json'));
    return c.json(item);
});

export const deleteTrackedContent = controller.createHandlers(async c => {
    await servicesFor(c).trackedContent.remove(c.get('userId'), pathParam(c, 'id'));
    return c.json({ success: true } satisfies SuccessResponse);
});

export const refreshTrackedContent = controller.createHandlers(async c => {
    const item = await servicesFor(c).trackedContent.refresh(c.get('userId'), pathParam(c, 'id'));
    return c.json(item);
});
