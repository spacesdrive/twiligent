import { test, mock } from 'node:test';
import assert from 'node:assert/strict';
import { destroyFile, signParams, uploadFromUrl } from '../../../services/cloudinary/cloudinaryApi.ts';
import { UpstreamError } from '../../../lib/errors.ts';

test('the signature matches the example in Cloudinary\'s documentation', async () => {
    const signature = await signParams({ timestamp: '1315060510', public_id: 'sample_image', eager: 'w_400,h_300,c_pad|w_260,h_200,c_crop' }, 'abcd');
    assert.equal(signature, 'bfd09f95f331f558cbd1320e67aa8d488770583e');
});

test('an import asks Cloudinary to fetch the address with the unsigned preset', async t => {
    const calls: { url: string; body: string }[] = [];
    const fetchMock = mock.method(globalThis, 'fetch', async (url: string, init: RequestInit) => {
        calls.push({ url, body: String(init.body) });
        return Response.json({ public_id: 'abc', secure_url: 'https://res.cloudinary.com/demo/image/upload/abc.jpg', resource_type: 'image' });
    });
    t.after(() => fetchMock.mock.restore());
    const uploaded = await uploadFromUrl({ cloudName: 'demo', uploadPreset: 'unsigned' }, 'https://example.com/a.jpg', 'image');
    assert.equal(uploaded.public_id, 'abc');
    assert.equal(calls[0].url, 'https://api.cloudinary.com/v1_1/demo/image/upload');
    assert.equal(calls[0].body, 'file=https%3A%2F%2Fexample.com%2Fa.jpg&upload_preset=unsigned');
});

test('a refused import or delete is an upstream error with Cloudinary\'s reason, and an already deleted file counts as deleted', async t => {
    const answers = [
        Response.json({ error: { message: 'Resource not found - https://example.com/missing.jpg' } }, { status: 400 }),
        Response.json({ result: 'not found' }),
        Response.json({ result: 'error' }),
    ];
    const fetchMock = mock.method(globalThis, 'fetch', async () => answers.shift());
    t.after(() => fetchMock.mock.restore());
    await assert.rejects(
        uploadFromUrl({ cloudName: 'demo', uploadPreset: 'p' }, 'https://example.com/missing.jpg', 'image'),
        (err: Error) => err instanceof UpstreamError && /Resource not found/.test(err.message),
    );
    const admin = { cloudName: 'demo', apiKey: 'KEY', apiSecret: 'SECRET' };
    await destroyFile(admin, 'abc', 'image');
    await assert.rejects(destroyFile(admin, 'abc', 'image'), UpstreamError);
});
