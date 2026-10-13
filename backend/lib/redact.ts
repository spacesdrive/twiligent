// platform errors can echo the request url, which carries the api key or access token
export function redactUrls(message: string): string {
    return message.replace(/https?:\/\/[^\s)]+/g, '[url]');
}
