/**
 * The React measurement harness.
 *
 * Every console block, warning text and number on the React pages comes from
 * here — a real React render in the system Firefox, driven over WebDriver BiDi.
 *
 * Why a bundler is involved at all: **React 19 ships no UMD build**. There is no
 * `<script src="react.development.js">` any more, so anything that runs in a
 * browser has to be bundled first. esbuild is used because it is fast and its
 * `define` makes the development/production distinction explicit, which is the
 * whole point of several Phase 0 pages.
 *
 * One engine only (Firefox 153 on this machine). Nothing here is a
 * cross-browser claim; React's behaviour at this level is engine-independent,
 * but timings are not, and pages say so.
 */
import puppeteer from 'puppeteer-core';
import * as esbuild from 'esbuild';
import http from 'node:http';
import {mkdtemp, writeFile, rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';

export const FIREFOX = '/usr/bin/firefox';

/**
 * Bundle a React entry module.
 *
 * `mode` sets `process.env.NODE_ENV`, which is what actually selects React's
 * development or production build — not a separate file, a dead-code branch.
 */
export async function bundle(source, {mode = 'development', jsx = true} = {}) {
  const dir = await mkdtemp(join(tmpdir(), 'react-p0-'));
  const entry = join(dir, jsx ? 'entry.jsx' : 'entry.js');
  await writeFile(entry, source);
  try {
    const out = await esbuild.build({
      entryPoints: [entry],
      bundle: true,
      write: false,
      format: 'iife',
      target: 'es2022',
      jsx: 'automatic',
      minify: mode === 'production',
      define: {'process.env.NODE_ENV': JSON.stringify(mode)},
      absWorkingDir: process.cwd(),
      nodePaths: [join(process.cwd(), 'node_modules')],
    });
    return out.outputFiles[0].text;
  } finally {
    await rm(dir, {recursive: true, force: true});
  }
}

/** A browser with an isolated profile — Firefox refuses to start otherwise. */
export async function launch() {
  return puppeteer.launch({
    browser: 'firefox',
    executablePath: FIREFOX,
    headless: true,
    userDataDir: new URL('./.ffprof', import.meta.url).pathname,
  });
}

/**
 * Bundle a React app, load it in Firefox, and return everything it printed.
 *
 * Console messages are captured rather than the DOM, because the ordering of
 * render/effect/commit logs is exactly what most of Phase 0 is about. `html`
 * returns the final markup so a page can show what React actually produced.
 */
export async function runApp(source, {mode = 'development', wait = 400} = {}) {
  const code = await bundle(source, {mode});
  const server = http.createServer((req, res) => {
    if (req.url === '/app.js') {
      res.writeHead(200, {'Content-Type': 'text/javascript'}).end(code);
      return;
    }
    res.writeHead(200, {'Content-Type': 'text/html; charset=utf-8'}).end(
      `<!doctype html><meta charset="utf-8"><title>react-p0</title>` +
        `<div id="root"></div><script src="/app.js"></script>`,
    );
  });
  await new Promise((r) => server.listen(0, '127.0.0.1', r));
  const {port} = server.address();

  const browser = await launch();
  const logs = [];
  try {
    const page = await browser.newPage();
    page.on('console', (m) => logs.push({type: m.type(), text: m.text()}));
    page.on('pageerror', (e) => logs.push({type: 'pageerror', text: `${e.name}: ${e.message}`}));
    await page.goto(`http://127.0.0.1:${port}/`, {waitUntil: 'load'});
    await new Promise((r) => setTimeout(r, wait));
    const html = await page.evaluate(() => document.getElementById('root').innerHTML);
    const ua = await page.evaluate(() => navigator.userAgent.match(/Firefox\/[\d.]+/)[0]);
    return {logs, html, ua, bytes: code.length};
  } finally {
    await browser.close();
    await new Promise((r) => server.close(r));
  }
}

/** Print a labelled block, so script output maps onto a page section. */
export function section(title) {
  console.log(`\n=== ${title} ===`);
}

/** Print captured page logs the way they appeared, one per line. */
export function printLogs(logs, {prefix = '  '} = {}) {
  for (const l of logs) {
    const tag = l.type === 'log' ? '' : `[${l.type}] `;
    console.log(`${prefix}${tag}${l.text}`);
  }
}

/** Print `key: value` rows with aligned keys. */
export function rows(obj) {
  const pad = Math.max(...Object.keys(obj).map((k) => k.length));
  for (const [k, v] of Object.entries(obj)) {
    console.log(`  ${k.padEnd(pad)}  ${typeof v === 'object' ? JSON.stringify(v) : v}`);
  }
}
