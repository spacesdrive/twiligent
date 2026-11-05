// Cloudinary delivers an untransformed upload at /<cloud>/<type>/upload/[v<version>/]<public id>[.<format>]
const VERSION_SEGMENT = /^v\d+\//;
const FORMAT_SUFFIX = /^\.[A-Za-z0-9]+$/;

export function isDeliveryAddressFor(address: string, cloudName: string, resourceType: string, publicId: string): boolean {
    let url: URL;
    try {
        url = new URL(address);
    } catch {
        return false;
    }
    if (url.protocol !== 'https:' || url.hostname !== 'res.cloudinary.com' || url.search || url.hash) return false;
    const prefix = `/${cloudName}/${resourceType}/upload/`;
    let path: string;
    try {
        path = decodeURIComponent(url.pathname);
    } catch {
        return false;
    }
    if (!path.startsWith(prefix)) return false;
    const rest = path.slice(prefix.length).replace(VERSION_SEGMENT, '');
    if (rest === publicId) return true;
    return rest.startsWith(publicId) && FORMAT_SUFFIX.test(rest.slice(publicId.length));
}
