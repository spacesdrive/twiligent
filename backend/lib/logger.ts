import { redactUrls } from './redact.ts';

export type LogFields = Record<string, unknown>;

export interface Logger {
    info(message: string, fields?: LogFields): void;
    warn(message: string, fields?: LogFields): void;
    error(message: string, fields?: LogFields): void;
    with(fields: LogFields): Logger;
}

type Level = 'info' | 'warn' | 'error';

const WRITERS: Record<Level, (line: string) => void> = {
    info: line => console.log(line),
    warn: line => console.warn(line),
    error: line => console.error(line),
};

// one JSON object per line, which Workers Logs indexes field by field
export function createLogger(base: LogFields = {}): Logger {
    const write = (level: Level, message: string, fields: LogFields = {}) => {
        WRITERS[level](JSON.stringify({ level, message, ...base, ...fields }));
    };
    return {
        info: (message, fields) => write('info', message, fields),
        warn: (message, fields) => write('warn', message, fields),
        error: (message, fields) => write('error', message, fields),
        with: fields => createLogger({ ...base, ...fields }),
    };
}

// the message and the message of its cause, with urls removed; never the stack, which can hold request data
export function errorFields(err: unknown): LogFields {
    const error = err as Error & { cause?: unknown };
    const fields: LogFields = { error: redactUrls(String(error?.message ?? err)), errorName: error?.name };
    if (error?.cause !== undefined) fields.cause = redactUrls(String((error.cause as Error)?.message ?? error.cause));
    return fields;
}
