#!/usr/bin/env node
/**
 * add-content.js — quickly add photos or video projects to the site
 *
 * USAGE
 * ─────
 * Add photos to an EXISTING gallery series:
 *   node tools/add-content.js photo "Steps" img1.jpg img2.jpg
 *
 * Create a NEW photo gallery series:
 *   node tools/add-content.js photo "New Series" --new img1.jpg img2.jpg
 *
 * Add a video/film project:
 *   node tools/add-content.js video "Film Title" thumbnail.jpg
 *
 * HOW IT WORKS
 * ────────────
 * Photos: copies files into assets/img/still-moving/<Series>/
 *         then injects <figure> elements into Photos/blog.html
 *
 * Video:  copies thumbnail into assets/img/Project-grid/
 *         then injects a project card into Video/index.html
 */

const fs   = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const [,, type, ...rawArgs] = process.argv;

function usage() {
  console.log(`
USAGE
  node tools/add-content.js photo "<Series Name>" [--new] file1.jpg [file2.jpg ...]
  node tools/add-content.js video "<Film Title>" [thumbnail.jpg]

OPTIONS
  --new   (photo only) Create a brand-new gallery series

EXAMPLES
  node tools/add-content.js photo "Steps" photo1.jpg photo2.jpg
  node tools/add-content.js photo "Summer 2025" --new IMG_001.jpg IMG_002.jpg
  node tools/add-content.js video "Grand Canyon Reel" thumb.jpg
`);
}

if (!type || !['photo', 'video'].includes(type)) { usage(); process.exit(1); }

if (type === 'photo') addPhotos(rawArgs);
if (type === 'video') addVideo(rawArgs);

/* ─── PHOTOS ─────────────────────────────────────────────────── */

function addPhotos(args) {
  const isNew = args.includes('--new');
  const filtered = args.filter(a => a !== '--new');
  const [seriesName, ...files] = filtered;

  if (!seriesName || files.length === 0) {
    console.error('Error: series name and at least one image file required.');
    usage();
    process.exit(1);
  }

  // Resolve the series directory
  const seriesDir = path.join(ROOT, 'assets', 'img', 'still-moving', seriesName);

  if (isNew && fs.existsSync(seriesDir)) {
    console.warn(`Warning: series "${seriesName}" already exists. Files will be appended.`);
  }

  if (!fs.existsSync(seriesDir)) {
    fs.mkdirSync(seriesDir, { recursive: true });
    console.log(`Created:  ${path.relative(ROOT, seriesDir)}`);
  }

  // Determine next sequential index
  const existing = fs.readdirSync(seriesDir)
    .filter(f => /\.(jpg|jpeg|png|webp|JPG|JPEG|PNG|WEBP)$/.test(f));
  let nextIdx = existing.length + 1;

  // Copy files
  const copied = [];
  for (const srcFile of files) {
    const abs = path.resolve(srcFile);
    if (!fs.existsSync(abs)) {
      console.error(`Not found: ${srcFile}`);
      continue;
    }
    const ext  = path.extname(abs);
    const name = `${nextIdx}${ext}`;
    const dest = path.join(seriesDir, name);
    fs.copyFileSync(abs, dest);
    console.log(`Copied:   ${srcFile}  →  ${path.relative(ROOT, dest)}`);
    copied.push({ idx: nextIdx, name, ext });
    nextIdx++;
  }

  if (copied.length === 0) { console.error('No files copied.'); process.exit(1); }

  // Build the HTML snippet
  const relBase = `../assets/img/still-moving/${seriesName}`;
  const figures = copied.map(f =>
    `            <figure class="project-card"><img src="${relBase}/${f.name}" alt="${seriesName} ${f.idx}"></figure>`
  ).join('\n');

  // Inject into Photos/blog.html
  const blogPath = path.join(ROOT, 'Photos', 'blog.html');
  let html = fs.readFileSync(blogPath, 'utf8');

  // Try to find an existing section with this aria-label
  const sectionPattern = new RegExp(
    `(<section[^>]+aria-label="${escRx(seriesName)}"[^>]*>[\\s\\S]*?<div class="project-grid">)([\\s\\S]*?)(<\\/div>)`,
    'i'
  );

  if (sectionPattern.test(html)) {
    // Append inside the existing grid
    html = html.replace(sectionPattern, (_, open, content, close) =>
      `${open}${content}\n${figures}\n          ${close}`
    );
    console.log(`\n✓ Added ${copied.length} image(s) to "${seriesName}" in Photos/blog.html`);
  } else if (isNew) {
    // Insert a brand-new section block before </div>\n    </section>\n\n  </main>
    const newSection = `
        <!-- ${seriesName} -->
        <section class="project-block" aria-label="${seriesName}">
          <header class="project-header">
            <h2 class="section-title">${seriesName}</h2>
          </header>
          <div class="project-grid">
${figures}
          </div>
        </section>`;

    // Insert before the closing projects div
    const anchor = '      </div>\n    </section>\n\n  </main>';
    if (html.includes(anchor)) {
      html = html.replace(anchor, `      </div>\n    </section>\n${newSection}\n\n  </main>`);
      console.log(`\n✓ Created new section "${seriesName}" in Photos/blog.html with ${copied.length} image(s)`);
    } else {
      console.log('\nCould not auto-insert. Paste this block manually into Photos/blog.html:\n');
      console.log(newSection);
    }
  } else {
    console.log(`\nSection "${seriesName}" not found in blog.html.`);
    console.log('Re-run with --new to create it, or add these figures manually:\n');
    console.log(figures);
    process.exit(0);
  }

  fs.writeFileSync(blogPath, html, 'utf8');
  console.log(`Saved:    Photos/blog.html`);
}

/* ─── VIDEO ──────────────────────────────────────────────────── */

function addVideo(args) {
  const [title, thumbSrc] = args;

  if (!title) {
    console.error('Error: film title required.');
    usage();
    process.exit(1);
  }

  // Copy thumbnail if provided
  let thumbHref = '../assets/img/Project-grid/film.jpg'; // default fallback
  if (thumbSrc) {
    const abs = path.resolve(thumbSrc);
    if (!fs.existsSync(abs)) {
      console.warn(`Warning: thumbnail not found — using default.`);
    } else {
      const slug = title.replace(/[^a-zA-Z0-9]/g, '_').toLowerCase();
      const ext  = path.extname(abs);
      const name = `film_${slug}${ext}`;
      const dest = path.join(ROOT, 'assets', 'img', 'Project-grid', name);
      fs.copyFileSync(abs, dest);
      console.log(`Copied:   ${thumbSrc}  →  ${path.relative(ROOT, dest)}`);
      thumbHref = `../assets/img/Project-grid/${name}`;
    }
  }

  const card = `
          <a class="project-card" href="#">
            <img src="${thumbHref}" alt="${title}" />
            <span class="project-label">${title}</span>
          </a>`;

  // Inject into Video/index.html
  const videoPath = path.join(ROOT, 'Video', 'index.html');
  let html = fs.readFileSync(videoPath, 'utf8');

  const gridOpen = '<div class="project-grid">';
  if (html.includes(gridOpen)) {
    html = html.replace(gridOpen, `${gridOpen}\n${card}`);
    fs.writeFileSync(videoPath, html, 'utf8');
    console.log(`\n✓ Added "${title}" to Video/index.html`);
    console.log(`  Remember to update the href="#" with the real video link.`);
  } else {
    console.log('\nCould not find .project-grid in Video/index.html. Add this card manually:\n');
    console.log(card);
  }
}

/* ─── Helpers ────────────────────────────────────────────────── */
function escRx(s) { return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); }
