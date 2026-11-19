/**
 * images.js — responsive image pipeline used by build-projects.js.
 *
 * For every local image a page references, this makes a few resized WebP
 * copies in assets/img/_opt/ and reports the image's real pixel size, so the
 * builder can emit `srcset` / `sizes` / `width` / `height`. Phones then
 * download a ~60 KB frame instead of a 16 MB camera original, and pages stop
 * jumping around while images load.
 *
 * Results are cached in assets/img/_opt/manifest.json (keyed on the source
 * file's size + a content fingerprint), so only new or changed images are
 * re-encoded.
 *
 * Needs `cwebp` on the PATH (macOS: `brew install webp`). Without it the
 * builder still works — images just fall back to their originals.
 */

const fs     = require('fs');
const path   = require('path');
const crypto = require('crypto');
const { execFileSync } = require('child_process');

const ROOT     = path.resolve(__dirname, '..', '..');
const OPT_REL  = 'assets/img/_opt';
const OPT_DIR  = path.join(ROOT, OPT_REL);
const MANIFEST = path.join(OPT_DIR, 'manifest.json');
const WIDTHS   = [160, 480, 960, 1600, 2400];

let manifest = null;
let dirty    = false;
let cwebpOk  = null;
let sipsOk   = null;
const stats  = { encoded: 0, reused: 0, skipped: 0 };

function has(cmd, args) {
  try { execFileSync(cmd, args, { stdio: 'ignore' }); return true; } catch { return false; }
}
function haveCwebp() { if (cwebpOk === null) cwebpOk = has('cwebp', ['-version']); return cwebpOk; }
function haveSips()  { if (sipsOk  === null) sipsOk  = process.platform === 'darwin' && has('sips', ['--version']); return sipsOk; }

function load() {
  if (manifest) return manifest;
  try { manifest = JSON.parse(fs.readFileSync(MANIFEST, 'utf8')); } catch { manifest = {}; }
  return manifest;
}

function save() {
  if (!dirty) return;
  fs.mkdirSync(OPT_DIR, { recursive: true });
  const sorted = {};
  for (const k of Object.keys(manifest).sort()) sorted[k] = manifest[k];
  fs.writeFileSync(MANIFEST, JSON.stringify(sorted, null, 1) + '\n', 'utf8');
  dirty = false;
}

// cheap, stable fingerprint: size + first 256 KB (survives fresh git clones,
// unlike mtime)
function fingerprint(abs) {
  const size = fs.statSync(abs).size;
  const fd = fs.openSync(abs, 'r');
  const buf = Buffer.alloc(Math.min(size, 262144));
  fs.readSync(fd, buf, 0, buf.length, 0);
  fs.closeSync(fd);
  return size + ':' + crypto.createHash('sha1').update(buf).digest('hex').slice(0, 16);
}

// pixel size straight from the file header — PNG, JPEG or WebP
function dimensions(abs) {
  const fd = fs.openSync(abs, 'r');
  try {
    const head = Buffer.alloc(32);
    fs.readSync(fd, head, 0, 32, 0);

    if (head.readUInt32BE(0) === 0x89504e47) {                       // PNG
      return { width: head.readUInt32BE(16), height: head.readUInt32BE(20) };
    }
    if (head.toString('ascii', 0, 4) === 'RIFF' && head.toString('ascii', 8, 12) === 'WEBP') {
      const kind = head.toString('ascii', 12, 16);
      if (kind === 'VP8X') return { width: 1 + head.readUIntLE(24, 3), height: 1 + head.readUIntLE(27, 3) };
      if (kind === 'VP8 ') return { width: head.readUInt16LE(26) & 0x3fff, height: head.readUInt16LE(28) & 0x3fff };
      if (kind === 'VP8L') {
        const b = head.readUInt32LE(21);
        return { width: (b & 0x3fff) + 1, height: ((b >> 14) & 0x3fff) + 1 };
      }
    }
    if (head[0] === 0xff && head[1] === 0xd8) {                      // JPEG: walk to the SOF marker
      const size = fs.fstatSync(fd).size;
      let pos = 2;
      const seg = Buffer.alloc(9);
      while (pos < size) {
        fs.readSync(fd, seg, 0, 9, pos);
        if (seg[0] !== 0xff) { pos++; continue; }
        const marker = seg[1];
        if (marker === 0xff) { pos++; continue; }
        const isSof = marker >= 0xc0 && marker <= 0xcf && ![0xc4, 0xc8, 0xcc].includes(marker);
        if (isSof) return { width: seg.readUInt16BE(7), height: seg.readUInt16BE(5) };
        pos += 2 + seg.readUInt16BE(2);
      }
    }
  } finally { fs.closeSync(fd); }
  return null;
}

