---
name: true-crime-3d-doc
description: The owner's own end-to-end pipeline for making narrated, Fern-style true-crime / history documentaries as fully 3D-animated films (HyperFrames + three.js + realistic Rocketbox humans, period cars, B&W archival scenes), plus captions, thumbnail, YouTube title/description/tags and delivery. Load this for ANY request to make, extend, fix, caption, deliver or publish a documentary or story video in this style, including "make a video about <case>", "do the next case", "add captions", "make the thumbnail", "write the YouTube description", or feedback on a previous film. Also load it when the user says to remember or improve "the way we make videos".
---

# True-crime 3D documentary pipeline

This is the workflow behind **THE 38** (Kitty Genovese, 10:26, Oct 2026). It turns a case into a narrated documentary where every shot is a moving 3D scene. Reuse the engine and scripts here, follow the phases in order, and record what you learn in `LESSONS.md` (see the last section).

## The owner's standing preferences

These came from the owner's feedback. Treat them as requirements unless they say otherwise.

- **Style:** a YouTube documentary in the style of channels like Fern. Tell the case as a story: thrilling, suspenseful, with fear, shock, and in the end accountability. Never "immature" or cartoonish.
- **Motion:** every frame moves. No still frames and no slideshow. Camera dollies, cranes, handheld shake and parallax are always running.
- **3D quality:** no 2D-looking buildings (use real depth, brick textures, window glass and interiors). Use realistic humans (Rocketbox avatars in real clothes), never mannequins or robots. Cars must look like real period cars (lofted bodies, chrome, whitewalls, interiors, plates), never toy-like.
- **Archival look:** include some black-and-white "original footage" scenes, using the B&W grade with gate weave, flicker, scratches and dust.
- **Rights:** never use copyrighted clips or photos. Reference images the owner sends are style references only. A real photo goes in only after you verify it is public domain or freely licensed, and you name the licence to the owner.
- **Process:** show a short sample for approval before the full film. Deliver chapters as they finish rather than one file at the end. Be upfront about render time.
- **Deliverables they expect:** 1080p film with burned-in captions, an `.srt` file, a thumbnail, YouTube title, description and tags, and a recommended category (Education).
- **Writing:** YouTube text must read as written by a person. No "AI slop": no em-dashes, no hype words ("chilling", "shocking", "you won't believe"), no emoji bullets, no "in this video we'll explore".

## Phases (do them in this order)

| # | Phase | Output | Gate |
|---|---|---|---|
| 1 | Research and script | `script.json`, sourced facts | Facts checked against two or more sources |
| 2 | Narration | `f3d/assets/vo2/aN_XX.wav`, `acts.json` cue sheet | Listen to the odd ones |
| 3 | Sample | ~60–90 s cold open rendered | **Owner approves the look** |
| 4 | Chapters | `f3d/actN.html` + `assets/js/actN.js` | Contact sheet of each chapter looks right |
| 5 | Soundtrack | `parts/aN_audio.wav` | Narration clearly above music |
| 6 | Render | frames → `parts/aN_master.mp4` → review copies | Each chapter sent as it lands |
| 7 | Assemble | `f3d/renders/NAME_full.mp4` | Duration matches the sum of the parts; A/V lengths equal |
| 8 | Captions | `.srt` + `.ass`, 1080p burned-in encode | Spot-check frames |
| 9 | Delivery | chapters in chat, full film on a download page | Link works |
| 10 | Packaging | thumbnail, title, description, tags | Thumbnail readable at 168×94 |

### 1. Research and script
- Get facts from primary or strong sources (court records, period newspapers, peer-reviewed papers, later corrections) and list them in the description.
- Write the narration as a JSON object of chapters: `{"a1": ["line", ...], "a2": [...]}`, one short paragraph per entry. Example: `examples/the38/script.json`.
- **Write numbers as words** so the TTS reads them right ("nineteen sixty-four"). The caption builder converts them back to digits.
- Story arc that worked: cold open at the crime, then the victim's life, the night, the hunt, the myth, what really happened, and accountability. End on a human line ("If you see someone in danger, call for help...").
- Where the popular story is wrong, say so plainly. That correction is the strongest hook.

