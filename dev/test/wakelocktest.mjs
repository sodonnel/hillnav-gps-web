// Browser test of the Keep Screen On option. The browser's wake lock is replaced with a fake that
// counts active locks, so the app's handling of it can be checked, after a first pass with the real API.
// Run with dev/test/run_browser_tests.sh - see README.md.
// Usage: node wakelocktest.mjs <build dir>
import { chromium } from 'playwright';
import { startServer, check, finish } from './browser_helpers.mjs';

const site = await startServer(process.argv[2]);

const browser = await chromium.launch();

// Real API first: does the unmodified page run without errors
{
  const context = await browser.newContext({ viewport: { width: 390, height: 844 }, permissions: ['geolocation'], geolocation: { latitude: 54.18, longitude: -5.92 } });
  const page = await context.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.goto('http://localhost:8080/');
  await page.waitForTimeout(500);
  check('Real API: menu item shown when supported', await page.evaluate(() => 'wakeLock' in navigator && !document.querySelector('#keepScreenOnItem').hidden));
  await page.click('.navbar-toggler');
  await page.waitForSelector('#toggleKeepScreenOn', { state: 'visible' });
  await page.click('#toggleKeepScreenOn');
  await page.waitForTimeout(500);
  check('Real API: label shows On', (await page.textContent('#toggleKeepScreenOn')) === 'Keep Screen On: On', await page.textContent('#toggleKeepScreenOn'));
  check('Real API: no page errors', errors.length === 0, errors.join(' | '));
  await context.close();
}

// Fake API to observe the app's lock handling
const context = await browser.newContext({ viewport: { width: 390, height: 844 }, permissions: ['geolocation'], geolocation: { latitude: 54.18, longitude: -5.92 } });
await context.addInitScript(() => {
  window.__locks = { requested: 0, active: 0 };
  let hidden = false;
  Object.defineProperty(document, 'visibilityState', { get: () => hidden ? 'hidden' : 'visible' });
  window.__setHidden = (h) => {
    hidden = h;
    if (h) {
      // The browser releases wake locks when the page is hidden
      for (const l of window.__live) l.__release();
    }
    document.dispatchEvent(new Event('visibilitychange'));
  };
  window.__live = new Set();
  const wakeLock = {
    request: async () => {
      window.__locks.requested++;
      await new Promise((r) => setTimeout(r, 50));
      const target = new EventTarget();
      let released = false;
      target.__release = () => {
        if (released) return;
        released = true;
        window.__locks.active--;
        window.__live.delete(target);
        target.dispatchEvent(new Event('release'));
      };
      target.release = async () => target.__release();
      window.__locks.active++;
      window.__live.add(target);
      return target;
    },
  };
  Object.defineProperty(navigator, 'wakeLock', { get: () => wakeLock });
});
const page = await context.newPage();
const errors = [];
page.on('pageerror', (e) => errors.push(e.message));
const locks = () => page.evaluate(() => ({ ...window.__locks }));
const label = () => page.textContent('#toggleKeepScreenOn');
const toggle = async () => {
  await page.click('.navbar-toggler');
  await page.waitForSelector('#toggleKeepScreenOn', { state: 'visible' });
  await page.click('#toggleKeepScreenOn');
  await page.waitForTimeout(400);
};

await page.goto('http://localhost:8080/');
await page.waitForTimeout(300);
check('Default: off, no lock requested', (await label()) === 'Keep Screen On: Off' && (await locks()).requested === 0, JSON.stringify(await locks()));

await toggle();
check('Turn on: one active lock', (await label()) === 'Keep Screen On: On' && (await locks()).active === 1, JSON.stringify(await locks()));

await page.evaluate(() => window.__setHidden(true));
await page.waitForTimeout(200);
check('Hidden: lock released by browser, not re-requested', (await locks()).active === 0 && (await locks()).requested === 1, JSON.stringify(await locks()));
await page.evaluate(() => window.__setHidden(false));
await page.waitForTimeout(200);
check('Visible again: lock re-acquired', (await locks()).active === 1 && (await locks()).requested === 2, JSON.stringify(await locks()));

await page.evaluate(() => window.__setHidden(false));
await page.waitForTimeout(200);
check('Visible event while holding lock: no extra request', (await locks()).active === 1 && (await locks()).requested === 2, JSON.stringify(await locks()));

await page.reload();
await page.waitForTimeout(300);
check('Reload: setting kept and lock requested on load', (await label()) === 'Keep Screen On: On' && (await locks()).active === 1, JSON.stringify(await locks()));

await toggle();
check('Turn off: lock released', (await label()) === 'Keep Screen On: Off' && (await locks()).active === 0, JSON.stringify(await locks()));

// Off -> on -> off faster than the request completes
await page.evaluate(() => {
  const link = document.querySelector('#toggleKeepScreenOn');
  link.click(); link.click();
});
await page.waitForTimeout(300);
check('Quick on/off while request pending: no lock left held', (await label()) === 'Keep Screen On: Off' && (await locks()).active === 0, JSON.stringify(await locks()));

await page.reload();
await page.waitForTimeout(300);
check('Reload after turning off: stays off', (await label()) === 'Keep Screen On: Off' && (await locks()).requested === 0, JSON.stringify(await locks()));

check('No page errors', errors.length === 0, errors.join(' | '));

await browser.close();
finish(site);
