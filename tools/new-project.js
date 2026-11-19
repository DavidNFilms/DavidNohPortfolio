#!/usr/bin/env node
/**
 * new-project.js — start a new project file without copying the template by hand.
 *
 *   node tools/new-project.js "Grand Canyon at Dawn"            (a photo project)
 *   node tools/new-project.js "Summer Reel" films               (a film)
 *   node tools/new-project.js "Summer Reel" films https://youtu.be/VIDEO_ID
 *
 * Creates content/projects/<slug>.md with today's date filled in, then tells
 * you what to do next. It never overwrites an existing file.
 */

const fs   = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const [title, sectionArg = 'photos', video = ''] = process.argv.slice(2);

if (!title) {
  console.log('Usage:  node tools/new-project.js "Project Title" [photos|films|xr] [video link]');
  process.exit(1);
}

const alias = { photo: 'photos', photos: 'photos', film: 'films', films: 'films', video: 'films', videos: 'films', xr: 'xr' };
const section = alias[sectionArg.toLowerCase()];
if (!section) { console.error(`Unknown section "${sectionArg}" — use photos, films or xr.`); process.exit(1); }

const slug = title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
const file = path.join(ROOT, 'content', 'projects', `${slug}.md`);
if (fs.existsSync(file)) { console.error(`${path.relative(ROOT, file)} already exists — nothing changed.`); process.exit(1); }

const d = new Date();
const today = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
const imgDir = `assets/img/Projects/${slug}`;

const md = `---
title:        ${title}
subtitle:
section:      ${section}          # photos | films | xr
category:                     # e.g. Documentary, Commercial, Reel, Short Film
date:         ${today}      # YYYY-MM-DD — newest projects list first
order:                        # optional: 10 pins to the top, -10 sends last
featured:                     # optional: true puts it on the home page

# Main image (path from the repo root, or a Google Drive share link).
# Films: leave blank to use the video's own thumbnail.
cover:        ${section === 'films' ? '' : `${imgDir}/cover.jpg`}

# Optional: one image, or a captioned list ("path | caption") for a
# Behind the Scenes section.
subphoto:

# Optional extra photos. Add "| caption" after any path to describe it.
gallery:

# Films only: YouTube, Vimeo, Google Drive, Instagram link or a local .mp4
video:        ${video}
aspect:                       # optional: 9:16 for vertical video, 2.39:1 for scope… (default 16:9)
---

Write the description here. Leave a blank line between paragraphs.
`;

fs.writeFileSync(file, md, 'utf8');
console.log(`Created ${path.relative(ROOT, file)}

Next:
  1. ${section === 'films' ? 'Fill in the subtitle, category and description.' : `Put your images in ${imgDir}/ and list them under cover / gallery.`}
  2. node tools/build-projects.js     build the page and its card
  3. node tools/serve.js              preview at http://localhost:4173/projects/${slug}.html
`);