### 2. Narration (Kokoro TTS through HyperFrames)
```bash
python3 -m venv venv && venv/bin/pip install kokoro-onnx soundfile pillow fonttools brotli numpy
export HYPERFRAMES_PYTHON=$PWD/venv/bin/python
# one wav per script line; voice bm_george at speed 0.92 (0.85 for shouted lines)
npx hyperframes tts --text-file f3d/assets/vo2/a1_01.txt -v bm_george -s 0.92 -o f3d/assets/vo2/a1_01.wav
```
Build `f3d/assets/acts.json`: `{"a1": {"cues": [{"f": "assets/vo2/a1_01.wav", "s": 5.0, "d": 10.9}, ...], "dur": 87.9}, ...}`.
- `s` is the start time inside the chapter and `d` the clip length (from ffprobe).
- Start the first line at about 5 s, leaving room for the chapter title.
- Leave 0.7–2.7 s between lines; longer pauses after big beats.
- Set `dur` to the last line's end plus 4–6 s (12 s for the final chapter's end card).
- The real file is in `examples/the38/acts.json`.

### 3–4. Building scenes with the engine
Create the project with `scripts/setup_project.sh <dir> "<avatars>" "<anims>"`. It copies `engine/`, vendors three.js r181 and GSAP 3.14.2, and downloads the Poly Haven textures and models (CC0) and the Rocketbox avatars and animations (MIT). The script was tested and reproduces the working assets byte-for-byte.

Each chapter is a page (`engine/act.html.example`) that loads `assets/js/actN.js`. The full examples are in `examples/the38/acts/act1.js` … `act6.js`, which import from `./stage.js`, so copy them into `f3d/assets/js/` before use. Pattern:
```js
const ACTS = await (await fetch("assets/acts.json")).json();
const A = ACTS.a1, C = A.cues.map(c => c.s), DUR = A.dur;
const ov = createOverlay(DUR);                  // GSAP timeline = window.__timelines.main
ov.chapter("CHAPTER ONE", "KITTY", 0.6, 4.6);  // also: lower(name, desc), stamp(text), quote, tag, src, label, stats, end
const st = createStage();
run(st, async () => { /* build sets, people, cars once */ }, (t) => {
  /* pose everything for time t, deterministically */
  return { pos, look, fov, focus, ap, bw, fade, warm, exposure }; // camera + grade for this frame
});
```
Engine pieces:

| File | Contents |
|---|---|
| `stage.js` | Renderer and post chain (NaN/HDR clamp, depth of field, bloom, FXAA, grade shader with vignette, grain, chromatic aberration, `warm`, `bw`). Helpers: `sm`, `ease`, `lerp`, `V`, `lerpV`, `shake`, `dist`, `makePath`, `carAt`, `pose`, `walker`, `buildStreet`, `captureEnv`, `only` |
| `world.js` | Street block: Tudor row, 7-storey apartment block, instanced lit windows (`setWindows`), lamps, trees |
| `people.js` | `loadPeople([...avatars])` and `makePerson(scene, lib, name, "m"/"f", height, tone)`. Action keys: idle, look, walk, run, sit, crouch, nervous, slow, sitTable, sitTable2, listen, angry, docs, hold, sit2, headphones, injured |
| `cars.js` | `makeCar({...CARS.sedan, color, plate})`. Presets: fiat600, corvair, sedan, coupe |
| `sets.js` | `Builder` and interior sets placed far apart on x (bar, apartment, window room, vestibule, interrogation, newsroom, lab, courtroom, cell, theater) |
| `ov.js` / `ov.css` | Overlay graphics on the GSAP timeline |

Rules that keep renders correct:
- **Deterministic only.** Use a seeded RNG, no `Date.now()`, no `Math.random()` at frame time. Drive animations with explicit `action.time` plus `mixer.update(0)`.
- **Show only the active set** with `only(st, place)` and `street.show(bool)`. Rendering every set's lights makes each frame far slower.
- **Camera placement:** test that the camera isn't inside a wall (it happened in act 5). Render probe frames and look at them before a long render.
- **Lighting:** keep practical lights modest. Newsroom lamps, documents under a desk lamp and interrogation key lights all blew out at first.
- **B&W scenes:** return `bw: 1` and roughly 1.2–2.4 `exposure`.

Check a chapter before rendering it all. Render about 6 sample frames, tile them with `scripts/contact_sheet.py`, and look.

### 5. Soundtrack
`scripts/make_soundtrack.py` (numpy) builds each chapter's bed from drones, pads, sparse piano, ambience and SFX. It places the narration at its cues, ducks the music under the voice, and normalises to −14 LUFS (`ffmpeg loudnorm`). Edit its per-chapter score section for each new film. Run it with `PROJ=<project dir>`.

