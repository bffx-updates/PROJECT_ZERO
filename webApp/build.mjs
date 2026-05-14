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
import { createHash } from 'node:crypto';
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
  for (const name of ['index.html', 'app.js', 'app.css', 'manifest.webmanifest', 'sw.js']) {
    const p = join(DATA_DIR, name);
    if (existsSync(p)) await rm(p);
  }
  // icons/ recriado a cada build
  const iconsDir = join(DATA_DIR, 'icons');
  if (existsSync(iconsDir)) await rm(iconsDir, { recursive: true, force: true });
}

async function copyPwaAssets() {
  // Manifest
  const src = join(WEBAPP_DIR, 'manifest.webmanifest');
  if (existsSync(src)) await copyFile(src, join(DATA_DIR, 'manifest.webmanifest'));
  // Icons
  const iconsSrc = join(WEBAPP_DIR, 'icons');
  if (existsSync(iconsSrc)) {
    const iconsOut = join(DATA_DIR, 'icons');
    await mkdir(iconsOut, { recursive: true });
    const files = await readdir(iconsSrc);
    for (const f of files) {
      await copyFile(join(iconsSrc, f), join(iconsOut, f));
    }
  }
}

async function buildHTML() {
  // HTML com link de manifest + meta tags pra iOS Safari "Add to Home Screen".
  // No Android Chrome o servico HTTP em IP local nao dispara o banner de
  // install automatico, mas o usuario pode usar "Adicionar a tela inicial"
  // no menu manualmente. Em ambos, o manifest define icone, nome, cor.
  const html = `<!doctype html>
<html lang="pt-BR">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">
<meta name="theme-color" content="#0a0a0c">
<title>BFMIDI</title>
<link rel="manifest" href="manifest.webmanifest">
<link rel="icon" type="image/svg+xml" href="icons/app.svg">
<link rel="icon" type="image/png" sizes="192x192" href="icons/app-192.png">
<link rel="apple-touch-icon" href="icons/app-192.png">
<meta name="apple-mobile-web-app-capable" content="yes">
<meta name="apple-mobile-web-app-status-bar-style" content="black-translucent">
<meta name="apple-mobile-web-app-title" content="BFMIDI">
<meta name="mobile-web-app-capable" content="yes">
<link rel="stylesheet" href="app.css">
</head>
<body>
<div id="root"></div>
<script src="app.js"></script>
<script>if('serviceWorker' in navigator){window.addEventListener('load',function(){navigator.serviceWorker.register('./sw.js').catch(function(){})})}</script>
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

// Service worker pra producao. APP_SHELL reflete os arquivos que o build
// emite em data/ — diferente de webApp/sw.js (dev), que cita app.jsx e
// vendor/* nao existentes em prod. Cross-origin (API HTTP do dispositivo)
// continua passthrough.
//
// CACHE_NAME e versionado automaticamente pelo hash do conteudo emitido
// (index.html + app.js + app.css + manifest). Sempre que o app muda, o
// hash muda -> o SW novo tem CACHE_NAME novo -> o activate apaga o cache
// antigo e o cliente recebe a versao atual. Sem isso, o SW e cache-first
// e serviria a versao velha pra sempre, mesmo depois de atualizar o
// littlefs.bin no ESP32. Roda DEPOIS de buildHTML/CSS/JS (precisa dos
// arquivos ja escritos em data/ pra fazer o hash).
async function buildSW() {
  const hashParts = [];
  for (const name of ['index.html', 'app.js', 'app.css', 'manifest.webmanifest']) {
    const p = join(DATA_DIR, name);
    if (existsSync(p)) hashParts.push(await readFile(p));
  }
  const cacheVersion = createHash('sha256')
    .update(Buffer.concat(hashParts))
    .digest('hex')
    .slice(0, 12);
  const sw = `// BFMIDI Editor — Service Worker (gerado por webApp/build.mjs).
const CACHE_NAME = 'bfmidi-prod-${cacheVersion}';
const APP_SHELL = [
  './',
  './index.html',
  './app.css',
  './app.js',
  './manifest.webmanifest',
  './icons/app.svg',
  './icons/app-192.png',
  './icons/app-512.png',
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => cache.addAll(APP_SHELL).catch(() => null))
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k))
      )
    )
  );
  self.clients.claim();
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;

  const url = new URL(req.url);
  // Cross-origin (ex: API HTTP do dispositivo em outro IP) -> passthrough.
  if (url.origin !== self.location.origin) return;

  event.respondWith(
    caches.match(req).then((cached) => {
      if (cached) return cached;
      return fetch(req).then((resp) => {
        if (resp && resp.ok) {
          const p = url.pathname.toLowerCase();
          if (p.endsWith('.js')   || p.endsWith('.css') ||
              p.endsWith('.svg')  || p.endsWith('.png') ||
              p.endsWith('.webmanifest') || p.endsWith('.json')) {
            const copy = resp.clone();
            caches.open(CACHE_NAME).then((c) => c.put(req, copy)).catch(() => {});
          }
        }
        return resp;
      }).catch(() => {
        if (req.mode === 'navigate') {
          return caches.match('./index.html');
        }
        return new Response('', { status: 504, statusText: 'offline' });
      });
    })
  );
});
`;
  await writeFile(join(DATA_DIR, 'sw.js'), sw, 'utf8');
}

async function buildJS() {
  const config = {
    // app.jsx vira o entrypoint direto. esbuild prepende automaticamente
    // imports de build/react-inject.js (via "inject") em todo modulo que
    // mencione React ou ReactDOM como identificador livre. Isso troca o
    // React global do source pelo shim Preact em escopo de modulo.
    entryPoints: [join(WEBAPP_DIR, 'app.jsx')],
    outfile: join(DATA_DIR, 'app.js'),
    bundle: true,
    minify: true,
    target: ['es2020'],
    format: 'iife',
    loader: {
      '.jsx': 'jsx',
      '.js': 'jsx',
    },
    jsx: 'automatic',
    jsxImportSource: 'preact',
    alias: PREACT_ALIASES,
    inject: [join(WEBAPP_DIR, 'build', 'react-inject.js')],
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
  const main = ['index.html', 'app.js', 'app.css', 'manifest.webmanifest', 'sw.js'];
  for (const name of main) {
    const p = join(DATA_DIR, name);
    if (!existsSync(p)) continue;
    const s = await stat(p);
    total += s.size;
    console.log(`  ${name.padEnd(22)} ${formatBytes(s.size).padStart(10)}`);
  }
  const iconsDir = join(DATA_DIR, 'icons');
  if (existsSync(iconsDir)) {
    const files = await readdir(iconsDir);
    for (const f of files) {
      const p = join(iconsDir, f);
      const s = await stat(p);
      total += s.size;
      console.log(`  ${('icons/' + f).padEnd(22)} ${formatBytes(s.size).padStart(10)}`);
    }
  }
  const pct = ((total / PARTITION_SIZE) * 100).toFixed(1);
  console.log(`  ${'TOTAL'.padEnd(22)} ${formatBytes(total).padStart(10)}   (${pct}% da particao LittleFS de ${formatBytes(PARTITION_SIZE)})`);
}

async function main() {
  await ensureCleanData();
  await Promise.all([buildHTML(), buildCSS(), buildJS(), copyPwaAssets()]);
  // buildSW depois: versiona o CACHE_NAME pelo hash dos arquivos ja
  // emitidos em data/.
  await buildSW();
  if (!watch) await report();
}

main().catch((e) => {
  console.error('[build] erro:', e);
  process.exit(1);
});
