#!/usr/bin/env node
/**
 * fetch-ig-covers.js — download the cover frame for each Instagram post/reel
 * listed in content/nyu-athletics.md so the NYU Athletics wall can show them
 * as plain images (no Instagram embed chrome).
 *
 *   node tools/fetch-ig-covers.js
 *
 * Covers are saved to assets/img/nyu-athletics/<shortcode>.jpg and are only
 * fetched when missing, so re-running is cheap. Run this whenever you add new
 * links, then run tools/build-projects.js to rebuild the page.
 *
 * Some posts (private, age-gated, or freshly posted) don't expose a public
 * cover — those are reported and left for you to drop in a JPG manually at
 * assets/img/nyu-athletics/<shortcode>.jpg.
 *
 * No dependencies — just Node.
 */

const fs    = require('fs');
const path  = require('path');
const https = require('https');

const ROOT    = path.resolve(__dirname, '..');
const SRC     = path.join(ROOT, 'content', 'nyu-athletics.md');
const OUT_DIR = path.join(ROOT, 'assets', 'img', 'nyu-athletics');
const MIN_BYTES = 5000; // smaller than this = Instagram's placeholder, not a real cover
const UA = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 ' +
           '(KHTML, like Gecko) Chrome/120 Safari/537.36';

main();

async function main() {
  if (!fs.existsSync(SRC)) { console.error(`No ${path.relative(ROOT, SRC)}.`); process.exit(1); }
  fs.mkdirSync(OUT_DIR, { recursive: true });

  const codes = shortcodes(fs.readFileSync(SRC, 'utf8'));
  if (!codes.length) { console.log('No Instagram links found in nyu-athletics.md.'); return; }

  let fetched = 0, kept = 0;
  const failed = [];
  for (const code of codes) {
    const dest = path.join(OUT_DIR, `${code}.jpg`);
    if (fs.existsSync(dest) && fs.statSync(dest).size >= MIN_BYTES) { kept++; continue; }
    try {
      const buf = await download(`https://www.instagram.com/p/${code}/media/?size=l`);
      if (buf.length < MIN_BYTES) { failed.push(code); continue; }
      fs.writeFileSync(dest, buf);
      fetched++;
      console.log(`cover  ${code}.jpg   (${Math.round(buf.length / 1024)} KB)`);
    } catch (e) {
      failed.push(code);
    }
  }

  console.log(`\nDone — ${fetched} fetched, ${kept} already present.`);
  if (failed.length) {
    console.warn(`\n! No public cover for: ${failed.join(', ')}`);
    console.warn(`  Drop a JPG for each at assets/img/nyu-athletics/<shortcode>.jpg`);
  }
}

// pull post/reel shortcodes out of the file, in order (skipping comment lines
// so example URLs in the header don't get treated as real posts)
function shortcodes(text) {
  const out = [];
  const re = /instagram\.com\/(?:reel|reels|p|tv)\/([\w-]+)/i;
  for (const line of text.split('\n')) {
    if (line.trim().startsWith('#')) continue;
    const m = line.match(re);
    if (m && !out.includes(m[1])) out.push(m[1]);
  }
  return out;
}

// GET with redirect-following, resolving to the response body as a Buffer
function download(url, depth = 0) {
  return new Promise((resolve, reject) => {
    if (depth > 5) return reject(new Error('too many redirects'));
    https.get(url, { headers: { 'User-Agent': UA } }, res => {
      if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        res.resume();
        return resolve(download(res.headers.location, depth + 1));
      }
      if (res.statusCode !== 200) { res.resume(); return reject(new Error(`HTTP ${res.statusCode}`)); }
      const chunks = [];
      res.on('data', c => chunks.push(c));
      res.on('end', () => resolve(Buffer.concat(chunks)));
    }).on('error', reject);
  });
}