### 6–7. Rendering and assembly
- The machine is a 4-core CPU with no GPU (SwiftShader). Rendering takes **5–8 s per 1080p frame**, so a 10-minute film is about **24–30 hours**. Tell the owner the estimate up front and deliver chapter by chapter.
- Do not use `hyperframes render` for long films. Claude Code background jobs die at 2 hours, so use the resumable pipeline:
```bash
cd <project>/f3d && setsid http-server -p 8123 -s . >/dev/null 2>&1 &
PROJ=<project> NAME=THE38 setsid nohup bash <skill>/scripts/render_queue.sh >/dev/null 2>&1 &
tail -f <project>/fr/queue.log    # "act N: have/total", "CHn ENCODED", "ALL DONE"
```
- `render_queue.sh` renders each chapter with `render_frames.mjs`, which skips frames that already exist, so it survives crashes and container restarts. It then runs `finish_act.sh N`, which writes the `crf 15` master plus a review copy of 29 MB or less in `f3d/renders/chapters/`, then deletes the frames. Finally it runs `assemble.sh`, which writes `NAME_full.mp4` (crf 16, about 6 GB for 10 minutes).
- After a container restart, check `pgrep -f render_queue` and restart the same command; it resumes.
- To wait for progress, poll with a background `until` loop. Re-arm it when it hits the 2-hour limit.

### 8. Captions
1. Copy each narration clip into its own folder and transcribe it there:
   `npx hyperframes transcribe cap/a1_01/a1_01.wav --model small.en -d cap/a1_01`, which writes `cap/a1_01/transcript.json`. Cold-open clips go in the same way.
2. Edit the PER-FILM block in `scripts/build_captions.py`:
   - cold-open clip list and start times;
   - whisper mis-hearings (e.g. "hollies" for "Hollis", "mostly" for "Moseley");
   - cold-open length;
   - number substitutions.
3. Run `PROJ=<project> NAME=<film> python3 scripts/build_captions.py`. The text comes from the script, so names are spelled right; the timing comes from whisper's word times. Lines are split by clause, 42 characters at most.
4. Burn in with libass. libass can't read woff2, so use the included `engine/fonts/Inter-Medium.ttf`:
   `ffmpeg -i full.mp4 -vf "ass=NAME_captions.ass:fontsdir=<dir with Inter-Medium.ttf>" -c:v libx264 -crf 20 ...`
5. Check frames at 3–4 timestamps, including ones with name titles (lower thirds) on screen.

### 9. Delivery: the size limits that bite
- **Files sent in chat are capped at about 30 MiB.** One rejection said 500 MiB, but the next said 30 MiB, so plan for 29 MB.
  - Send chapters as review copies of 29 MB or less.
  - A 10-minute film in one 29 MB file is 720p at roughly 270 kbps. That's fine as a preview, not as the master.
- **Full 1080p film:** publish a private Artifact page that reassembles the file in the browser.
  1. Encode with a two-pass target so the file stays under about 245 MB (3000k video + 160k audio for 10:26).
  2. Split it into 14,000,000-byte parts named `.mp4`. Artifacts refuse `.bin` and `application/octet-stream`.
  3. Fill in `delivery/download_page.tpl.html` (`__PARTS__`, `__TOTAL__`, `__MB__`).
  4. Publish with `capabilities: {downloads: true}`. Each publish may carry at most 64 MB, so add the parts in batches of 4. A version holds at most 256 MB.
  - The page fetches the parts, plays the film, and saves one MP4 through `downloads.save`. Before publishing, check that `cat parts/* | cmp - film.mp4` reports the files identical.
- Everything in the container is deleted when the session ends. Remind the owner to download.

