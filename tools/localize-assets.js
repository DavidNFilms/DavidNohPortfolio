#!/usr/bin/env node
/**
 * localize-assets.js — pull the site's last third-party assets into the repo,
 * so a visitor's browser only ever talks to davidnoh.com until they press
 * play on a video.
 *
 *   node tools/localize-assets.js           fetch whatever is missing
 *   node tools/localize-assets.js --force   re-download everything
 *
 * What it fetches:
 *   1. Space Grotesk (the text typeface, SIL Open Font License) from Google
 *      Fonts  →  assets/fonts/SpaceGrotesk-latin.woff2
 *      Once that file exists the builder stops linking Google Fonts.
 *   2. The thumbnail of every project whose cover is a YouTube or Google
 *      Drive link (or blank)  →  assets/img/Projects/covers/auto/<slug>.jpg
 *      The builder prefers these over the remote URL. (Drive thumbnails in
 *      particular are unreliable when hot-linked.)
 *
 * Then run `node tools/build-projects.js` to rebuild with the local copies.
 *
 * Why bother: loading a font or image from Google sends each visitor's IP
 * address to Google, which EU regulators treat as personal data needing
 * consent. Self-hosting removes the question — and it's faster.
 *
 * No dependencies — just Node 18+.
 */

const fs   = require('fs');
const path = require('path');

const ROOT     = path.resolve(__dirname, '..');
const SRC      = path.join(ROOT, 'content', 'projects');
const FONT_OUT = path.join(ROOT, 'assets', 'fonts', 'SpaceGrotesk-latin.woff2');
const COVERS   = path.join(ROOT, 'assets', 'img', 'Projects', 'covers', 'auto');
const FORCE    = process.argv.includes('--force');
const UA = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126 Safari/537.36';

main().catch(err => { console.error(err); process.exit(1); });

async function main() {
  if (typeof fetch !== 'function') { console.error('This tool needs Node 18 or newer.'); process.exit(1); }
  await font();
  await covers();
  console.log('\nNow run:  node tools/build-projects.js');
}

async function get(url) {
  const res = await fetch(url, { headers: { 'User-Agent': UA }, redirect: 'follow' });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res;
}

async function font() {
  if (fs.existsSync(FONT_OUT) && !FORCE) { console.log('font   Space Grotesk already local'); return; }
  try {
    const css = await (await get('https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@300..700&display=swap')).text();
    // the stylesheet has one block per script; we want the basic Latin one
    const block = css.split('/*').find(b => /^\s*latin\s*\*\//.test(b)) || css;
    const url = (block.match(/url\((https:\/\/fonts\.gstatic\.com\/[^)]+\.woff2)\)/) || [])[1];
    if (!url) throw new Error('could not find the woff2 URL in the Google Fonts stylesheet');
    const buf = Buffer.from(await (await get(url)).arrayBuffer());
    if (buf.length < 10000 || buf.toString('ascii', 0, 4) !== 'wOF2') throw new Error('downloaded file is not a WOFF2 font');
    fs.mkdirSync(path.dirname(FONT_OUT), { recursive: true });
    fs.writeFileSync(FONT_OUT, buf);
    console.log(`font   saved ${path.relative(ROOT, FONT_OUT)}  (${Math.round(buf.length / 1024)} KB)`);
  } catch (err) {
    console.warn(`! font: ${err.message} — the site keeps using Google Fonts for now.`);
  }
}

async function covers() {
  if (!fs.existsSync(SRC)) return;
  fs.mkdirSync(COVERS, { recursive: true });

  for (const f of fs.readdirSync(SRC).filter(f => f.endsWith('.md') && !f.startsWith('_'))) {
    const head = (fs.readFileSync(path.join(SRC, f), 'utf8').match(/^﻿?---\s*\n([\s\S]*?)\n---/) || [])[1] || '';
    const field = name => ((head.match(new RegExp(`^${name}:[ \\t]*(.*)$`, 'm')) || [])[1] || '')
      .replace(/(^|\s)#.*$/, '$1').trim().replace(/^["']|["']$/g, '');
    const cover = field('cover');
    const video = field('video');
    const slug  = path.basename(f, '.md').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
    const out   = path.join(COVERS, `${slug}.jpg`);

    if (cover && !/^https?:\/\//i.test(cover)) continue;          // already a local file
    if (fs.existsSync(out) && !FORCE) { console.log(`cover  ${slug} already local`); continue; }

    const source = cover || video;
    const yt = source.match(/(?:youtube\.com\/(?:watch\?v=|embed\/|shorts\/|live\/)|youtu\.be\/|img\.youtube\.com\/vi\/)([\w-]+)/);
    const drive = /drive\.google\.com/.test(source) &&
      (source.match(/\/file\/d\/([\w-]+)/) || source.match(/[?&]id=([\w-]+)/));

    // best quality first; YouTube answers 404 for sizes a video doesn't have
    const candidates = yt
      ? ['maxresdefault', 'sddefault', 'hqdefault'].map(q => `https://img.youtube.com/vi/${yt[1]}/${q}.jpg`)
      : drive ? [`https://drive.google.com/thumbnail?id=${drive[1]}&sz=w1920`]
      : /\.(jpe?g|png|webp)(\?|$)/i.test(source) ? [source] : [];

    if (!candidates.length) { if (source) console.log(`cover  ${slug}: no downloadable thumbnail for this link — set \`cover\` by hand`); continue; }

    let saved = false;
    for (const url of candidates) {
      try {
        const res = await get(url);
        const type = res.headers.get('content-type') || '';
        const buf = Buffer.from(await res.arrayBuffer());
        if (!/^image\//.test(type) || buf.length < 5000) continue;   // an error page or placeholder
        fs.writeFileSync(out, buf);
        console.log(`cover  saved ${path.relative(ROOT, out)}  (${Math.round(buf.length / 1024)} KB)`);
        saved = true;
        break;
      } catch { /* try the next size */ }
    }
    if (!saved) console.warn(`! cover: could not download a thumbnail for ${f} — check the link is public, or set \`cover\` by hand.`);
  }
}
