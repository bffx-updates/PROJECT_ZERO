// Empacota esptool-js num bundle ES module local pra evitar dependencia
// de CDN em runtime. Output: esptool-bundle.js (commitado no repo).
//
// Roda uma vez quando atualizar a versao de esptool-js:
//   npm install
//   npm run build
//
// O index.html importa via "./esptool-bundle.js".

import { build } from 'esbuild';
import { writeFile } from 'node:fs/promises';

// Entrada virtual: re-exporta o que precisamos do esptool-js.
const ENTRY_SOURCE = `
export { ESPLoader, Transport } from 'esptool-js';
`;

const VIRTUAL_ENTRY = 'virtual:esptool-entry.js';

await build({
  stdin: {
    contents: ENTRY_SOURCE,
    resolveDir: process.cwd(),
    sourcefile: VIRTUAL_ENTRY,
    loader: 'js',
  },
  outfile: 'esptool-bundle.js',
  bundle: true,
  minify: true,
  format: 'esm',
  target: ['es2020'],
  platform: 'browser',
  logLevel: 'warning',
  legalComments: 'none',
});

console.log('[build] esptool-bundle.js gerado');
