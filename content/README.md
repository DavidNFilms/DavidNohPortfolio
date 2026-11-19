# How this site works

Everything is plain HTML, CSS and one small script. One command builds it:

```
node tools/build-projects.js
```

| Command                          | What it does                                                        |
|----------------------------------|---------------------------------------------------------------------|
| `node tools/build-projects.js`   | Build everything (pages, cards, images, sitemap). Safe to re-run.   |
| `node tools/serve.js`            | Preview at http://localhost:4173 exactly as GitHub Pages serves it. |
| `node tools/check-site.js`       | Find broken links, missing files and missing alt text before you push. |
| `node tools/new-project.js "Title" films` | Start a new project file with today's date filled in.      |
| `node tools/fetch-ig-covers.js`  | Download cover frames for the NYU Athletics wall.                   |
| `node tools/localize-assets.js`  | Self-host the font and YouTube/Drive thumbnails (see Privacy below). |

(`npm run build`, `npm run dev`, `npm run check` are shortcuts for the first three.)

**Publishing:** build, check, commit, push. GitHub Pages serves the repo as-is.

## What the builder owns, and what you edit

| You edit                                   | The builder writes                                   |
|--------------------------------------------|------------------------------------------------------|
| `content/projects/*.md` (one per project)  | `projects/*.html`, the cards on Films / Photo / XR / home, the filter chips |
| `content/nyu-athletics.md`                 | `Athletics/index.html`                               |
| `index.html`, `Video/`, `Photos/`, `XR/`, `About/about.html`, `404.html` — the parts **outside** the marker comments | everything **between** `<!-- SHARED:…:START -->` and `<!-- SHARED:…:END -->` (the `<head>` tags, navigation, contact block, footer) and between the `PROJECTS:` / `FILTERS:` markers |
| `css/*.css`, `js/main.js`                  | `privacy/index.html`, `sitemap.xml`, `assets/img/_opt/` |

The navigation, contact details and footer live in ONE place — the `SITE` and
`NAV` blocks at the top of `tools/build-projects.js`. Change your email or add
a nav link there and every page updates on the next build.

To add a brand-new hand-written page: copy `XR/index.html`, keep the three
pairs of `SHARED` markers, and add the file to the `PAGES` list in the builder.

## Images: drop in the original, the builder does the rest

Reference your full-size JPG or PNG. On build, every image a page uses gets
resized WebP copies in `assets/img/_opt/` plus `srcset`, `width` and `height`,
so a phone downloads a ~50 KB frame instead of a 16 MB camera original. Commit
the `_opt` folder — it is what visitors actually load.

- Needs `cwebp` once: `brew install webp`. Without it the build still works,
  images are just served at full size.
- Export photos upright (no "rotate on display" flag) — `cwebp` ignores it.
- On a hand-written `<img>`, add `data-sizes="…"` to say how wide it displays
  (e.g. `data-sizes="(min-width: 821px) 33vw, 100vw"`). Default: full width.
- A photo that crops badly in a wide or tall frame can be steered with
  `style="--focus: 50% 30%"` (horizontal, vertical) on hero and card images.

## Privacy: why videos are click-to-play

No YouTube, Drive, Vimeo or Instagram player loads until a visitor presses
play — the page shows your cover with a play button. That keeps pages fast and
means no third party sets cookies on page load, which is why the site needs no
cookie banner. `privacy/index.html` is generated from what the site really
does, so it stays accurate as you add projects.

Run `node tools/localize-assets.js` after adding a film with a YouTube or Drive
thumbnail to copy that thumbnail into the repo.

# Adding projects

New projects (photo **or** video) are written as Markdown files and turned
into styled pages by one command. No web knowledge required.

## The 3-step workflow

1. **Add your images** somewhere under `assets/img/` — e.g.
   `assets/img/Projects/my-project/`.

2. **Create a Markdown file** in `content/projects/` — run
   `node tools/new-project.js "My Project" films`, or copy
   `content/projects/_TEMPLATE.md`. The file name becomes the page address:
   `summer-reel.md` → `projects/summer-reel.html`.

   Fill in the fields at the top:

   | Field      | What it is                                                        |
   |------------|-------------------------------------------------------------------|
   | `title`    | The project title                                                 |
   | `subtitle` | One-line description under the title (also shown on the card)     |
   | `section`  | Which portfolio it belongs to: `photos`, `films`, or `xr`        |
   | `category` | *(optional)* e.g. `Documentary`, `Commercial`, `Reel`, `Short Film`. Shown on the card; the Films page builds its filter chips from these |
   | `date`     | `YYYY-MM-DD` — newer projects are listed first                    |
   | `order`    | *(optional)* pin/force order — higher floats to the top, negative sinks to the bottom, blank = by date |
   | `featured` | *(optional)* `true` puts it in "Latest films" on the home page (which otherwise shows the three newest films) |
   | `cover`    | Main photo (also the thumbnail on the section page). *(optional for video projects — see below)* |
   | `subphoto` | *(optional)* a featured image under the description, or a captioned "Behind the Scenes" list — see below |
   | `gallery`  | *(optional)* a list of extra photos. Add ` | caption` after a path to describe it (used as alt text and in the full-screen viewer) |
   | `video`    | *(video projects only)* a video link — see options below         |
   | `aspect`   | *(optional, video)* the film's shape: `9:16` vertical, `1:1`, `4:3`, `2.39:1`… Default `16:9` (Instagram and YouTube Shorts default to `9:16`). The player always fits the screen. |

   Anything you type below the second `---` is the description. Blank lines
   separate paragraphs; `**bold**`, `*italic*`, `[links](url)` and `##`
   subheadings all work.

