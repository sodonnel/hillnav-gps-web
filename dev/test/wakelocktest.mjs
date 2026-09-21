// Browser test of the Keep Screen On option. The browser's wake lock is replaced with a fake that
// counts active locks, so the app's handling of it can be checked, after a first pass with the real API.
// It is also run in WebKit, which like Safari only grants a wake lock during a user gesture.
// Run with dev/test/run_browser_tests.sh - see README.md.
// Usage: node wakelocktest.mjs <build dir>
import { chromium, webkit } from 'playwright';
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

// Replaces the wake lock API with a fake that counts requested and active locks, and lets the test
// hide and show the page. With requireGesture, it refuses requests made outside a user gesture.
const installFakeWakeLock = (requireGesture) => {
  // A request counts as in a gesture while a real tap or click is being handled. This is tracked
  // here rather than with navigator.userActivation, as Playwright's evaluate counts as a gesture.
  let inGesture = false;
  for (const type of ['pointerup', 'touchend', 'click']) {
    window.addEventListener(type, (e) => {
      if (e.isTrusted) {
        inGesture = true;
        setTimeout(() => { inGesture = false; }, 0);
      }
    }, { capture: true });
  }
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
      // Like Safari, optionally refuse a request made outside a user gesture
      if (requireGesture && !inGesture) {
        throw new DOMException('Permission was denied', 'NotAllowedError');
      }
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
};

// Fake API to observe the app's lock handling
const context = await browser.newContext({ viewport: { width: 390, height: 844 }, permissions: ['geolocation'], geolocation: { latitude: 54.18, longitude: -5.92 } });
await context.addInitScript(installFakeWakeLock, false);
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

// Safari only grants a wake lock during a user gesture, so the requests on load and on returning to
// the foreground are refused. The hint asks for a tap, and the next tap gets the lock.
const tapPage = async (ctx) => {
  const p = await ctx.newPage();
  p.errors = [];
  p.on('pageerror', (e) => p.errors.push(e.message));
  await p.goto('http://localhost:8080/');
  await p.waitForTimeout(300);
  return p;
};
const hintShown = (p) => p.evaluate(() => !document.querySelector('#wakeLockHint').hidden);
const tapScreen = async (p) => { await p.click('#systemHeading'); await p.waitForTimeout(300); };
const toggleOn = async (p) => {
  await p.click('.navbar-toggler');
  await p.waitForSelector('#toggleKeepScreenOn', { state: 'visible' });
  await p.click('#toggleKeepScreenOn');
  await p.waitForTimeout(400);
};

const safariContext = await browser.newContext({ viewport: { width: 390, height: 844 }, permissions: ['geolocation'], geolocation: { latitude: 54.18, longitude: -5.92 } });
await safariContext.addInitScript(installFakeWakeLock, true);
const sp = await tapPage(safariContext);
const spLocks = () => sp.evaluate(() => ({ ...window.__locks }));
await toggleOn(sp);
check('Gesture needed: turning on from the menu gets the lock, no hint', (await spLocks()).active === 1 && !(await hintShown(sp)), JSON.stringify(await spLocks()));
await sp.evaluate(() => window.__setHidden(true));
await sp.evaluate(() => window.__setHidden(false));
await sp.waitForTimeout(200);
check('Gesture needed: back in foreground, refused and hint shown, still On',
  (await spLocks()).active === 0 && await hintShown(sp) && (await sp.textContent('#toggleKeepScreenOn')) === 'Keep Screen On: On',
  JSON.stringify(await spLocks()));
await tapScreen(sp);
check('Gesture needed: a tap gets the lock and hides the hint', (await spLocks()).active === 1 && !(await hintShown(sp)), JSON.stringify(await spLocks()));
await sp.reload();
await sp.waitForTimeout(300);
check('Gesture needed: after reload, refused and hint shown', (await spLocks()).active === 0 && await hintShown(sp), JSON.stringify(await spLocks()));
await tapScreen(sp);
check('Gesture needed: after reload, a tap gets the lock', (await spLocks()).active === 1 && !(await hintShown(sp)), JSON.stringify(await spLocks()));
await sp.evaluate(() => window.__setHidden(true));
await sp.evaluate(() => window.__setHidden(false));
await sp.waitForTimeout(200);
await toggleOn(sp); // turns it off
check('Gesture needed: turning off hides the hint and holds no lock',
  (await spLocks()).active === 0 && !(await hintShown(sp)) && (await sp.textContent('#toggleKeepScreenOn')) === 'Keep Screen On: Off',
  JSON.stringify(await spLocks()));
check('Gesture needed: no page errors', sp.errors.length === 0, sp.errors.join(' | '));
await safariContext.close();

await browser.close();

// The same in real WebKit, Safari's engine, which refuses wake locks outside a user gesture
const webkitBrowser = await webkit.launch();
const wkContext = await webkitBrowser.newContext({ viewport: { width: 390, height: 844 } });
const wk = await tapPage(wkContext);
check('WebKit: Keep Screen On offered', await wk.evaluate(() => !document.querySelector('#keepScreenOnItem').hidden));
await toggleOn(wk);
check('WebKit: turning on from the menu works, no hint', !(await hintShown(wk)));
await wk.reload();
await wk.waitForTimeout(500);
check('WebKit: after reload the request is refused and the hint shown', await hintShown(wk));
await tapScreen(wk);
check('WebKit: a tap gets the lock and hides the hint', !(await hintShown(wk)));
check('WebKit: no page errors', wk.errors.length === 0, wk.errors.join(' | '));
await webkitBrowser.close();

finish(site);
