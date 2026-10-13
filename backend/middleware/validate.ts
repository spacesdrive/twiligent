import { validator } from 'hono/validator';
import { objectBody } from '../validators/fields.ts';
import type { Fields } from '../validators/fields.ts';

// runs before the controller; a parser throws ValidationError, which the error handler answers with a 400
export function jsonBody<T>(parse: (body: Fields) => T) {
    return validator('json', value => parse(objectBody(value)));
}

// repeated keys keep their first value, as c.req.query(name) does
export function queryParams<T>(parse: (query: Fields) => T) {
    return validator('query', value => {
        const first: Fields = {};
        for (const [key, entry] of Object.entries(value)) first[key] = Array.isArray(entry) ? entry[0] : entry;
        return parse(first);
    });
}
