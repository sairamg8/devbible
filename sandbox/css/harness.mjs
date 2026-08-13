/**
 * The CSS measurement harness.
 *
 * Every number, computed value and box measurement on the CSS pages comes from
 * here — a real render in the system Firefox, driven over WebDriver BiDi.
 *
 * There is no Chromium or WebKit on this machine, so every result this file
 * produces is a claim about ONE engine. Pages label it. Cross-browser
 * availability comes from `web-features` (see baseline.mjs), never from a
 * measurement taken here.
 */
import puppeteer from 'puppeteer-core';
import http from 'node:http';

export const FIREFOX = '/usr/bin/firefox';

/**
 * A browser with an isolated profile.
 *
 * The isolated profile is not optional: `firefox --headless` refuses to start
 * when any other Firefox is running, with "Firefox is already running, but is
 * not responding."
 */
export async function launch() {
  return puppeteer.launch({
    browser: 'firefox',
    executablePath: FIREFOX,
    headless: true,
    userDataDir: new URL('./.ffprof', import.meta.url).pathname,
  });
}

/** The engine string every measurement is labelled with. */
export async function engine(page) {
  return page.evaluate(() => navigator.userAgent.match(/Firefox\/[\d.]+/)[0]);
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
