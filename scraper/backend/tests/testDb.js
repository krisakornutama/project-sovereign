// testDb.js — give every test file its own database file.
//
// `node --test` runs each test file as a separate process, but they share the
// working directory and therefore the same scraper-data.sqlite. That made one
// file's clearStore() wipe another's fixture mid-test, which surfaced as
// nonsense failures like "expected 402, got 201".
//
// Import this BEFORE anything that pulls in store.js / billing.js. It sets
// SCRAPER_DB_PATH to a file named after the calling test file, so each gets an
// isolated database. It also deletes the file on exit.

import { rmSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, basename, join } from 'node:path';

const here = dirname(fileURLToPath(import.meta.url));
const testFile = basename(process.argv[1] || 'unknown.test.js').replace(/\.js$/, '');
const path = join(here, '..', `.tmp-test-${testFile}.sqlite`);

process.env.SCRAPER_DB_PATH = path;

const cleanup = () => {
  for (const suffix of ['', '-wal', '-shm']) {
    try {
      rmSync(path + suffix, { force: true });
    } catch {
      // A leftover temp file is not worth failing a test run over.
    }
  }
};

cleanup();
process.on('exit', cleanup);
process.on('SIGINT', () => {
  cleanup();
  process.exit(130);
});

export const TEST_DB_PATH = path;