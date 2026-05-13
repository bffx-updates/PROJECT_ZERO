// Build script: empacota o webApp em arquivos prontos pra LittleFS (../data/).
// Saida:
//   ../data/index.html  (HTML minimo, CSS inline opcional)
//   ../data/app.js      (bundle JS minificado, Preact substituindo React)
//   ../data/app.css     (CSS minificado)
//
// Uso:
//   cd webApp
//   npm install                (uma vez, instala esbuild + preact)
//   npm run build              (gera ../data/)
//   npm run dev                (rebuild on change)
//
// Depois roda o "ESP32 LittleFS Data Upload" no Arduino IDE pra subir o
// conteudo de data/ pro chip.

import { build, context } from 'esbuild';
import { mkdir, copyFile, readFile, writeFile, stat, readdir, rm } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { dirname, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const WEBAPP_DIR = __dirname;
const DATA_DIR = join(WEBAPP_DIR, '..', 'data');

const watch = process.argv.includes('--watch');

// preact/compat aliases pra qualquer "import React from 'react'" eventual.
// Como o app.jsx atual nao usa import, isso e mais defesa em profundidade.
const PREACT_ALIASES = {
  'react': 'preact/compat',
  'react-dom': 'preact/compat',
  'react/jsx-runtime': 'preact/jsx-runtime',
};

async function ensureCleanData() {
  if (!existsSync(DATA_DIR)) {
    await mkdir(DATA_DIR, { recursive: true });
    return;
  }
  // Preserva arquivos de runtime que o firmware escreve (wifi_sta.txt etc)
  // — so apaga o que o build gera.
  for (const name of ['index.html', 'app.js', 'app.css']) {
    const p = join(DATA_DIR, name);
    if (existsSync(p)) await rm(p);
  }
}

async function buildHTML() {
  // HTML minimo, sem PWA stuff (manifest/service worker), sem React via CDN,
  // sem Babel inline. Carrega so o bundle + CSS minificados que o ESP32 serve.
  const html = `<!doctype html>
<html lang="pt-BR">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">
<meta name="theme-color" content="#0a0a0c">
<title>BFMIDI</title>
<link rel="stylesheet" href="app.css">
</head>
<body>
<div id="root"></div>
<script src="app.js"></script>
</body>
</html>
`;
  await writeFile(join(DATA_DIR, 'index.html'), html, 'utf8');
}

async function buildCSS() {
  // esbuild minifica CSS tambem (loader: css com minify: true)
  await build({
    entryPoints: [join(WEBAPP_DIR, 'app.css')],
    outfile: join(DATA_DIR, 'app.css'),
    bundle: false,
    minify: true,
    loader: { '.css': 'css' },
    logLevel: 'silent',
  });
}

async function buildJS() {
  const config = {
    entryPoints: [join(WEBAPP_DIR, 'build', 'entry.js')],
    outfile: join(DATA_DIR, 'app.js'),
    bundle: true,
    minify: true,
    target: ['es2020'],
    format: 'iife',
    loader: {
      '.jsx': 'jsx',
      '.js': 'jsx', // entry.js tambem usa JSX-friendly transform pra app.jsx
    },
    jsx: 'automatic',
    jsxImportSource: 'preact',
    alias: PREACT_ALIASES,
    legalComments: 'none',
    logLevel: 'warning',
    define: {
      'process.env.NODE_ENV': '"production"',
    },
  };
  if (watch) {
    const ctx = await context(config);
    await ctx.watch();
    console.log('[build] watching webApp/ for changes...');
  } else {
    await build(config);
  }
}

function formatBytes(n) {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / 1024 / 1024).toFixed(2)} MB`;
}

const PARTITION_SIZE = 960 * 1024; // 0xF0000 = 960 KB (ver partitions.csv)

async function report() {
  let total = 0;
  console.log('\n[build] saida em data/:');
  for (const name of ['index.html', 'app.js', 'app.css']) {
    const p = join(DATA_DIR, name);
    const s = await stat(p);
    total += s.size;
    console.log(`  ${name.padEnd(14)} ${formatBytes(s.size).padStart(10)}`);
  }
  const pct = ((total / PARTITION_SIZE) * 100).toFixed(1);
  console.log(`  ${'TOTAL'.padEnd(14)} ${formatBytes(total).padStart(10)}   (${pct}% da particao LittleFS de ${formatBytes(PARTITION_SIZE)})`);
}

async function main() {
  await ensureCleanData();
  await Promise.all([buildHTML(), buildCSS(), buildJS()]);
  if (!watch) await report();
}

main().catch((e) => {
  console.error('[build] erro:', e);
  process.exit(1);
});
