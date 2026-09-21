// Shared helpers for the browser tests: a small web server for a build, and PASS/FAIL checks.
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';

const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.png': 'image/png' };

// Serves the files under site.root on http://localhost:8080/. The root can be changed while the
// server is running, for example to switch to a newer build.
export async function startServer(root) {
  const site = { root };
  site.server = http.createServer((req, res) => {
    const p = new URL(req.url, 'http://localhost').pathname;
    const file = path.join(site.root, p === '/' ? '/index.html' : p);
    fs.readFile(file, (err, data) => {
      if (err) { res.writeHead(404); res.end(); return; }
      res.writeHead(200, { 'Content-Type': TYPES[path.extname(file)] || 'application/octet-stream' });
      res.end(data);
    });
  });
  await new Promise((r) => site.server.listen(8080, r));
  return site;
}

let failures = 0;

export function check(name, cond, detail) {
  console.log((cond ? 'PASS ' : 'FAIL ') + name + (detail !== undefined ? '  -> ' + detail : ''));
  if (!cond) failures++;
}

// Stops the server, prints the summary and exits non-zero if any check failed
export function finish(site) {
  site.server.close();
  console.log(failures === 0 ? '\nAll checks passed' : '\n' + failures + ' check(s) failed');
  process.exit(failures === 0 ? 0 : 1);
}
