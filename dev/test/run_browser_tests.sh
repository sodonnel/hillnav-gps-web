#!/bin/sh
# Tests the app in headless Chromium: makes two builds of the app, then runs
# dev/test/swtest.mjs and dev/test/wakelocktest.mjs against them using Playwright in Docker.
# Usage: dev/test/run_browser_tests.sh
set -e

PLAYWRIGHT_VERSION=1.48.0

cd "$(dirname "$0")/../.."

builds=$(mktemp -d)
trap 'rm -rf "$builds"' EXIT

# Each build runs on a copy of the app inside the container, so the repo's own build/ directory
# is untouched, and is copied out to the temporary directory. The builds are a second apart so
# they get different build IDs.
for n in 1 2; do
  if [ "$n" = 2 ]; then
    sleep 1
  fi
  docker run --rm --user "$(id -u):$(id -g)" -v "$PWD":/src:ro -v "$builds":/out \
    ruby:3.3-alpine sh -c '
    set -e
    mkdir /tmp/app
    cd /src
    cp -r *.html manifest.json sw.js js css images dev /tmp/app/
    cd /tmp/app
    ruby dev/build.rb
    cp -r build/* /out/
  '
done

set -- $(ls "$builds")
echo

docker run --rm -v "$PWD/dev/test":/tests:ro -v "$builds":/builds:ro \
  mcr.microsoft.com/playwright:v$PLAYWRIGHT_VERSION-noble sh -c "
  set -e
  cd /tmp
  npm init -y > /dev/null
  npm install --silent --no-audit --no-fund playwright@$PLAYWRIGHT_VERSION
  cp /tests/swtest.mjs /tests/wakelocktest.mjs .
  node swtest.mjs /builds/$1 /builds/$2
  echo
  node wakelocktest.mjs /builds/$1
"
