// names whose value is a credential wherever it appears, in a query string, a form body or JSON
const SECRET_NAMES = 'access_token|refresh_token|id_token|client_secret|app_secret|api_key|apikey|password|token|secret';

// platform errors can echo the request url, a header or the form body, which carry the api key or access token
export function redactSecrets(message: string): string {
    return message
        .replace(/https?:\/\/[^\s)]+/g, '[url]')
        .replace(/\bBearer\s+[^\s"',]+/gi, 'Bearer [redacted]')
        .replace(new RegExp(`\\b(${SECRET_NAMES})=[^&\\s"',]+`, 'gi'), '$1=[redacted]')
        .replace(new RegExp(`"(${SECRET_NAMES})"\\s*:\\s*"[^"]*"`, 'gi'), '"$1":"[redacted]"');
}
