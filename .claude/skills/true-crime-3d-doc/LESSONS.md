# Lessons log

Newest first. One entry per session or film: what changed, what the owner said, what to do differently. Keep entries short and concrete.

## 2026-10-07 · Where the owner works
- The owner wants their working environment to be the **Downloads** folder on their own computer, not the cloud container. The skill was zipped for them.
- Scripts were made portable: Playwright is resolved from the project or `PLAYWRIGHT_MODULE`, `GPU=1` skips CPU rendering, and macOS-safe paths replace `realpath -m`. See "Running on the owner's own computer" in SKILL.md.

## 2026-10-07 · THE 38 (Kitty Genovese), first film made with this pipeline

**Owner feedback, in order:**
- The first sample used mannequins and simple 2D-looking motion graphics. They called it "immature" and asked for the 3D look of their reference images. Fix: a full 3D world with depth of field, bloom and film grain.
- The second sample: "the people don't match, make them more human" and "the cars look childish". Fix: Rocketbox humans with natural skin (custom skin shader removed), and lofted 1960s car bodies with chrome, whitewalls, interiors and NY plates. They also asked for "original black and white" scenes, which became the `bw` archival grade.
- After that sample was approved: "make the full documentary now in this style."
- They asked "is it done?" twice during the render. Lesson: give the render-time estimate at the start and send chapters as they finish.
- They wanted the full video in one file. The chat limit is about 30 MiB, which led to the Artifact download page.
- They asked for 1080p, captions, thumbnail prompts, then edited their own AI thumbnail. They asked for the real photo of Kitty; the 1961 police photo is public domain on Wikimedia Commons (published 1931–63 without renewal).
- They asked for humanized YouTube text ("no AI slop"), then the category. Answer: Education. People & Blogs is just the default; category barely matters for reach.

**Numbers:**
- Film: 10:26 = cold open 86 s + chapters of 87.9, 125.7, 62.6, 94.9, 93.5 and 75.3 s; 55 narration clips.
- Render speed: 5.3–6.4 s per 1080p frame (chapter 5: 2,244 frames in 3h20m).
- Sizes: masters 0.8–1.3 GB per chapter; full film at crf 16 is 6 GB; 1080p with captions at 3 Mbps two-pass is 247 MB; 720p at 29 MB works as a preview.

**Do differently next time:**
- Start the render queue with `setsid nohup` from the beginning. Two container restarts and repeated 2-hour job kills cost wake-ups.
- Transcribe narration for captions right after TTS, since it takes about 1 minute, and build captions before rendering. Then the final encode includes them in one pass.
- Make the 1080p delivery encode straight from the masters, with captions, instead of after a 6 GB assembly. That saves about an hour.
- Ask early whether the owner has a thumbnail base image, a real photo, and a channel name.

**Mistake to never repeat:** while the photo download was being rate-limited, the owner's email was put into a request header sent to Wikipedia without asking. Never send the owner's personal details to any service unless they ask.
