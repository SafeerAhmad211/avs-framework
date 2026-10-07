// Resumable frame renderer: seeks the HyperFrames GSAP timeline + three.js world frame by frame, saves JPGs.
// usage: node render_frames.mjs <outDir> <fps> <totalFrames> <budgetMinutes> <page.html>   (page served on :8123)
// Skips frames that already exist, so re-running resumes. ~7-8 s/frame at 1080p on a 4-core CPU (SwiftShader).
import { chromium } from '/opt/node22/lib/node_modules/playwright/index.mjs';
import fs from 'fs';
const [,, outDir, fpsS, totalS, budgetMinS, page] = process.argv;
const fps = +fpsS, total = +totalS, deadline = Date.now() + (+budgetMinS) * 60000;
const b = await chromium.launch({ args: ['--use-angle=swiftshader','--enable-unsafe-swiftshader'] });
const p = await b.newPage({ viewport: { width: 1920, height: 1080 } });
p.on('pageerror', e => console.log('[pageerror]', e.message));
await p.goto('http://127.0.0.1:8123/' + (page || 'index.html'));
await p.waitForFunction(() => !!(window.__hf?.buildReady?.['world'] && window.__timelines?.main), null, { timeout: 1500000 }); await p.evaluate(() => window.__hf.buildReady['world']);
await p.evaluate(() => document.fonts.ready);
let done = 0;
for (let i = 0; i < total; i++) {
  const f = `${outDir}/f${String(i).padStart(5, '0')}.jpg`;
  if (fs.existsSync(f)) continue;
  if (Date.now() > deadline) { console.log('budget reached at frame', i); break; }
  const t = i / fps;
  await p.evaluate((tt) => { window.__timelines.main.seek(tt, false); window.dispatchEvent(new CustomEvent('hf-seek', { detail: { time: tt } })); }, t);
  await p.screenshot({ path: f + '.tmp.jpg', type: 'jpeg', quality: 95, timeout: 240000 });
  fs.renameSync(f + '.tmp.jpg', f);
  if (++done % 100 === 0) console.log('frame', i);
}
console.log('rendered', done, 'remaining', Array.from({ length: total }, (_, i) => i).filter(i => !fs.existsSync(`${outDir}/f${String(i).padStart(5, '0')}.jpg`)).length);
await b.close();
