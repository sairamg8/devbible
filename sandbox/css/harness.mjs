/**
 * The CSS measurement harness.
 *
 * Every number, computed value and box measurement on the CSS pages comes from
 * here — a real render, driven over WebDriver BiDi / CDP.
 *
 * ── Two engines, chosen with ENGINE= ─────────────────────────────────────────
 *
 *   node ex09-selector-families.mjs                 # Gecko  (default)
 *   ENGINE=blink node ex09-selector-families.mjs    # Blink, via Edge
 *
 * Until 2026-08-31 this file could only drive Gecko, because Firefox was the
 * only browser on the machine — recorded as open question 1 in
 * `docs/css/README.md`, and never a judgement about CSS. Microsoft Edge is now
 * installed, so a Blink build is reachable and that question is answered.
 *
 * 🔴 Every SCRIPT stays engine-agnostic. Nothing below this file names a
 * browser, so the cross-check is `ENGINE=blink` over the same committed
 * scripts — not a second corpus of measurement code to keep in sync.
 *
 * WebKit is still absent, so a two-engine agreement is not "cross-browser":
 * Safari can differ from both. Cross-browser AVAILABILITY still comes from
 * `web-features` (see baseline.mjs), never from a measurement taken here.
 */
import fs from 'node:fs';
import puppeteer from 'puppeteer-core';
import http from 'node:http';

export const ENGINES = {
  firefox: {browser: 'firefox', path: '/usr/bin/firefox',        label: 'Gecko', ua: 'Firefox\\/[\\d.]+'},
  blink:   {browser: 'chrome',  path: '/usr/bin/microsoft-edge', label: 'Blink', ua: 'Edg\\/[\\d.]+'},
};

export const ENGINE = process.env.ENGINE ?? 'firefox';
const CONFIG = ENGINES[ENGINE];
if (!CONFIG) throw new Error(`unknown ENGINE "${ENGINE}" — use ${Object.keys(ENGINES).join(' | ')}`);

export const FIREFOX = ENGINES.firefox.path;   // kept: older scripts import it

/**
 * A browser with an isolated, PER-PROCESS profile.
 *
 * Isolation is not optional — `firefox --headless` refuses to start while any
 * other Firefox is running ("Firefox is already running, but is not
 * responding"). A single shared profile directory was almost as bad: running
 * the twelve scripts in a loop failed 10 of 12 with `kill EACCES`, each run
 * inheriting the previous run's lock. Keying the profile on the pid makes a
 * stale lock impossible, and leaves the committed `.ffprof` untouched.
 */
export async function launch() {
  const dir = new URL(`./.profiles/${ENGINE}-${process.pid}`, import.meta.url).pathname;
  fs.mkdirSync(dir, {recursive: true});
  const browser = await puppeteer.launch({
    browser: CONFIG.browser,
    executablePath: CONFIG.path,
    headless: true,
    userDataDir: dir,
  });
  const close = browser.close.bind(browser);
  browser.close = async () => {
    try {
      await close();
    } catch (e) {
      // 🔴 `/usr/bin/firefox` on this machine is a shell wrapper that execs the
      // SNAP at /snap/bin/firefox. The snap-confined process is not ours to
      // signal, so Puppeteer's teardown throws `kill EACCES` — every time, on
      // Gecko only, and always AFTER the measurement has been taken and
      // printed. Left unhandled it made 10 of 12 scripts "fail" in a batch run
      // while their output was complete and correct, which is the worst kind of
      // failure: one that discards good data and looks like a broken harness.
      //
      // The browser exits on its own when the profile goes; what we must not do
      // is lose the run over it. Anything that is NOT this specific teardown
      // race still throws.
      if (!/kill EACCES|unable to kill the process/i.test(e.message)) throw e;
    } finally {
      fs.rmSync(dir, {recursive: true, force: true});
    }
  };
  return browser;
}

/** The engine string every measurement is labelled with. */
export async function engine(page) {
  return page.evaluate((r) => navigator.userAgent.match(new RegExp(r))[0], CONFIG.ua);
}

/**
 * Load an HTML string and run a probe against it.
 *
 * `setContent` is used rather than a data: URL so that relative URLs, the
 * document's base and `document.styleSheets` all behave normally.
 */
export async function render(html, probe, {width = 900, height = 700} = {}) {
  const browser = await launch();
  try {
    const page = await browser.newPage();
    await page.setViewport({width, height});
    await page.setContent(html, {waitUntil: 'load'});
    return await page.evaluate(probe);
  } finally {
    await browser.close();
  }
}

/**
 * Run several probes against several documents in one browser.
 *
 * `cases` is `[{name, html, probe, viewport}]`. Reusing one browser matters:
 * a Firefox launch costs about a second, and some scripts have twenty cases.
 */
export async function renderAll(cases, {width = 900, height = 700} = {}) {
  const browser = await launch();
  const out = [];
  try {
    const page = await browser.newPage();
    for (const c of cases) {
      const vp = c.viewport ?? {width, height};
      await page.setViewport(vp);
      await page.setContent(c.html, {waitUntil: 'load'});
      out.push({name: c.name, result: await page.evaluate(c.probe)});
    }
  } finally {
    await browser.close();
  }
  return out;
}

/**
 * A static server whose responses can be delayed.
 *
 * Needed for anything about the network: render-blocking CSS, `@import`
 * serialisation, `media` on a link. `setContent` cannot show those because it
 * has no network in it.
 *
 * `routes` maps a path to `{body, type, delay}`.
 */
export async function serve(routes) {
  const server = http.createServer(async (req, res) => {
    const route = routes[req.url];
    if (!route) {
      res.writeHead(404).end('not found');
      return;
    }
    if (route.delay) await new Promise((r) => setTimeout(r, route.delay));
    res.writeHead(200, {
      'Content-Type': route.type ?? 'text/html; charset=utf-8',
      'Cache-Control': 'no-store',
    });
    res.end(route.body);
  });
  await new Promise((r) => server.listen(0, '127.0.0.1', r));
  const {port} = server.address();
  return {
    origin: `http://127.0.0.1:${port}`,
    close: () => new Promise((r) => server.close(r)),
  };
}

/** Print a labelled block, so script output maps onto a page section. */
export function section(title) {
  console.log(`\n=== ${title} ===`);
}

/** Print `key: value` rows with aligned keys. */
export function rows(obj) {
  const pad = Math.max(...Object.keys(obj).map((k) => k.length));
  for (const [k, v] of Object.entries(obj)) {
    console.log(`  ${k.padEnd(pad)}  ${typeof v === 'object' ? JSON.stringify(v) : v}`);
  }
}
