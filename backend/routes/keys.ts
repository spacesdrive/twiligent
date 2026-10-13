import { Hono } from 'hono';

const app = new Hono();

// keys are server env vars; this only reports which are set, for the status ui
app.get('/keys', (c) => {
    return c.json({
        youtube: { configured: !!c.env.YOUTUBE_API_KEY },
        instagram: { configured: !!(c.env.INSTAGRAM_APP_ID && c.env.INSTAGRAM_APP_SECRET) },
        cloudinary: { configured: !!(c.env.CLOUDINARY_CLOUD_NAME && c.env.CLOUDINARY_UPLOAD_PRESET) },
    });
});

export default app;
