import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
    objectBody, requiredString, optionalString, optionalBoolean, optionalNumber, optionalArray, isString, presentField,
} from '../../validators/fields.ts';
import { ValidationError } from '../../lib/errors.ts';

test('strings are trimmed, and a blank required string is missing', () => {
    assert.equal(requiredString({ name: '  Ribbon ' }, 'name'), 'Ribbon');
    assert.throws(() => requiredString({ name: '   ' }, 'name', 'Name is required'), new ValidationError('Name is required'));
    assert.throws(() => requiredString({}, 'name'), { message: 'name is required' });
    assert.throws(() => optionalString({ name: 3 }, 'name'), { message: 'name must be text' });
    assert.equal(optionalString({ name: null }, 'name'), undefined);
});

test('booleans, numbers and lists are checked by type', () => {
    assert.equal(optionalBoolean({ flag: false }, 'flag'), false);
    assert.throws(() => optionalBoolean({ flag: 'yes' }, 'flag'), { message: 'flag must be true or false' });
    assert.equal(optionalNumber({ offset: 2.5 }, 'offset'), 2.5);
    assert.throws(() => optionalNumber({ offset: Number.NaN }, 'offset'), { message: 'offset must be a number' });
    assert.deepEqual(optionalArray({ tags: ['a'] }, 'tags', isString, 'names'), ['a']);
    assert.throws(() => optionalArray({ tags: ['a', 1] }, 'tags', isString, 'names'), { message: 'tags must be a list of names' });
});

test('the body must be an object, and a field sent as null is still present', () => {
    assert.throws(() => objectBody([]), { message: 'The request body must be a JSON object' });
    assert.throws(() => objectBody(null), ValidationError);
    assert.equal(presentField({ imageUrl: null }, 'imageUrl'), true);
    assert.equal(presentField({}, 'imageUrl'), false);
});
