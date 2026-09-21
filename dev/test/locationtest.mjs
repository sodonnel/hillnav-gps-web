// Browser test of location errors, which are shown in the card rather than with alert() and
// cleared when a position arrives, and of the elevation, speed and accuracy display.
// Run with dev/test/run_browser_tests.sh - see README.md.
// Usage: node locationtest.mjs <build dir>
import { chromium } from 'playwright';
import { startServer, check, finish } from './browser_helpers.mjs';

const site = await startServer(process.argv[2]);

const browser = await chromium.launch();
const newPage = async (context) => {
  const page = await context.newPage();
  page.errors = [];
  page.on('pageerror', (e) => page.errors.push('pageerror: ' + e.message));
  page.on('dialog', (d) => { page.errors.push('dialog: ' + d.message()); d.dismiss(); });
  return page;
};
const error = (page) => page.evaluate(() => {
  const el = document.querySelector('#locationError');
  return el.hidden ? null : el.textContent.trim();
});

// Location permission denied, then allowed
let context = await browser.newContext({ viewport: { width: 390, height: 844 } });
let page = await newPage(context);
await page.goto('http://localhost:8080/');
await page.waitForFunction(() => !document.querySelector('#locationError').hidden, null, { timeout: 10000 });
check('Denied: message shown in the card', (await error(page) || '').startsWith('Location access is not allowed'), await error(page));

await context.grantPermissions(['geolocation']);
await context.setGeolocation({ latitude: 54.18029, longitude: -5.92106 });
await page.evaluate(() => document.dispatchEvent(new Event('visibilitychange')));
await page.waitForFunction(() => document.querySelector('#ref').textContent.startsWith('J '), null, { timeout: 10000 });
check('Allowed and back in foreground: grid ref shown and message cleared', (await error(page)) === null, await error(page));
check('No alerts or page errors', page.errors.length === 0, page.errors.join(' | '));
await context.close();

// Denied messages give the settings for the user's platform. iPadOS reports itself as a Mac with
// a touch screen.
const IPHONE_UA = 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.5 Mobile/15E148 Safari/604.1';
const MAC_UA = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.5 Safari/605.1.15';
const ANDROID_UA = 'Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Mobile Safari/537.36';
const platforms = [
  { name: 'iPhone', userAgent: IPHONE_UA, touchPoints: 5, expect: 'On iPhone or iPad, check Settings > Privacy & Security' },
  { name: 'iPad', userAgent: MAC_UA, touchPoints: 5, expect: 'On iPhone or iPad, check Settings > Privacy & Security' },
  { name: 'Mac', userAgent: MAC_UA, touchPoints: 0, expect: "Check that location is allowed for this site in your browser's settings" },
  { name: 'Android', userAgent: ANDROID_UA, touchPoints: 5, expect: 'On Android, check Location is turned on in Settings' },
];
for (const platform of platforms) {
  context = await browser.newContext({ viewport: { width: 390, height: 844 }, userAgent: platform.userAgent });
  await context.addInitScript((n) => Object.defineProperty(navigator, 'maxTouchPoints', { get: () => n }), platform.touchPoints);
  page = await newPage(context);
  await page.goto('http://localhost:8080/');
  await page.waitForFunction(() => !document.querySelector('#locationError').hidden, null, { timeout: 10000 });
  const message = await error(page) || '';
  check(`Denied on ${platform.name}: message gives the settings for that platform`, message.includes(platform.expect), message);
  await context.close();
}

// Browser without geolocation
context = await browser.newContext({ viewport: { width: 390, height: 844 } });
await context.addInitScript(() => Object.defineProperty(navigator, 'geolocation', { value: undefined }));
page = await newPage(context);
await page.goto('http://localhost:8080/');
await page.waitForTimeout(500);
check('No geolocation: message shown', (await error(page)) === 'This browser cannot provide your location.', await error(page));
check('No geolocation: no alerts or page errors', page.errors.length === 0, page.errors.join(' | '));
await context.close();

