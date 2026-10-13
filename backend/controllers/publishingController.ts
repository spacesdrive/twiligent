import { controller, pathParam, servicesFor } from './http.ts';
import { jsonBody, queryParams } from '../middleware/validate.ts';
import { parseContainerInput, parseContainerStatusQuery, parsePublishRequest } from '../validators/publishingValidators.ts';
import type {
    CloudinaryConfigResponse, InstagramContainerStatusResponse, InstagramMediaPublishResponse, InstagramPublishingLimitResponse,
    InstagramPublishResponse,
} from '../../shared/types/instagram.ts';

export const getCloudinaryConfig = controller.createHandlers(c => {
    const { cloudName, uploadPreset } = servicesFor(c).publishing.cloudinaryConfig();
    return c.json({ success: true, cloudName, uploadPreset } satisfies CloudinaryConfigResponse);
});

export const getPublishingLimit = controller.createHandlers(async c => {
    const data = await servicesFor(c).publishing.publishingLimit(c.get('userId'), pathParam(c, 'id'));
    return c.json({ success: true, data } satisfies InstagramPublishingLimitResponse);
});

export const createContainer = controller.createHandlers(jsonBody(parsePublishRequest), async c => {
    const containerId = await servicesFor(c).publishing.createContainer(c.get('userId'), pathParam(c, 'id'), c.req.valid('json'));
    return c.json({ success: true, containerId } satisfies InstagramPublishResponse);
});

export const getContainerStatus = controller.createHandlers(queryParams(parseContainerStatusQuery), async c => {
    const { accountId } = c.req.valid('query');
    const { statusCode, status } = await servicesFor(c).publishing.containerStatus(c.get('userId'), accountId, pathParam(c, 'containerId'));
    return c.json({ success: true, statusCode, status } satisfies InstagramContainerStatusResponse);
});

export const publishContainer = controller.createHandlers(jsonBody(parseContainerInput), async c => {
    const mediaId = await servicesFor(c).publishing.publishContainer(c.get('userId'), pathParam(c, 'id'), c.req.valid('json').containerId);
    return c.json({ success: true, mediaId } satisfies InstagramMediaPublishResponse);
});
