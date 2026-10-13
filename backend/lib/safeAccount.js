// hasCookie lets the frontend show reddit session status without ever receiving the cookie
const SECRET_FIELDS = ['accessToken', 'cookie', 'encryptedPassword', 'encryptedTotpSecret', 'authToken', 'ct0'];

export function safeAccount(account) {
    const copy = { ...account, hasCookie: !!account.cookie };
    for (const field of SECRET_FIELDS) delete copy[field];
    return copy;
}
