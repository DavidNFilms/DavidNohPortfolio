# Adding projects

New projects (photo **or** video) are written as Markdown files and turned
into styled pages by one command. No web knowledge required.

## The 3-step workflow

1. **Add your images** somewhere under `assets/img/` — e.g.
   `assets/img/projects/my-project/`.

2. **Create a Markdown file** in `content/projects/`. The quickest way is
   to copy `content/projects/_TEMPLATE.md` and rename it. The file name
   becomes the page address:
   `summer-reel.md` → `projects/summer-reel.html`.

   Fill in the fields at the top:

   | Field      | What it is                                                        |
   |------------|-------------------------------------------------------------------|
   | `title`    | The project title                                                 |
   | `subtitle` | One-line description under the title                              |
   | `section`  | Which portfolio it belongs to: `photos`, `films`, or `xr`        |
   | `date`     | `YYYY-MM-DD` — newer projects are listed first                    |
   | `cover`    | Main photo (also the thumbnail on the section page)              |
   | `subphoto` | *(optional)* a featured image shown large under the description  |
   | `gallery`  | *(optional)* a list of extra photos                              |
   | `video`    | *(video projects only)* a video link — see options below         |

   Anything you type below the second `---` is the description. Blank lines
   separate paragraphs; `**bold**`, `*italic*`, `[links](url)` and `##`
   subheadings all work.

3. **Run the builder** from the project root:

   ```
   node tools/build-projects.js
   ```

   That generates `projects/<name>.html` for every Markdown file and adds a
   card to the matching section page (Photos / Films). Re-run it any time —
   it always rebuilds from the current set of Markdown files.

## Photo vs. video

- **Leave `video` empty** → a *photo* project: full-bleed cover image at the
  top, then description, the optional feature subphoto, then the gallery.
- **Fill in `video`** → a *video* project: the video plays as the main
  element at the top of the page, with the description below.

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

## Removing a project

Delete its Markdown file from `content/projects/` and run the builder again.
Its page and card disappear automatically.

## Where things go

```
content/projects/*.md      ← you write these
tools/build-projects.js    ← the generator (run with node)
css/project.css            ← the look of the project pages
projects/*.html            ← generated output (don't edit by hand)
```

The card lists on the section pages are injected between
`<!-- PROJECTS:photos:START -->` / `<!-- PROJECTS:photos:END -->` marker
comments. To enable a new section (e.g. XR), put a matching pair of markers
inside that page's `.project-grid`.
