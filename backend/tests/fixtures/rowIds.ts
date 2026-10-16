import { mock } from 'node:test';

type Uuid = ReturnType<typeof crypto.randomUUID>;

// new rows get ids from crypto.randomUUID(); numbering them keeps responses and golden snapshots stable
export function mockRowIds(): void {
    let next = 0;
    mock.method(crypto, 'randomUUID', (): Uuid => `00000000-0000-4000-8000-${String(++next).padStart(12, '0')}`);
}
