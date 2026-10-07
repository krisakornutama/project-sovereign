import { readFileSync, writeFileSync, readdirSync } from 'node:fs';
import { join, relative } from 'node:path';

const ROOT = process.argv[2];
if (!ROOT) {
  console.error('Usage: node update-site-urls.mjs <root-dir>');
  process.exit(1);
}

const OLD = 'krisakornutama.github.io/project-sovereign';
const NEW = 'sovereignoriginshop.dpdns.org';
const HTTP_OLD = 'http://sovereignoriginshop.dpdns.org';
const HTTPS_NEW = 'https://sovereignoriginshop.dpdns.org';

function walk(dir, list = []) {
  for (const e of readdirSync(dir, { withFileTypes: true })) {
    const p = join(dir, e.name);
    if (e.isDirectory()) {
      if (e.name !== 'node_modules' && e.name !== '.git' && e.name !== '.freebuff') {
        walk(p, list);
      }
    } else if (
      e.name.endsWith('.html') ||
      e.name === 'robots.txt' ||
      e.name === 'sitemap.xml'
    ) {
      list.push(p);
    }
  }
  return list;
}

let modifiedCount = 0;
let totalReplacements = 0;

const files = walk(ROOT);
for (const f of files) {
  const rel = relative(ROOT, f);
  const txt = readFileSync(f, 'utf8');

  let next = txt;
  let count = 0;

  // 1) แทนที่ repo URL
  const repoRe = new RegExp(OLD.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g');
  const repoMatches = next.match(repoRe);
  if (repoMatches) {
    count += repoMatches.length;
    next = next.replaceAll(OLD, NEW);
  }

  // 2) แทนที่ http://sovereignoriginshop.dpdns.org → https://
  const httpRe = new RegExp(HTTP_OLD.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g');
  const httpMatches = next.match(httpRe);
  if (httpMatches) {
    count += httpMatches.length;
    next = next.replaceAll(HTTP_OLD, HTTPS_NEW);
  }

  if (count > 0) {
    writeFileSync(f, next, 'utf8');
    console.log(`✓ ${rel}: ${count} replacement(s)`);
    modifiedCount++;
    totalReplacements += count;
  } else {
    console.log(`- ${rel}: no change`);
  }
}

console.log(`\nDone: ${modifiedCount} file(s) modified, ${totalReplacements} total replacement(s)`);