### 10. Thumbnail and YouTube packaging
- **Thumbnail:** the owner usually brings an AI-generated base image. Composite it in `thumbnail/thumbnail.html` (fonts in `thumbnail/fonts/`) and render 1280×720 with `node thumbnail/shot.mjs <abs html> <out.png>`. Result: `examples/the38/thumbnail.jpg`.
  - **Text:** a giant red number or word (Anton), a short white line beside it, and a yellow question tag ("NOBODY CALLED?", Oswald on #ffd21f), all in the empty sky area.
  - **Red marker:** a hand-drawn red ring around the key detail.
  - **Real photo:** pinned as an aged evidence print with red tape, captioned with the name, not an age the photo doesn't show.
  - **Keep clear:** the bottom-right corner, where YouTube puts the video length, and every face.
  - **Grade:** contrast about 1.14, saturation about 1.18, a lift on the subject, darkness behind the text.
  - **Check** the result at 336×189 and 168×94.
- **Title:** the thumbnail asks the question and the title deepens it, e.g. "38 People Watched Her Die. Or Did They?"
- **Description:** two factual opening sentences (they show in search), a short story paragraph, chapter timestamps (cumulative chapter starts), a reconstruction disclaimer, sources, one human closing line, and 3 hashtags. Template: `examples/the38/youtube_upload.md`.
- **Tags:** about 15–20 plain phrases, under 500 characters.
- **Category:** Education. It fits sourced documentaries and gives educational context for violent subject matter. People & Blogs is just the default, and the category barely affects reach.
- **Synthetic content:** tell the owner to mark the video as "altered or synthetic content: Yes", because it has realistic recreations and an AI thumbnail.
- **Growth:** offer 9:16 Shorts cut from the strongest beats.

## Running on the owner's own computer (Downloads folder)

The owner wants to work from their **Downloads** folder on their own machine.
- **Where the skill goes:** `~/.claude/skills/true-crime-3d-doc/` makes it available in every folder. If Claude Code is opened in Downloads, `~/Downloads/.claude/skills/true-crime-3d-doc/` also works.
- **Projects:** keep each film in its own folder, e.g. `~/Downloads/films/<case>/`, and pass that as `PROJ`.
- **One-time install:**
  - Node 18+, ffmpeg, git and Python 3.
  - `npm i -g http-server playwright`, then `npx playwright install chromium`.
  - `python3 -m venv venv && venv/bin/pip install kokoro-onnx soundfile pillow fonttools brotli numpy`. Set `HYPERFRAMES_PYTHON` and `PYTHON` to that venv's python.
- **Rendering:** set `GPU=1` so frames render on the graphics card. That should be much faster than the 5–8 s per frame of the CPU-only cloud box; time a test chapter before promising a schedule.
- **Big files:** with a local machine there is no 30 MiB chat limit. The full film and masters are written straight into the project folder, so skip the Artifact download page.
- **Platform:** the scripts are bash. On macOS and Linux run them as-is; on Windows use WSL.

## Traps that cost time (each one happened)

| Symptom | Fix |
|---|---|
| CDN scripts fail with cert errors in headless Chrome | Vendor three.js and GSAP locally (`setup_project.sh` does this) |
| `pkill -f name` kills your own shell (exit 144) | `kill $(pgrep -f "nam[e]")`; never put the literal target in the command |
| Character lies flat or is twisted | Rig mismatch. Use Rocketbox avatars with Rocketbox Bip01 clips; root motion is stripped by `inPlace()` |
| Wrong bounding-box size | Call `updateMatrixWorld(true)` before `Box3.setFromObject` |
| A shared vector moves | `localToWorld` mutates its argument; pass `.clone()` |
| Headlight glare blows out frames | Remove light cones; keep the HDR clamp pass |
| Black-cut flicker | Force `fade: 1` across the whole black window |
| `waitForFunction` hangs | Return a boolean: `!!(cond)` |
| Disk full after cloning Rocketbox (27 GB) | Use `fetch_rocketbox.sh` (sparse, about 5 MB per avatar) |
| Every frame slow | Hide inactive sets with `only()` and `street.show(false)` |
| Load timeouts with several browsers | Render one chapter at a time; timeouts in `render_frames.mjs` are 25 min to load and 4 min per screenshot |
| H.264 won't play in Playwright's Chromium | Its build has no proprietary codecs. Not a bug in the file; verify with `cmp` instead |
| Wikimedia returns 429 | The shared IP is rate-limited. Use WebFetch to read licence pages; retry downloads later with a plain User-Agent. Never put the owner's email in headers |
| Whisper writes a voice clip's transcript beside the input | Give each clip its own folder and pass `-d` |

## Keep improving: update this skill every session

The owner wants this pipeline to get better with each film. After every meaningful step (a fix, new feedback, a new trick, a delivered film):
1. Add a dated entry to `LESSONS.md`. New owner preferences also go in "The owner's standing preferences" above; new traps go in the table.
2. When a reusable improvement is made to engine code or a script, copy it back into `engine/` or `scripts/` here. Keep per-film code in `examples/<film>/`.
3. Commit and push to the session's working branch so the next session gets it. `.claude/skills/` in this repo is the only storage that survives the container.
