// Playwright: uses the project's own install (npm i playwright) or a global one at PLAYWRIGHT_MODULE.
const { chromium } = await import(process.env.PLAYWRIGHT_MODULE || 'playwright').catch(() => import('/opt/node22/lib/node_modules/playwright/index.mjs'));
const [html, out] = process.argv.slice(2);
const b = await chromium.launch();
const p = await b.newPage({ viewport: { width: 1280, height: 720 } });
await p.goto('file://' + html);
await p.evaluate(() => document.fonts.ready);
await p.waitForTimeout(300);
await p.locator('#c').screenshot({ path: out, type: 'png' });
await b.close();
