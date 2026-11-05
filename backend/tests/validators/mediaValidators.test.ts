import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseMediaImport, parseMediaLabel } from '../../validators/mediaValidators.ts';
import { ValidationError } from '../../lib/errors.ts';

test('an import takes a public https address, a type and a trimmed label', () => {
    assert.deepEqual(parseMediaImport({ url: ' https://example.com/a.jpg ', resourceType: 'image', label: ' Launch ' }), {
        url: 'https://example.com/a.jpg', resourceType: 'image', label: 'Launch',
    });
});

test('an address that is not public https, or carries credentials, is refused before anything is fetched', () => {
    const refused = [
        'http://example.com/a.jpg', 'ftp://example.com/a.jpg', 'https://localhost/a.jpg', 'https://127.0.0.1/a.jpg',
        'https://10.0.0.5/a.jpg', 'https://192.168.1.2/a.jpg', 'https://172.20.0.1/a.jpg', 'https://169.254.169.254/latest',
        'https://[::1]/a.jpg', 'https://printer.local/a.jpg', 'https://user:pass@example.com/a.jpg', 'not a url',
        `https://example.com/${'a'.repeat(2100)}`,
    ];
    for (const url of refused) assert.throws(() => parseMediaImport({ url, resourceType: 'image' }), ValidationError, url);
});

test('the type must be image or video, and a label is at most 200 characters', () => {
    assert.throws(() => parseMediaImport({ url: 'https://example.com/a.pdf', resourceType: 'raw' }), ValidationError);
    assert.throws(() => parseMediaLabel({ label: 'x'.repeat(201) }), ValidationError);
    assert.equal(parseMediaLabel({}), '');
});
