import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import * as lucide from 'lucide-react';

const SRC = join(dirname(fileURLToPath(import.meta.url)), '..', '..', 'src');

function sourceFiles(dir) {
  return readdirSync(dir).flatMap(name => {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) return sourceFiles(path);
    return /\.(jsx?|tsx?)$/.test(name) && !name.endsWith('.test.ts') ? [path] : [];
  });
}

// A renamed or removed icon renders as an empty box at runtime, so every imported name must exist
test('every Lucide icon imported in src exists in lucide-react', () => {
  const missing = [];
  for (const file of sourceFiles(SRC)) {
    const text = readFileSync(file, 'utf8');
    for (const match of text.matchAll(/import\s*\{([^}]+)\}\s*from\s*['"]lucide-react['"]/g)) {
      for (const raw of match[1].split(',')) {
        const name = raw.trim().split(/\s+as\s+/)[0].trim();
        if (name && !(name in lucide)) missing.push(`${name} in ${file.slice(SRC.length + 1)}`);
      }
    }
  }
  assert.deepEqual(missing, []);
});
