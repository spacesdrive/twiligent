// an image or video a person keeps on the instance's Cloudinary account, as the media tools return it
export interface MediaAsset {
    id: string;
    resourceType: 'image' | 'video';
    // a public https address Instagram and YouTube can fetch, for scheduling a post
    url: string;
    format: string | null;
    bytes: number | null;
    width: number | null;
    height: number | null;
    durationSeconds: number | null;
    label: string;
    createdAt: string;
}
