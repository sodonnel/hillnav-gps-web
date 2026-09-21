// Browser test of recovering from location errors without the app being reopened: an error just
// after returning to the foreground, location being unavailable for a while, and a fresh position
// request lost while the app was suspended. A scripted fake geolocation plays these out.
// Run with dev/test/run_browser_tests.sh - see README.md.
// Usage: node recoverytest.mjs <build dir>
import { chromium } from 'playwright';
import { startServer, check, finish } from './browser_helpers.mjs';

const site = await startServer(process.argv[2]);
const browser = await chromium.launch();
const context = await browser.newContext({ viewport: { width: 390, height: 844 } });
await context.addInitScript(() => {
  // failNextWatch: the next watch reports the position unavailable and then goes quiet, as WebKit
  //   can after an error
  // unavailable: every watch and request reports the position unavailable
  // silent: watches deliver nothing, as iOS can while stationary
  // loseNextProbe: the next getCurrentPosition never calls back
  window.__geo = { failNextWatch: false, unavailable: false, silent: false, loseNextProbe: false, watchStarts: 0, probes: 0 };
  const fix = () => ({ coords: { latitude: 54.18029, longitude: -5.92106, accuracy: 5, altitude: null, altitudeAccuracy: null, speed: null }, timestamp: Date.now() });
  const unavailable = () => ({ code: 2, message: 'Position unavailable (fake)', PERMISSION_DENIED: 1, POSITION_UNAVAILABLE: 2, TIMEOUT: 3 });
  const watches = new Map();
  let nextId = 1;
  Object.defineProperty(navigator, 'geolocation', { value: {
    watchPosition: (success, error) => {
      const g = window.__geo;
      g.watchStarts++;
      const id = nextId++;
      if (g.unavailable || g.failNextWatch) {
        g.failNextWatch = false;
        setTimeout(() => error(unavailable()), 10);
        return id;
      }
      const send = () => { if (!window.__geo.silent && !window.__geo.unavailable) success(fix()); };
      setTimeout(send, 10);
      watches.set(id, setInterval(send, 1000));
      return id;
    },
    clearWatch: (id) => { clearInterval(watches.get(id)); watches.delete(id); },
    getCurrentPosition: (success, error) => {
      const g = window.__geo;
      g.probes++;
      if (g.loseNextProbe) {
        g.loseNextProbe = false;
        return;
      }
      setTimeout(() => g.unavailable ? error(unavailable()) : success(fix()), 10);
    },
  } });
});
const page = await context.newPage();
const errors = [];
page.on('pageerror', (e) => errors.push('pageerror: ' + e.message));
page.on('dialog', (d) => { errors.push('dialog: ' + d.message()); d.dismiss(); });

const setGeo = (values) => page.evaluate((v) => Object.assign(window.__geo, v), values);
const geo = () => page.evaluate(() => ({ ...window.__geo }));
const resume = () => page.evaluate(() => document.dispatchEvent(new Event('visibilitychange')));
const state = () => page.evaluate(() => ({
  error: document.querySelector('#locationError').hidden ? null : document.querySelector('#locationError').textContent.trim(),
  age: document.querySelector('#ts').textContent.trim(),
}));
const fresh = () => page.waitForFunction(() => /^Position updated [0-2] seconds ago$/.test(document.querySelector('#ts').textContent.trim()),
  null, { timeout: 30000 }).then(() => true, () => false);

await page.goto('http://localhost:8080/');
check('Start: position received', await fresh(), JSON.stringify(await state()));

// Reopening glitch: the first watch after returning errors and goes quiet
let before = await geo();
await setGeo({ failNextWatch: true });
await resume();
let errorShown = false;
for (let i = 0; i < 16; i++) {
  await page.waitForTimeout(250);
  errorShown = errorShown || (await state()).error !== null;
}
let after = await geo();
check('Reopen glitch: no error message during the retry', !errorShown);
check('Reopen glitch: watch restarted after the error', after.watchStarts - before.watchStarts === 2,
  `${after.watchStarts - before.watchStarts} watches started`);
check('Reopen glitch: fresh position without reopening the app', await fresh(), JSON.stringify(await state()));

// Location unavailable for a while: hidden during the grace period, then shown, then recovers
await setGeo({ unavailable: true });
await resume();
await page.waitForTimeout(5000);
check('Unavailable: no message during the first seconds', (await state()).error === null, JSON.stringify(await state()));
const shown = await page.waitForFunction(() => !document.querySelector('#locationError').hidden, null, { timeout: 20000 })
  .then(() => true, () => false);
check('Unavailable: message shown once it lasts', shown && (await state()).error.startsWith('Your position is unavailable'),
  JSON.stringify(await state()));
await setGeo({ unavailable: false });
check('Unavailable: recovers and clears the message without reopening', await fresh() && (await state()).error === null,
  JSON.stringify(await state()));

// A fresh position request lost while suspended must not stop later ones
await setGeo({ silent: true, loseNextProbe: true });
const lost = await page.waitForFunction(() => window.__geo.probes > 0 && !window.__geo.loseNextProbe, null, { timeout: 40000 })
  .then(() => true, () => false);
check('Lost request: a fresh position request was lost', lost, JSON.stringify(await geo()));
before = await geo();
await resume();
check('Lost request: after reopening, requests resume and the position is fresh', await fresh() && (await geo()).probes > before.probes,
  JSON.stringify({ probes: (await geo()).probes - before.probes, ...(await state()) }));

check('No alerts or page errors', errors.length === 0, errors.join(' | '));

await browser.close();
finish(site);
