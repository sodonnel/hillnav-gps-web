// Browser test of the saved settings: they are kept in localStorage, and settings saved in
// cookies by earlier versions are moved across.
// Run with dev/test/run_browser_tests.sh - see README.md.
// Usage: node settingstest.mjs <build dir>
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
const newPage = async (cookies) => {
  const context = await browser.newContext({ viewport: { width: 390, height: 844 }, permissions: ['geolocation'],
    geolocation: { latitude: 54.18029, longitude: -5.92106 } });
  if (cookies) {
    await context.addCookies(cookies.map(([name, value]) => ({ name, value, url: 'http://localhost:8080/' })));
  }
  const page = await context.newPage();
  page.errors = [];
  page.on('pageerror', (e) => page.errors.push(e.message));
  return page;
};
const state = (page) => page.evaluate(() => ({
  heading: document.querySelector('#systemHeading').textContent.trim(),
  keepScreenOn: document.querySelector('#toggleKeepScreenOn').textContent.trim(),
  storage: { gridSystem: localStorage.getItem('gridSystem'), keepScreenOn: localStorage.getItem('keepScreenOn') },
  cookie: document.cookie,
}));
const choose = async (page, id) => {
  await page.click('.navbar-toggler');
  await page.waitForSelector(id, { state: 'visible' });
  await page.click(id);
  await page.waitForTimeout(400);
};

// New user: defaults, nothing saved until a choice is made
let page = await newPage();
await page.goto('http://localhost:8080/');
let s = await state(page);
check('New user: Irish grid and Keep Screen On off by default',
  s.heading === 'Irish Grid Reference' && s.keepScreenOn === 'Keep Screen On: Off', JSON.stringify(s));
check('New user: nothing saved yet', s.storage.gridSystem === null && s.storage.keepScreenOn === null, JSON.stringify(s.storage));

await choose(page, '#setSystemUK');
await choose(page, '#toggleKeepScreenOn');
s = await state(page);
check('Choices saved to localStorage, not cookies',
  s.storage.gridSystem === 'UK' && s.storage.keepScreenOn === 'true' && s.cookie === '', JSON.stringify(s));
await page.reload();
s = await state(page);
check('Reload: choices kept', s.heading === 'UK Grid Reference' && s.keepScreenOn === 'Keep Screen On: On', JSON.stringify(s));
check('No page errors', page.errors.length === 0, page.errors.join(' | '));

// Existing user with settings saved in cookies by an earlier version
page = await newPage([['gridSystem', 'GPS'], ['keepScreenOn', 'true']]);
await page.goto('http://localhost:8080/');
s = await state(page);
check('Cookie user: settings applied', s.heading === 'GPS Coordinates' && s.keepScreenOn === 'Keep Screen On: On', JSON.stringify(s));
check('Cookie user: settings moved to localStorage and cookies removed',
  s.storage.gridSystem === 'GPS' && s.storage.keepScreenOn === 'true' && s.cookie === '', JSON.stringify(s));
await choose(page, '#setSystemIrish');
await page.reload();
s = await state(page);
check('Cookie user: later choice kept after reload', s.heading === 'Irish Grid Reference' && s.storage.gridSystem === 'Irish', JSON.stringify(s));
check('No page errors', page.errors.length === 0, page.errors.join(' | '));

await browser.close();
server.close();
console.log(failures === 0 ? '\nAll checks passed' : '\n' + failures + ' check(s) failed');
process.exit(failures === 0 ? 0 : 1);
