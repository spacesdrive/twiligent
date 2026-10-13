import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

// json drops undefined and non-finite numbers, so mark them to keep them visible in the snapshot
function encodeValue(_key, value) {
    if (value === undefined) return '[undefined]';
    if (typeof value === 'number' && !Number.isFinite(value)) return `[${value}]`;
    return value;
}

export function snapshot(value) {
    return JSON.parse(JSON.stringify(value, encodeValue));
}

export function readGolden(name) {
    return JSON.parse(readFileSync(new URL(`./${name}.golden.json`, import.meta.url), 'utf8'));
}

// the string comparison also pins key order, which deepStrictEqual ignores
export function assertGolden(actual, name) {
    const expected = readGolden(name);
    const actualSnapshot = snapshot(actual);
    assert.deepStrictEqual(actualSnapshot, expected);
    assert.equal(JSON.stringify(actualSnapshot), JSON.stringify(expected));
}
