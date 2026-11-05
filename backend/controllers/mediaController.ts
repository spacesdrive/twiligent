import { controller, servicesFor } from './http.ts';
import { jsonBody } from '../middleware/validate.ts';
import { parseMediaRegistration } from '../validators/mediaValidators.ts';
import type { MediaListResponse, MediaResponse } from '../../shared/types/media.ts';

export const listMedia = controller.createHandlers(async c => {
    return c.json({ success: true, media: await servicesFor(c).media.list(c.get('userId')) } satisfies MediaListResponse);
});

// the composer uploads to Cloudinary from the browser, then adds the file to the person's library here
export const registerMedia = controller.createHandlers(jsonBody(parseMediaRegistration), async c => {
    const media = await servicesFor(c).media.registerUpload(c.get('userId'), c.req.valid('json'));
    return c.json({ success: true, media } satisfies MediaResponse, 201);
});
