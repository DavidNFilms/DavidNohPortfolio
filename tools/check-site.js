#!/usr/bin/env node
/**
 * check-site.js — a quick pre-publish health check.
 *
 *   node tools/check-site.js        (or: npm run check)
 *
 * Walks every HTML page in the site and reports:
 *   • links, images, stylesheets and scripts that point at files that
 *     don't exist (including wrong upper/lower case, which works on a Mac
 *     but breaks on GitHub Pages)
 *   • #anchors that don't exist on the target page
 *   • pages missing a <title>, description, <h1>, lang, or <main>
 *   • images without an alt attribute, iframes without a title
 *   • anything loaded from a third-party host when the page opens
 *
 * Exits with code 1 if it finds a problem, so it can gate a publish.
 */

const fs   = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const SKIP = new Set(['.git', 'node_modules', '.claude', '.impeccable', 'content', 'tools']);

const problems = [];
const notes = [];
const pages = [];

walk(ROOT);
for (const file of pages) check(file);

const rel = f => path.relative(ROOT, f);
if (notes.length) {
  console.log(`Third-party requests made on page load (${notes.length}):`);
  const byHost = {};
  for (const n of notes) (byHost[n.host] = byHost[n.host] || new Set()).add(rel(n.file));
  for (const host of Object.keys(byHost).sort()) console.log(`  ${host}  ← ${byHost[host].size} page(s)`);
  console.log('');
}
if (problems.length) {
  console.log(`${problems.length} problem(s):`);
  for (const p of problems) console.log(`  ${rel(p.file)}: ${p.msg}`);
  process.exit(1);
}
console.log(`✓ ${pages.length} pages checked — no broken links, missing files or missing basics.`);

function walk(dir) {
  for (const name of fs.readdirSync(dir)) {
    if (SKIP.has(name)) continue;
    const abs = path.join(dir, name);
    const st = fs.statSync(abs);
    if (st.isDirectory()) walk(abs);
    else if (name.endsWith('.html')) pages.push(abs);
  }
}

// exists with EXACT case (macOS is case-insensitive; GitHub Pages is not)
function existsExact(abs) {
  if (!fs.existsSync(abs)) return false;
  let cur = abs;
  while (cur !== ROOT && cur.startsWith(ROOT)) {
    const dir = path.dirname(cur);
    if (!fs.readdirSync(dir).includes(path.basename(cur))) return false;
    cur = dir;
  }
  return true;
}

function ids(file) {
  const html = fs.readFileSync(file, 'utf8');
  return new Set([...html.matchAll(/\sid="([^"]+)"/g)].map(m => m[1]));
}

function check(file) {
  const html = fs.readFileSync(file, 'utf8');
  const bad = msg => problems.push({ file, msg });
  const isRedirect = /http-equiv="refresh"/i.test(html);

  if (!isRedirect) {
    if (!/<html[^>]*\slang="/i.test(html)) bad('missing <html lang>');
    if (!/<title>[^<]+<\/title>/i.test(html)) bad('missing <title>');
    if (!/<meta\s+name="description"/i.test(html) && !/name="robots" content="noindex"/.test(html)) bad('missing meta description');
    if ((html.match(/<h1[\s>]/g) || []).length !== 1) bad(`expected exactly one <h1>, found ${(html.match(/<h1[\s>]/g) || []).length}`);
    if (!/<main[\s>]/.test(html)) bad('missing <main>');
    for (const m of html.matchAll(/<img\b[^>]*>/g)) if (!/\salt="/.test(m[0])) bad(`<img> without alt: ${m[0].slice(0, 80)}`);
    for (const m of html.matchAll(/<iframe\b[^>]*>/g)) if (!/\stitle="/.test(m[0])) bad('<iframe> without title');
    for (const marker of html.matchAll(/<!-- ([A-Z]+:[a-z]+):START -->/g)) {
      if (!html.includes(`<!-- ${marker[1]}:END -->`)) bad(`marker ${marker[1]}:START has no matching END`);
    }
  }

  const refs = [];
  for (const m of html.matchAll(/<(a|link|script|img|video|source|iframe)\b[^>]*>/g)) {
    const tag = m[0];
    const kind = m[1];
    for (const a of ['href', 'src', 'poster']) {
      const v = (tag.match(new RegExp(`\\s${a}="([^"]*)"`)) || [])[1];
      if (v != null) refs.push({ kind, url: v, tag });
    }
    const srcset = (tag.match(/\ssrcset="([^"]*)"/) || [])[1];
    if (srcset) for (const part of srcset.split(',')) refs.push({ kind, url: part.trim().split(/\s+/)[0], tag });
  }

  const own = ids(file);
  for (const r of refs) {
    const url = r.url.replace(/&amp;/g, '&');
    if (!url || /^(mailto:|tel:|data:|javascript:)/i.test(url)) continue;

    if (/^(https?:)?\/\//i.test(url)) {
      // links you click are fine; things the page loads by itself are noted
      const loads = r.kind !== 'a' && !(r.kind === 'link' && /rel="(canonical|preconnect)"/.test(r.tag));
      if (loads) { try { notes.push({ file, host: new URL(url, 'https://x').host }); } catch { /* ignore */ } }
      continue;
    }

    const [pathPart, hash] = url.split('#');
    const clean = decodeURIComponent(pathPart.split('?')[0]);
    let target = file;
    if (clean) {
      target = clean.startsWith('/') ? path.join(ROOT, clean) : path.resolve(path.dirname(file), clean);
      if (fs.existsSync(target) && fs.statSync(target).isDirectory()) target = path.join(target, 'index.html');
      if (!existsExact(target)) { bad(`broken ${r.kind} → ${url}`); continue; }
    }
    if (hash && target.endsWith('.html')) {
      const targetIds = target === file ? own : ids(target);
      if (!targetIds.has(hash)) bad(`anchor #${hash} not found in ${rel(target)}`);
    }
  }
}