// "assets/img/Photo Dump/Shot 1.png" -> "assets/img/_opt/Photo-Dump/Shot-1"
// (no spaces: a space is the separator inside srcset)
function outBase(rel) {
  const inner = rel.replace(/^assets\/img\//, '').replace(/^assets\//, '');
  const noExt = inner.replace(/\.[^./]+$/, '');
  return OPT_REL + '/' + noExt.replace(/[^A-Za-z0-9._/-]+/g, '-');
}

/**
 * Make sure the resized copies of one image exist.
 * `rel` is a path from the repo root, e.g. "assets/img/hero.jpg".
 * Returns { width, height, variants: [{ w, url }], full } or null.
 */
function ensure(rel) {
  rel = String(rel).replace(/\\/g, '/').replace(/^\.?\/+/, '');
  if (!/\.(jpe?g|png|webp)$/i.test(rel) || rel.startsWith(OPT_REL)) return null;
  const abs = path.join(ROOT, rel);
  if (!fs.existsSync(abs)) return null;

  const m = load();
  const fp = fingerprint(abs);
  const cached = m[rel];
  if (cached && cached.fp === fp &&
      cached.widths.every(w => fs.existsSync(path.join(ROOT, `${cached.base}-${w}.webp`)))) {
    stats.reused++;
    return shape(cached);
  }

  const dim = dimensions(abs);
  if (!dim || !dim.width) { stats.skipped++; return null; }

  const base = outBase(rel);
  const entry = { fp, base, width: dim.width, height: dim.height, widths: [] };

  if (haveCwebp()) {
    const top = Math.min(dim.width, WIDTHS[WIDTHS.length - 1]);
    const widths = WIDTHS.filter(w => w < top).concat(top);
    const isPng = /\.png$/i.test(rel);
    fs.mkdirSync(path.dirname(path.join(ROOT, base)), { recursive: true });
    for (const w of widths) {
      const out = path.join(ROOT, `${base}-${w}.webp`);
      const args = ['-quiet', '-q', isPng ? '84' : '78', '-m', '6', '-resize', String(w), '0', abs, '-o', out];
      if (isPng) args.unshift('-alpha_q', '92');
      try { execFileSync('cwebp', args, { stdio: 'ignore' }); entry.widths.push(w); }
      catch { /* leave this width out */ }
    }
    stats.encoded++;
  } else {
    stats.skipped++;
  }

  m[rel] = entry;
  dirty = true;
  return shape(entry);
}

function shape(e) {
  const variants = e.widths.map(w => ({ w, url: `${e.base}-${w}.webp` }));
  return { width: e.width, height: e.height, variants, full: variants.length ? variants[variants.length - 1].url : '' };
}

// the variant closest to (and not below, when possible) a wanted width
function pick(rel, want) {
  const info = ensure(rel);
  if (!info || !info.variants.length) return '';
  const v = info.variants.find(x => x.w >= want) || info.variants[info.variants.length - 1];
  return v.url;
}

/**
 * A 1200px-wide JPEG for link previews (iMessage, Slack, LinkedIn…), which
 * don't reliably accept WebP. macOS only (uses the built-in `sips`).
 */
function socialImage(rel) {
  rel = String(rel).replace(/\\/g, '/').replace(/^\.?\/+/, '');
  const abs = path.join(ROOT, rel);
  if (!fs.existsSync(abs)) return '';
  const out = `${outBase(rel)}-og.jpg`;
  const outAbs = path.join(ROOT, out);
  const m = load();
  const key = `og:${rel}`;
  const fp = fingerprint(abs);
  if (m[key] && m[key].fp === fp && fs.existsSync(outAbs)) return out;
  if (!haveSips()) return fs.existsSync(outAbs) ? out : '';
  try {
    fs.mkdirSync(path.dirname(outAbs), { recursive: true });
    execFileSync('sips', ['-s', 'format', 'jpeg', '-s', 'formatOptions', '82', '-Z', '1200', abs, '--out', outAbs], { stdio: 'ignore' });
    m[key] = { fp };
    dirty = true;
    return out;
  } catch { return ''; }
}

/**
 * Add srcset / sizes / width / height (and data-full, for the lightbox) to
 * every local <img> in a page. Safe to run repeatedly — it replaces whatever
 * it wrote last time.
 *
 * `prefix` is how that page reaches the repo root: "", "../" or "/".
 * Put data-sizes="…" on an <img> to say how wide it is displayed
 * (defaults to the full viewport width).
 */
function enhanceHtml(html, prefix) {
  return html.replace(/<img\b[^>]*>/g, tag => {
    const src = attr(tag, 'src');
    if (!src || /^(https?:)?\/\//i.test(src) || src.startsWith('data:')) return tag;

    let rel = src.split(/[?#]/)[0];
    if (prefix && rel.startsWith(prefix)) rel = rel.slice(prefix.length);
    rel = rel.replace(/^(\.\.\/)+/, '').replace(/^\/+/, '');
    try { rel = decodeURIComponent(rel); } catch { /* keep as written */ }

    const info = ensure(rel);
    if (!info) return tag;

    let out = tag;
    for (const a of ['srcset', 'sizes', 'width', 'height', 'data-full']) out = dropAttr(out, a);
    const add = [`width="${info.width}"`, `height="${info.height}"`];
    if (info.variants.length) {
      const sizes = attr(tag, 'data-sizes') || '100vw';
      add.push(`srcset="${info.variants.map(v => `${prefix}${v.url} ${v.w}w`).join(', ')}"`);
      add.push(`sizes="${sizes}"`);
      add.push(`data-full="${prefix}${info.full}"`);
    }
    return out.replace(/\s*\/?>$/, ` ${add.join(' ')} />`);
  });
}

function attr(tag, name) {
  const m = tag.match(new RegExp(`\\s${name}="([^"]*)"`, 'i'));
  return m ? m[1] : '';
}
function dropAttr(tag, name) {
  return tag.replace(new RegExp(`\\s${name}="[^"]*"`, 'gi'), '');
}

module.exports = { ensure, pick, socialImage, enhanceHtml, save, stats, haveCwebp, OPT_REL };
