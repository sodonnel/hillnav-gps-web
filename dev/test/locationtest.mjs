// Browser test of location errors: they are shown in the card rather than with alert(), and
// cleared when a position arrives.
// Run with dev/test/run_browser_tests.sh - see README.md.
// Usage: node locationtest.mjs <build dir>
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { chromium } from 'playwright';

const root = process.argv[2];
const types = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.png': 'image/png' };
const server = http.createServer((req, res) => {
  const p = new URL(req.url, 'http://localhost').pathname;
  const file = path.join(root, p === '/' ? '/index.html' : p);
  fs.readFile(file, (err, data) => {
    if (err) { res.writeHead(404); res.end(); return; }
    res.writeHead(200, { 'Content-Type': types[path.extname(file)] || 'application/octet-stream' });
    res.end(data);
  });
});
await new Promise((r) => server.listen(8080, r));

let failures = 0;
function check(name, cond, detail) {
  console.log((cond ? 'PASS ' : 'FAIL ') + name + (detail !== undefined ? '  -> ' + detail : ''));
  if (!cond) failures++;
}

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

// Browser without geolocation
context = await browser.newContext({ viewport: { width: 390, height: 844 } });
await context.addInitScript(() => Object.defineProperty(navigator, 'geolocation', { value: undefined }));
page = await newPage(context);
await page.goto('http://localhost:8080/');
await page.waitForTimeout(500);
check('No geolocation: message shown', (await error(page)) === 'This browser cannot provide your location.', await error(page));
check('No geolocation: no alerts or page errors', page.errors.length === 0, page.errors.join(' | '));
await context.close();

await browser.close();
server.close();
console.log(failures === 0 ? '\nAll checks passed' : '\n' + failures + ' check(s) failed');
process.exit(failures === 0 ? 0 : 1);
