// Worker secrets set with `wrangler secret put`; see docs/architecture/cloudflare/WORKERS.md
export interface Env {
    SUPABASE_URL: string;
    SUPABASE_SERVICE_KEY: string;
    SUPABASE_ANON_KEY: string;
    YOUTUBE_API_KEY?: string;
    INSTAGRAM_APP_ID?: string;
    INSTAGRAM_APP_SECRET?: string;
    CLOUDINARY_CLOUD_NAME?: string;
    CLOUDINARY_UPLOAD_PRESET?: string;
    BACKEND_URL?: string;
    FRONTEND_URL?: string;
    // comma-separated extra browser origins allowed by CORS, besides FRONTEND_URL
    ALLOWED_ORIGINS?: string;
    UPSTASH_REDIS_REST_URL?: string;
    UPSTASH_REDIS_REST_TOKEN?: string;
}
