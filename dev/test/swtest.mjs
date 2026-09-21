// Browser test of the service worker: first install, offline load, and update between two builds.
// Run with dev/test/run_browser_tests.sh - see README.md.
// Usage: node swtest.mjs <build A dir> <build B dir>, where build B is newer than build A
import fs from 'node:fs';
import path from 'node:path';
import { chromium } from 'playwright';
import { startServer, check, finish } from './browser_helpers.mjs';

const [buildA, buildB] = process.argv.slice(2);
const idA = path.basename(buildA), idB = path.basename(buildB);
const precacheCount = (build) => JSON.parse(fs.readFileSync(path.join(build, 'cache_manifest.json'))).length;
const site = await startServer(buildA);

const browser = await chromium.launch();
const context = await browser.newContext({
  geolocation: { latitude: 54.18029, longitude: -5.92106, accuracy: 10 }, // Slieve Donard, Irish grid J
  permissions: ['geolocation'],
});
const page = await context.newPage();
const errors = [];
page.on('pageerror', (e) => errors.push('pageerror: ' + e.message));
page.on('console', (m) => { if (m.type() === 'error') errors.push('console: ' + m.text()); });
page.on('dialog', (d) => { errors.push('dialog: ' + d.message()); d.dismiss(); });

const refText = () => page.evaluate(() => document.querySelector('#ref').textContent.trim());
const version = () => page.evaluate(() => document.querySelector('#version').textContent.trim());
const bannerVisible = () => page.evaluate(() => !document.querySelector('#updateBanner').hidden);
const cacheState = () => page.evaluate(async () => {
  const names = await caches.keys();
  const counts = {};
  for (const n of names) counts[n] = (await (await caches.open(n)).keys()).length;
  return counts;
});

// First install
await page.goto('http://localhost:8080/');
await page.waitForFunction(() => navigator.serviceWorker.controller !== null, null, { timeout: 15000 });
check('First load: service worker controls page without reload', true);
await page.waitForFunction(() => document.querySelector('#ref').textContent.startsWith('J '), null, { timeout: 10000 });
check('First load: shows Irish grid ref', (await refText()).startsWith('J '), await refText());
let caches1 = await cacheState();
check('First load: every file in build A cache manifest precached', JSON.stringify(caches1) === JSON.stringify({ ['hillnavgps-' + idA]: precacheCount(buildA) }), JSON.stringify(caches1));
check('First load: no update banner', !(await bannerVisible()));
const icons = await page.evaluate(async () => {
  const size = async (href) => {
    const bitmap = await createImageBitmap(await (await fetch(href)).blob());
    return bitmap.width + 'x' + bitmap.height;
  };
  const manifest = await (await fetch(document.querySelector('link[rel=manifest]').href)).json();
  const result = [];
  for (const icon of manifest.icons) result.push({ src: icon.src, declared: icon.sizes, actual: await size(icon.src) });
  const touch = document.querySelector('link[rel=apple-touch-icon]').href;
  result.push({ src: touch, declared: '180x180', actual: await size(touch) });
  return result;
});
const wrongIcons = icons.filter((i) => i.declared !== i.actual);
check('Icons: manifest icons and apple-touch-icon load at their declared sizes', wrongIcons.length === 0,
  JSON.stringify(wrongIcons.length ? wrongIcons : icons.map((i) => i.actual)));

// Offline
await context.setOffline(true);
await page.reload();
await page.waitForFunction(() => document.querySelector('#ref').textContent.startsWith('J '), null, { timeout: 10000 });
check('Offline reload of /: app loads and shows grid ref', (await refText()).startsWith('J '), await refText());
await page.goto('http://localhost:8080/index.html');
await page.waitForFunction(() => document.querySelector('#ref').textContent.startsWith('J '), null, { timeout: 10000 });
check('Offline load of /index.html: app loads', await version() === idA, await version());
await context.setOffline(false);

// Update to build B, triggered by the app coming back to the foreground
site.root = buildB;
await page.evaluate(() => document.dispatchEvent(new Event('visibilitychange')));
await page.waitForFunction(() => !document.querySelector('#updateBanner').hidden, null, { timeout: 15000 });
check('Update: banner shown after foreground update check', await bannerVisible());
check('Update: still running build A until accepted', await version() === idA, await version());
await Promise.all([page.waitForEvent('load'), page.click('#updateButton')]);
await page.waitForFunction((id) => document.querySelector('#version').textContent.trim() === id, idB, { timeout: 10000 });
check('Update: reloads into build B', await version() === idB, await version());
check('Update: banner hidden after reload', !(await bannerVisible()));
let caches2 = await cacheState();
check('Update: only build B cache remains, fully precached', JSON.stringify(caches2) === JSON.stringify({ ['hillnavgps-' + idB]: precacheCount(buildB) }), JSON.stringify(caches2));

check('No page errors, console errors or alerts', errors.length === 0, errors.join(' | '));

await browser.close();
finish(site);
