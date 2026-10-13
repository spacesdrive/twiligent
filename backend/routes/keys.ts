import { Hono } from 'hono';
import type { AppEnv } from '../types/app.ts';
import type { KeysStatusResponse } from '../../shared/types/domain.ts';

const app = new Hono<AppEnv>();

// keys are server env vars; this only reports which are set, for the status ui
app.get('/keys', (c) => {
    return c.json({
        youtube: { configured: !!c.env.YOUTUBE_API_KEY },
        instagram: { configured: !!(c.env.INSTAGRAM_APP_ID && c.env.INSTAGRAM_APP_SECRET) },
        cloudinary: { configured: !!(c.env.CLOUDINARY_CLOUD_NAME && c.env.CLOUDINARY_UPLOAD_PRESET) },
    } satisfies KeysStatusResponse);
});

export default app;
