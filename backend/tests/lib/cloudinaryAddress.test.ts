import { test } from 'node:test';
import assert from 'node:assert/strict';
import { isDeliveryAddressFor } from '../../lib/cloudinaryAddress.ts';

test('an address matches only the exact delivery path of the id it names', () => {
    const at = (address: string, publicId: string) => isDeliveryAddressFor(address, 'demo', 'video', publicId);
    assert.equal(at('https://res.cloudinary.com/demo/video/upload/v17/a/b.mp4', 'a/b'), true);
    assert.equal(at('https://res.cloudinary.com/demo/video/upload/a/b', 'a/b'), true);
    assert.equal(at('https://res.cloudinary.com/demo/video/upload/v17/a/b.mp4', 'b'), false);
    assert.equal(at('https://res.cloudinary.com/demo/video/upload/v17/a/b.mp4', 'a'), false);
    assert.equal(at('https://res.cloudinary.com/demo/video/upload/v17/a/bc.mp4', 'a/b'), false);
    assert.equal(at('https://res.cloudinary.com/demo/video/upload/w_100/v17/a/b.mp4', 'a/b'), false);
    assert.equal(at('https://res.cloudinary.com/demo/image/upload/v17/a/b.jpg', 'a/b'), false);
    assert.equal(at('https://res.cloudinary.com/other/video/upload/v17/a/b.mp4', 'a/b'), false);
    assert.equal(at('https://evil.example/demo/video/upload/v17/a/b.mp4', 'a/b'), false);
    assert.equal(at('https://res.cloudinary.com/demo/video/upload/v17/a/b.mp4?x=1', 'a/b'), false);
    assert.equal(at('https://res.cloudinary.com/demo/video/upload/%E0%A4%A.mp4', 'x'), false);
});
