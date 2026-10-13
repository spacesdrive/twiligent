import { DatabaseError } from '../lib/errors.ts';

interface QueryResult {
    data: unknown;
    error: unknown;
    count?: number | null;
}

// builds and runs one query; a thrown error and a returned error both become a DatabaseError named after the operation
export async function execute(operation: string, build: () => PromiseLike<QueryResult>): Promise<QueryResult> {
    let result: QueryResult;
    try {
        result = await build();
    } catch (err) {
        throw new DatabaseError(operation, err);
    }
    if (result.error) throw new DatabaseError(operation, result.error);
    return result;
}

export async function rows<T>(operation: string, build: () => PromiseLike<QueryResult>): Promise<T[]> {
    const { data } = await execute(operation, build);
    return (data ?? []) as T[];
}

// null when no row matches; only a failed query throws
export async function maybeRow<T>(operation: string, build: () => PromiseLike<QueryResult>): Promise<T | null> {
    const { data } = await execute(operation, build);
    return (data ?? null) as T | null;
}
