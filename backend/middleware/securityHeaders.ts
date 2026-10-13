import { secureHeaders } from 'hono/secure-headers';

// the API only answers JSON and redirects, so nothing it returns may be framed, sniffed or run as a page
export const securityHeaders = secureHeaders({
    contentSecurityPolicy: { defaultSrc: ["'none'"], frameAncestors: ["'none'"] },
    xFrameOptions: 'DENY',
    referrerPolicy: 'no-referrer',
});
