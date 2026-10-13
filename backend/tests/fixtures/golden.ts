import assert from 'node:assert/strict';
import { readFileSync, writeFileSync } from 'node:fs';

// json drops undefined and non-finite numbers, so mark them to keep them visible in the snapshot
function encodeValue(_key: string, value: unknown): unknown {
    if (value === undefined) return '[undefined]';
    if (typeof value === 'number' && !Number.isFinite(value)) return `[${value}]`;
    return value;
}

export function snapshot(value: unknown): unknown {
    return JSON.parse(JSON.stringify(value, encodeValue));
}

export function readGolden(name: string): unknown {
    return JSON.parse(readFileSync(new URL(`./${name}.golden.json`, import.meta.url), 'utf8'));
}

// the string comparison also pins key order, which deepStrictEqual ignores
export function assertGolden(actual: unknown, name: string): void {
    const actualSnapshot = snapshot(actual);
    // UPDATE_GOLDEN=<name> rewrites one snapshot, only for an intended behaviour change
    if (process.env.UPDATE_GOLDEN === name) {
        writeFileSync(new URL(`./${name}.golden.json`, import.meta.url), `${JSON.stringify(actualSnapshot, null, 4)}\n`);
    }
    const expected = readGolden(name);
    assert.deepStrictEqual(actualSnapshot, expected);
    assert.equal(JSON.stringify(actualSnapshot), JSON.stringify(expected));
}
