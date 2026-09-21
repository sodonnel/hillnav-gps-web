// Node resolve hook standing in for the browser import map in index.html.
// A bare import such as 'UKGridPosition' resolves to js/UKGridPosition.js.
import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const JS_DIR = new URL('../../js/', import.meta.url);

export async function resolve(specifier, context, nextResolve) {
  if (/^[A-Za-z]\w*$/.test(specifier)) {
    const url = new URL(specifier + '.js', JS_DIR);
    if (existsSync(fileURLToPath(url))) {
      return { url: url.href, format: 'module', shortCircuit: true };
    }
  }
  return nextResolve(specifier, context);
}
