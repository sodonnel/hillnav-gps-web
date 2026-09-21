# Hillnav GPS

A progressive web app that uses a phone's GPS to show the current location as an Irish Grid or UK
(Ordnance Survey) grid reference, or as GPS latitude and longitude.

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
