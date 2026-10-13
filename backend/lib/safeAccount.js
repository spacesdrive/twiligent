// Removes every credential from an account before it leaves the Worker. hasCookie lets the
// frontend show Reddit session status without ever receiving the cookie itself.
const SECRET_FIELDS = ['accessToken', 'cookie', 'encryptedPassword', 'encryptedTotpSecret', 'authToken', 'ct0'];

export function safeAccount(account) {
    const copy = { ...account, hasCookie: !!account.cookie };
    for (const field of SECRET_FIELDS) delete copy[field];
    return copy;
}
