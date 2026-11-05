import { destroyFile, fileSize, uploadFromUrl } from './cloudinary/cloudinaryApi.ts';
import { NotConfiguredError, NotFoundError, UpstreamError, ValidationError, isUniqueViolation } from '../lib/errors.ts';
import type { MediaRegistration } from '../validators/mediaValidators.ts';
import type { MediaResourceType } from './cloudinary/cloudinaryApi.ts';
import type { MediaAssetRepository, StoredMediaAsset } from '../repositories/mediaAssetRepository.ts';
import type { AuditRepository } from '../repositories/auditRepository.ts';
import type { AppConfig } from '../lib/config.ts';
import type { RequestContext } from '../types/context.ts';
import type { MediaAsset } from '../../shared/types/media.ts';

export interface MediaDeps {
    media: MediaAssetRepository;
    audit: AuditRepository;
    config: AppConfig;
    context: RequestContext;
}

export interface MediaImport {
    url: string;
    resourceType: MediaResourceType;
    label: string;
}

export interface MediaRemoval {
    // false when the instance has no Cloudinary API secret, so only Twiligent's record was removed
    removedFromCloudinary: boolean;
}

export interface MediaService {
    list(userId: string): Promise<MediaAsset[]>;
    importFromUrl(userId: string, request: MediaImport): Promise<MediaAsset>;
    // a file the browser already uploaded to the instance's Cloudinary account, added to the person's library
    registerUpload(userId: string, upload: MediaRegistration): Promise<MediaAsset>;
    updateLabel(userId: string, id: string, label: string): Promise<MediaAsset>;
    remove(userId: string, id: string): Promise<MediaRemoval>;
    canDeleteFiles(): boolean;
}

// the Cloudinary id never leaves the Worker; callers only ever see Twiligent's own id
function publicView({ publicId: _publicId, ...asset }: StoredMediaAsset): MediaAsset {
    return asset;
}

const NOT_FOUND = 'No media with that id. List the media to find it.';

export function createMediaService({ media, audit, config, context }: MediaDeps): MediaService {
    const { signal } = context;

    async function findOwned(userId: string, id: string): Promise<StoredMediaAsset> {
        const asset = await media.findForUser(id, userId);
        if (!asset) throw new NotFoundError(NOT_FOUND);
        return asset;
    }

    return {
        list: async userId => (await media.listForUser(userId)).map(publicView),

        async importFromUrl(userId, { url, resourceType, label }) {
            if (!config.cloudinary) throw new NotConfiguredError('Cloudinary is not set up on this server, so media cannot be imported.');
            const uploaded = await uploadFromUrl(config.cloudinary, url, resourceType, signal);
            if (uploaded.resource_type !== resourceType) {
                throw new UpstreamError(`Cloudinary stored the file as ${uploaded.resource_type}, not ${resourceType}. Import it with the right type.`);
            }
            const record = {
                publicId: uploaded.public_id,
                resourceType,
                url: uploaded.secure_url,
                format: uploaded.format ?? null,
                bytes: uploaded.bytes ?? null,
                width: uploaded.width ?? null,
                height: uploaded.height ?? null,
                durationSeconds: uploaded.duration ?? null,
                label,
            };
            let saved: StoredMediaAsset;
            try {
                saved = await media.createForUser(userId, record);
            } catch (err) {
                // the preset can reuse a public id for the same file; the person already has it
                const existing = isUniqueViolation(err) ? await media.findByPublicIdForUser(uploaded.public_id, userId) : null;
                if (!existing) throw err;
                return publicView(existing);
            }
            await audit.recordForUser(userId, { action: 'media_asset.imported', subjectType: 'media_asset', subjectId: saved.id, details: { resourceType } });
            return publicView(saved);
        },

        async registerUpload(userId, upload) {
            if (!config.cloudinary) throw new NotConfiguredError('Cloudinary is not set up on this server.');
            const url = new URL(upload.url);
            // only a file on this instance's own cloud, at the address Cloudinary gives the id it names
            const ownPath = `/${config.cloudinary.cloudName}/${upload.resourceType}/upload/`;
            if (url.hostname !== 'res.cloudinary.com' || !url.pathname.startsWith(ownPath) || !decodeURIComponent(url.pathname).includes(`/${upload.publicId}`)) {
                throw new ValidationError('The file is not on this server\'s Cloudinary account. Upload it from the Publish page.');
            }
            // the size decides every chunk boundary, so it is measured, not taken from the browser
            const bytes = await fileSize(upload.url, signal);
            const record = { ...upload, bytes };
            try {
                const saved = await media.createForUser(userId, record);
                await audit.recordForUser(userId, { action: 'media_asset.imported', subjectType: 'media_asset', subjectId: saved.id, details: { resourceType: upload.resourceType } });
                return publicView(saved);
            } catch (err) {
                const existing = isUniqueViolation(err) ? await media.findByPublicIdForUser(upload.publicId, userId) : null;
                if (!existing) throw err;
                return publicView(existing);
            }
        },

        async updateLabel(userId, id, label) {
            const updated = await media.updateLabelForUser(id, userId, label);
            if (!updated) throw new NotFoundError(NOT_FOUND);
            return publicView(updated);
        },

        // the file goes from Cloudinary first, so a failure there leaves the record and the person can try again
        async remove(userId, id) {
            const asset = await findOwned(userId, id);
            const admin = config.cloudinaryAdmin;
            if (admin) await destroyFile(admin, asset.publicId, asset.resourceType, signal);
            await media.deleteForUser(id, userId);
            await audit.recordForUser(userId, { action: 'media_asset.deleted', subjectType: 'media_asset', subjectId: id, details: { fromCloudinary: Boolean(admin) } });
            return { removedFromCloudinary: Boolean(admin) };
        },

        canDeleteFiles: () => config.cloudinaryAdmin !== null,
    };
}
