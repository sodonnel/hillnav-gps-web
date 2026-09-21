# Hillnav GPS

A progressive web app that uses a phone's GPS to show the current location as an Irish Grid or UK
(Ordnance Survey) grid reference, or as GPS latitude and longitude.

## Development

For local development: Serving the repo root without building means cache_manifest.json won't exist. The service worker install will then fail and nothing gets cached. That's convenient while developing, but it will log an error in the console. To test offline behaviour, serve a build with ruby dev/http_server/https_server.rb build/<id>.

## Running the tests

The tests need only Docker. They run in the `node:22-alpine` image, which is pulled the first time.
From the root of the repo run:

```sh
dev/test/run_tests.sh
```

This mounts the repo read-only into the container and:

1. Syntax checks the app's JavaScript (`js/*.js` and `sw.js`, skipping the minified libraries and the
   unused `js/main.js`).
2. Runs `dev/test/gridtest.mjs`, which checks:
   - known summits convert to within a few tens of metres of their published grid references
   - positions outside the Irish or UK grid are reported as outside rather than failing
   - every 100km square on the UK grid gets the correct two-letter code
   - `PositionManager` ignores positions that arrive out of order

Each check prints `PASS` or `FAIL`, and the script exits non-zero if any check fails.

In the browser the app's modules import each other by the names in the import map in `index.html`
(for example `'UKGridPosition'`). `dev/test/hooks.mjs` is a Node resolve hook that maps those same
names to `js/<name>.js`, so the tests load the app's files unchanged.

To run the tests without the wrapper script, for example with a local Node 22 install:

```sh
node --import ./dev/test/register.mjs dev/test/gridtest.mjs
```

## Running the browser tests

The service worker, the Keep Screen On option and the saved settings are tested in headless
Chromium using Playwright. This also needs only Docker, but pulls the `ruby:3.3-alpine` image and
the much larger Playwright image (about 2GB) the first time, and installs the `playwright` npm
package on each run. From the root of the repo run:

```sh
dev/test/run_browser_tests.sh
```

This makes two builds of the app in the Ruby container, a second apart so they get different build
IDs. It builds from a copy of the repo inside the container, so the repo's own `build/` directory is
not touched. It then runs `dev/test/swtest.mjs`, which serves the first build from a small web
server with the location set to Slieve Donard, and checks:

- on first load the service worker takes control without a reload, precaches the build, and shows
  no update banner
- with the browser offline, reloading `/` and loading `/index.html` still show the app and grid
  reference
- after the server switches to the second build and the app comes back to the foreground, the
  update banner appears, the page keeps running the first build until Reload is tapped, and then
  reloads into the second build with only its cache left
- there are no page errors, console errors or alerts throughout

It then runs `dev/test/wakelocktest.mjs` against the first build, at phone size so the navbar menu
is collapsed. It first turns Keep Screen On on with Chromium's real wake lock API and checks there
are no errors. It then replaces the API with a fake that counts active locks, and checks:

- the option is off by default, and turning it on holds one lock
- the lock is re-acquired when the app comes back to the foreground, without extra requests while
  a lock is already held
- the setting survives a reload
- turning it off releases the lock, including when it is turned on and off again before the
  request completes

Finally it runs `dev/test/settingstest.mjs` against the first build, which checks:

- a new user gets the Irish grid and Keep Screen On off, and nothing is saved until they choose
- choices are saved in `localStorage`, not cookies, and survive a reload
- settings saved in cookies by earlier versions are applied, moved to `localStorage`, and the
  cookies removed

These tests run in Chromium, not iOS Safari, so they are not a substitute for trying a build on an
iPhone.