// Elevation, speed and accuracy display. Chromium's geolocation override has no altitude or speed,
// so a fake geolocation returns the readings set in window.__coords. Bringing the app back to the
// foreground restarts the watch, which delivers the current reading.
const fakeGeolocationPage = async (userAgent) => {
  context = await browser.newContext({ viewport: { width: 390, height: 844 }, userAgent });
  await context.addInitScript(() => {
    window.__coords = { latitude: 54.18029, longitude: -5.92106, accuracy: 5, altitude: null, altitudeAccuracy: null, speed: null };
    const fix = () => ({ coords: { ...window.__coords }, timestamp: Date.now() });
    Object.defineProperty(navigator, 'geolocation', { value: {
      watchPosition: (success) => { setTimeout(() => success(fix()), 10); return 1; },
      clearWatch: () => {},
      getCurrentPosition: (success) => setTimeout(() => success(fix()), 10),
    } });
  });
  page = await newPage(context);
  await page.goto('http://localhost:8080/');
};
const reading = async (coords, selector) => {
  await page.evaluate((c) => {
    Object.assign(window.__coords, c);
    document.dispatchEvent(new Event('visibilitychange'));
  }, coords);
  await page.waitForTimeout(200);
  return page.textContent(selector);
};
const accuracyState = () => page.evaluate(() => ({
  text: document.querySelector('#accuracy').textContent.trim(),
  red: document.querySelector('#accuracy').classList.contains('text-danger'),
  refGreyed: document.querySelector('#ref').classList.contains('text-muted'),
}));

await fakeGeolocationPage(IPHONE_UA);
let text = await reading({ altitude: 851.4, altitudeAccuracy: 9.6 }, '#elevation');
check('Elevation with accuracy', text === 'Elevation: 851m (within 10m)', text);
text = await reading({ altitude: 851.4, altitudeAccuracy: null }, '#elevation');
check('Elevation without accuracy: no "within"', text === 'Elevation: 851m', text);
text = await reading({ altitude: null, altitudeAccuracy: null }, '#elevation');
check('No elevation: unavailable', text === 'Elevation: unavailable', text);
text = await reading({ speed: 1.2 }, '#speed');
check('Speed in km/h to one decimal place', text === 'Speed: 4.3 km/h', text);
text = await reading({ speed: 0 }, '#speed');
check('Speed of zero shown, not unavailable', text === 'Speed: 0.0 km/h', text);
text = await reading({ speed: null }, '#speed');
check('No speed: unavailable', text === 'Speed: unavailable', text);

let a = await reading({ accuracy: 8 }, '#accuracy') && await accuracyState();
check('Good accuracy: plain, not red, grid ref not greyed',
  a.text === 'Within 8 meters' && !a.red && !a.refGreyed, JSON.stringify(a));
a = await reading({ accuracy: 250 }, '#accuracy') && await accuracyState();
check('Low accuracy: red warning and grid ref greyed',
  a.text === 'Within 250 meters - low accuracy, so the grid reference may be out' && a.red && a.refGreyed, JSON.stringify(a));
a = await reading({ accuracy: 3000 }, '#accuracy') && await accuracyState();
check('Approximate on iPhone: says precise location is off, with iPhone steps',
  a.text.includes('precise location is off') && a.text.includes('turn on Precise Location in Settings > Privacy & Security') && a.red && a.refGreyed,
  JSON.stringify(a));
a = await reading({ accuracy: 8 }, '#accuracy') && await accuracyState();
check('Accuracy recovers: warning cleared', a.text === 'Within 8 meters' && !a.red && !a.refGreyed, JSON.stringify(a));
check('Elevation, speed and accuracy: no alerts or page errors', page.errors.length === 0, page.errors.join(' | '));
await context.close();

await fakeGeolocationPage(ANDROID_UA);
a = await reading({ accuracy: 3000 }, '#accuracy') && await accuracyState();
check('Approximate on Android: Android steps',
  a.text.includes('On Android, allow precise location for your browser') && a.red, JSON.stringify(a));
check('Android: no alerts or page errors', page.errors.length === 0, page.errors.join(' | '));
await context.close();

await browser.close();
finish(site);
