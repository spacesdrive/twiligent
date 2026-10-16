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
    // Supabase Auth's Send Email hook: the hook secret (v1,whsec_...) and the Resend account that delivers the emails
    SEND_EMAIL_HOOK_SECRET?: string;
    RESEND_API_KEY?: string;
    // the sender, such as "Twiligent <no-reply@example.com>", on a domain verified in Resend
    EMAIL_FROM?: string;
    // emails a day across all users; defaults to 100, Resend's free daily quota
    EMAIL_DAILY_LIMIT?: string;
    // the Verify Token typed into the Meta dashboard's webhook settings
    INSTAGRAM_WEBHOOK_VERIFY_TOKEN?: string;
    // the Meta app secret (App settings, Basic); webhooks are checked against it as well as INSTAGRAM_APP_SECRET
    META_APP_SECRET?: string;
    // "true" holds every comment-to-DM reply on this instance; comments are still recorded
    AUTOMATION_PAUSED?: string;
    // private replies per hour and per day; each falls back to its default when missing or invalid
    AUTOMATION_ACCOUNT_HOURLY_LIMIT?: string;
    AUTOMATION_USER_HOURLY_LIMIT?: string;
    AUTOMATION_GLOBAL_HOURLY_LIMIT?: string;
    AUTOMATION_RECIPIENT_DAILY_LIMIT?: string;
    // public replies under comments per hour and account, 60 when missing, at most 200
    AUTOMATION_PUBLIC_ACCOUNT_HOURLY_LIMIT?: string;
    // replies sent by one webhook request or one sweep
    AUTOMATION_BATCH_SIZE?: string;
}
