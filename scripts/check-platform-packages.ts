#!/usr/bin/env node
// Checks that npm installed every optional package the lockfile lists for this machine. npm skips an optional
// package it fails to download without failing the install, so a platform binary (workerd, esbuild, rollup) can
// be missing after a successful `npm ci`. Exits 1 and names the missing packages so the workflow can install again.

import { existsSync, readFileSync } from 'node:fs';

interface LockPackage {
    optional?: boolean;
    os?: string[];
    cpu?: string[];
    libc?: string[];
}

interface Lockfile {
    packages: Record<string, LockPackage>;
}

type Libc = 'glibc' | 'musl' | null;

function machineLibc(): Libc {
    if (process.platform !== 'linux') return null;
    const header = (process.report.getReport() as { header?: { glibcVersionRuntime?: string } }).header;
    return header?.glibcVersionRuntime ? 'glibc' : 'musl';
}

// the lockfile does not always record libc, so the package name tells the glibc and musl builds apart
function packageLibc(path: string, entry: LockPackage): Libc {
    if (entry.libc?.length) return entry.libc.includes('musl') ? 'musl' : 'glibc';
    if (/musl/.test(path)) return 'musl';
    if (/-gnu(?:$|[/-])/.test(path)) return 'glibc';
    return null;
}

function matches(list: string[] | undefined, value: string): boolean {
    if (!list?.length) return true;
    if (list.includes(`!${value}`)) return false;
    return list.some(item => !item.startsWith('!')) ? list.includes(value) : true;
}

const lockfile = JSON.parse(readFileSync('package-lock.json', 'utf8')) as Lockfile;
const libc = machineLibc();

const expected = Object.entries(lockfile.packages).filter(([path, entry]) => {
    if (!path || !entry.optional || (!entry.os && !entry.cpu)) return false;
    if (!matches(entry.os, process.platform) || !matches(entry.cpu, process.arch)) return false;
    const wanted = packageLibc(path, entry);
    return wanted === null || libc === null || wanted === libc;
});

const missing = expected.map(([path]) => path).filter(path => !existsSync(`${path}/package.json`));

if (missing.length > 0) {
    console.error(`Missing ${missing.length} of ${expected.length} platform packages for ${process.platform}-${process.arch}${libc ? ` (${libc})` : ''}:`);
    for (const path of missing) console.error(`  ${path.replace(/^.*node_modules\//, '')}`);
    console.error('npm skipped them during the install; run `npm ci` again.');
    process.exit(1);
}

console.log(`All ${expected.length} platform packages for ${process.platform}-${process.arch}${libc ? ` (${libc})` : ''} are installed.`);
