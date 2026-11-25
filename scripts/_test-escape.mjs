import { readFileSync, writeFileSync } from 'node:fs';

function escapeBodyContent(html) {
  return html.replace(/&(?!#\d+;|#x[0-9a-fA-F]+;|\w+;)/g, '&amp;');
}

const body = '<a href="farm.html">เกษตร & สมุนไพร</a>';
const escaped = escapeBodyContent(body);
console.log('input:', body);
console.log('output:', escaped);
console.log('match?', body.match(/&(?!#\d+;|#x[0-9a-fA-F]+;|\w+;)/g));
