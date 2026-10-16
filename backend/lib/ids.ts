// row ids come from the platform's cryptographic generator, so no one can work out another row's id from their own
export function newRowId(): string {
    return crypto.randomUUID();
}