3. **Run the builder** from the project root:

   ```
   node tools/build-projects.js
   ```

   That generates `projects/<name>.html` for every Markdown file and adds a
   card to the matching section page. Re-run it any time — it always rebuilds
   from the current set of Markdown files. A section with no projects yet
   (Photo, XR) shows an "In production" note that disappears on its own as
   soon as its first project exists.

## Photo vs. video

- **Leave `video` empty** → a *photo* project: full-bleed cover image at the
  top, then description, the optional subphoto/process section, then the
  gallery.
- **Fill in `video`** → a *video* project: the title, then the video as the
  main element (your cover is its poster frame, with a play button), with
  the description below, then the optional subphoto/process section, then
  the gallery. Gallery and behind-the-scenes images open full screen.

### Subphoto: plain feature image, or a captioned "Behind the Scenes" section

`subphoto` works two ways:

```
# one plain image, no caption — shown large, full-width, no heading
subphoto: assets/img/projects/foo/feature.jpg

# a captioned list — rendered as a "Behind the Scenes" section, good for
# storyboards, drafts, or on-set photos you want to describe
subphoto:
  - assets/img/projects/foo/storyboard.jpg | Early storyboard mapping out the shot flow.
  - assets/img/projects/foo/set.jpg | On set, testing the framing before the shoot.
```

Any single entry with a caption (or more than one entry) switches to the
captioned layout automatically.

  Accepted `video` links:

  | Source            | Example                                            |
  |-------------------|----------------------------------------------------|
  | YouTube (public)  | `https://youtu.be/VIDEO_ID`                        |
  | YouTube (unlisted)| `https://youtu.be/VIDEO_ID` *(same link — just paste the share URL)* |
  | Instagram reel    | `https://www.instagram.com/reel/REEL_ID/`          |
  | Google Drive      | `https://drive.google.com/file/d/FILE_ID/view`     |
  | Vimeo             | `https://vimeo.com/VIDEO_ID`                        |
  | Local file        | `assets/img/projects/foo/clip.mp4`                 |

  Unlisted YouTube videos embed exactly like public ones — they just won't
  appear in search or your channel. Instagram reels render in a centered
  portrait player (the reel must be on a **public** account to embed).
  For Google Drive, set the file's sharing to **"Anyone with the link"** and
  paste the normal share URL — the builder converts it to an embedded player.

  **Leave `cover` blank on a video project** and the builder fills it in
  automatically from the video itself — a YouTube link uses that video's
  thumbnail, a Drive link uses Drive's own generated thumbnail. Vimeo,
  Instagram, and local video files don't have a predictable thumbnail URL,
  so those still need a `cover` set by hand (the builder warns if one's
  missing and it can't auto-fill it).

Image paths are always written from the repo root (e.g.
`assets/img/projects/foo/cover.jpg`) — the builder fixes up the relative
paths for you.

### Images from Google Drive

Any image field (`cover`, `subphoto`, or a `gallery` entry) also accepts a
Google Drive share link instead of a local path:

```
cover: https://drive.google.com/file/d/FILE_ID/view?usp=sharing
gallery:
  - https://drive.google.com/file/d/FILE_ID_1/view
  - assets/img/projects/foo/2.jpg     # mix local + Drive freely
```

Set the Drive file's sharing to **"Anyone with the link"**, and the builder
converts it into a direct image URL automatically.

## Ordering & pinning

By default projects are listed **newest first** (by `date`). To override that,
set the optional `order` field:

- `order: 10` — **pin to the top.** Higher numbers float higher, so `order: 20`
  sits above `order: 10`.
- `order: -10` — **force to the bottom.** Any negative number sinks below the
  normal date-sorted projects.
- *(blank)* — normal behavior: sorted by `date`, newest first.

Projects with the same `order` fall back to date (newest first). The order also
drives the `01 / 02 / 03` numbers on the section pages, so pinning a project
moves both its position and its number. Re-run the builder after changing it.

## Removing a project

Delete its Markdown file from `content/projects/` and run the builder again.
Its page and card disappear automatically.

## Where things go

```
content/projects/*.md      ← you write these
content/nyu-athletics.md   ← the Athletics wall's link list
tools/build-projects.js    ← the generator (run with node)
tools/lib/images.js        ← the image resizer the generator uses
css/styles.css             ← the whole site's look (tokens at the top)
css/project.css            ← the look of the project pages
css/athletics.css          ← the NYU Athletics wall
js/main.js                 ← menu, filters, click-to-play, lightbox
projects/*.html            ← generated output (don't edit by hand)
assets/img/_opt/           ← generated image sizes (commit, don't edit)
```

The card lists on the section pages are injected between
`<!-- PROJECTS:photos:START -->` / `<!-- PROJECTS:photos:END -->` marker
comments (likewise `films`, `xr`, and `featured` on the home page).
