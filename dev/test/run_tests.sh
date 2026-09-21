#!/bin/sh
# Syntax checks the app's JavaScript and runs the tests using Node in Docker.
# Usage: dev/test/run_tests.sh
set -e

cd "$(dirname "$0")/../.."

docker run --rm -v "$PWD":/app:ro -w /app node:22-alpine sh -c '
  set -e
  for f in js/*.js sw.js; do
    case "$f" in
      *.min.js|js/main.js) continue ;;
    esac
    node --experimental-default-type=module --check "$f"
  done
  echo "Syntax check passed"
  echo
  node --import ./dev/test/register.mjs dev/test/gridtest.mjs
'
