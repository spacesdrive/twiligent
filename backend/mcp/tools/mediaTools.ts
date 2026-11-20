import { READ_ONLY, defineTool } from '../tool.ts';
import { idProperty, objectSchema, pageOf, pageProperties, parsePage, requiredId, withConfirmation } from '../schemas.ts';
import { MAX_MEDIA_LABEL_LENGTH, parseMediaImport, parseMediaLabel, parseMediaRegistration } from '../../validators/mediaValidators.ts';
import { ValidationError } from '../../lib/errors.ts';
import type { Page } from '../schemas.ts';
import type { FileKeptReason, MediaImport } from '../../services/mediaService.ts';
import type { MediaRegistration } from '../../validators/mediaValidators.ts';

const labelProperty = { type: 'string', maxLength: MAX_MEDIA_LABEL_LENGTH, description: 'A short name to find the file by later' };

export const listMedia = defineTool<{ page: Page }>({
    name: 'list_media',
    title: 'List media',
    description: 'Lists the images and videos you imported into Twiligent, newest first, with the public https address to schedule a post with.',
    inputSchema: objectSchema({ ...pageProperties }),
    annotations: READ_ONLY,
    permission: 'read',
    parse: args => ({ page: parsePage(args) }),
    async run({ page }, { services, principal }) {
        const { items, nextCursor, total } = pageOf(await services.media.list(principal.userId), page);
        return { media: items, nextCursor, total };
    },
});

export const importMediaFromUrl = defineTool<MediaImport>({
    name: 'import_media_from_url',
    title: 'Import media from a URL',
    description: 'Copies an image or video from a public https address into the instance\'s Cloudinary storage, so it has a stable address Instagram can publish from. Cloudinary downloads the file, not Twiligent. Large videos may take longer than a tool call allows; Cloudinary\'s plan limits apply (100 MB per video on the free plan).',
    inputSchema: objectSchema({
        url: { type: 'string', format: 'uri', maxLength: 2048, description: 'The public https address of the file' },
        resourceType: { type: 'string', enum: ['image', 'video'] },
        label: labelProperty,
    }, ['url', 'resourceType']),
    annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: true },
    permission: 'write',
    parse: args => parseMediaImport(args),
    async run(input, { services, principal }) {
        return { media: await services.media.importFromUrl(principal.userId, input) };
    },
});

type ResourceType = 'image' | 'video';
const RESOURCE_TYPES: ResourceType[] = ['image', 'video'];

function resourceTypeOf(value: unknown): ResourceType {
    if (RESOURCE_TYPES.includes(value as ResourceType)) return value as ResourceType;
    throw new ValidationError('resourceType must be image or video');
}

// the same unsigned upload the app's browser makes: the caller sends the file to Cloudinary, then registers it
export const startMediaUpload = defineTool<{ resourceType: ResourceType }>({
    name: 'start_media_upload',
    title: 'Start an upload of a file from this computer',
    description: 'Gives the address and form fields to upload an image or video from this computer straight to the instance\'s Cloudinary storage, as the Twiligent app does. POST the file as multipart form data, in the field fileField, with every entry of fields; then call register_media with what Cloudinary answers. Cloudinary\'s plan limits apply (100 MB per video on the free plan).',
    inputSchema: objectSchema({ resourceType: { type: 'string', enum: RESOURCE_TYPES } }, ['resourceType']),
    annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false },
    permission: 'write',
    parse: args => ({ resourceType: resourceTypeOf(args.resourceType) }),
    async run({ resourceType }, { services }) {
        const { cloudName, uploadPreset } = services.publishing.cloudinaryConfig();
        return {
            uploadUrl: `https://api.cloudinary.com/v1_1/${cloudName}/${resourceType}/upload`,
            fileField: 'file',
            fields: { upload_preset: uploadPreset },
            next: 'Call register_media with resourceType and Cloudinary\'s public_id, secure_url, format, width, height and duration.',
        };
    },
});

export const registerMedia = defineTool<MediaRegistration>({
    name: 'register_media',
    title: 'Add an uploaded file to your media',
    description: 'Adds a file uploaded with start_media_upload to your media, so it can be scheduled. Pass Cloudinary\'s answer: public_id as publicId, secure_url as url, and format, width, height and duration (as durationSeconds). Twiligent accepts only a file on this instance\'s storage and measures its size itself. Registering the same file twice returns the first record.',
    inputSchema: objectSchema({
        publicId: { type: 'string', maxLength: 300, description: 'Cloudinary\'s public_id for the upload' },
        url: { type: 'string', format: 'uri', maxLength: 2048, description: 'Cloudinary\'s secure_url for the upload' },
        resourceType: { type: 'string', enum: RESOURCE_TYPES },
        format: { type: 'string', maxLength: 20 },
        width: { type: 'number', minimum: 0 },
        height: { type: 'number', minimum: 0 },
        durationSeconds: { type: 'number', minimum: 0, description: 'Cloudinary\'s duration, for a video' },
        label: labelProperty,
    }, ['publicId', 'url', 'resourceType']),
    annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: true, openWorldHint: false },
    permission: 'write',
    parse: args => parseMediaRegistration(args),
    async run(upload, { services, principal }) {
        return { media: await services.media.registerUpload(principal.userId, upload) };
    },
});

export const updateMedia = defineTool<{ mediaId: string; label: string }>({
    name: 'update_media',
    title: 'Rename media',
    description: 'Changes the label of one of your imported files.',
    inputSchema: objectSchema({ mediaId: idProperty('media'), label: labelProperty }, ['mediaId', 'label']),
    annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: true, openWorldHint: false },
    permission: 'write',
    parse: args => ({ mediaId: requiredId(args, 'mediaId', 'media'), label: parseMediaLabel(args) }),
    async run({ mediaId, label }, { services, principal }) {
        return { media: await services.media.updateLabel(principal.userId, mediaId, label) };
    },
});

const FILE_KEPT_NOTES: Record<FileKeptReason, string> = {
    no_api_secret: 'The file is still on Cloudinary: this instance has no Cloudinary API secret to delete it with. Its address keeps working until the owner deletes it in the Cloudinary console.',
    not_created_by_twiligent: 'The file is still on Cloudinary: it was uploaded from the browser or already existed, so Twiligent cannot tell it is only yours and never deletes it. The instance owner can delete it in the Cloudinary console.',
};

export const deleteMedia = defineTool<{ mediaId: string }>({
    name: 'delete_media',
    title: 'Delete media',
    description: 'Deletes one of your imported files. A post already scheduled with its address will fail to publish. When the instance has a Cloudinary API secret, a file Twiligent imported is deleted from Cloudinary too; a file uploaded from the browser, or an instance without the secret, keeps the file and the result says so. Asks for a confirmation first.',
    inputSchema: withConfirmation(objectSchema({ mediaId: idProperty('media') }, ['mediaId'])),
    annotations: { readOnlyHint: false, destructiveHint: true, idempotentHint: true, openWorldHint: false },
    permission: 'write',
    needsConfirmation: () => true,
    describe: ({ mediaId }) => `Delete media ${mediaId}; a post scheduled with it would fail to publish.`,
    parse: args => ({ mediaId: requiredId(args, 'mediaId', 'media') }),
    async run({ mediaId }, { services, principal }) {
        const { removedFromCloudinary, fileKept } = await services.media.remove(principal.userId, mediaId);
        return { deleted: mediaId, removedFromCloudinary, note: fileKept ? FILE_KEPT_NOTES[fileKept] : undefined };
    },
});

export const MEDIA_TOOLS = [listMedia, importMediaFromUrl, startMediaUpload, registerMedia, updateMedia, deleteMedia];
