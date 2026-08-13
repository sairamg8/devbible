/**
 * Phase 0 — render-blocking CSS, and why `@import` is worse than a second
 * `<link>`.
 *
 * This needs a real network, so it uses the delaying static server rather than
 * `setContent`. Each stylesheet is delayed by a known amount and we measure
 * First Contentful Paint against it.
 *
 * The comparison is fair by construction: every case ships exactly the same
 * bytes with exactly the same per-file delay. Only the delivery shape changes.
 */
import {launch, engine, serve, section, rows} from './harness.mjs';

const DELAY = 500;
const A = 'body { background: #eee; font: 16px system-ui; }';
const B = '.b { color: rebeccapurple; }';

const routes = {
  // 1. one blocking stylesheet
  '/one.html': {body: `<!doctype html><html><head>
      <link rel="stylesheet" href="/a.css">
    </head><body><p class="b">text</p></body></html>`},

  // 2. two parallel stylesheets
  '/parallel.html': {body: `<!doctype html><html><head>
      <link rel="stylesheet" href="/a.css">
      <link rel="stylesheet" href="/b.css">
    </head><body><p class="b">text</p></body></html>`},

  // 3. the same two, chained with @import — b.css cannot even be discovered
  //    until a-with-import.css has arrived and been parsed
  '/import.html': {body: `<!doctype html><html><head>
      <link rel="stylesheet" href="/a-with-import.css">
    </head><body><p class="b">text</p></body></html>`},

  // 4. the second sheet marked as print — not render-blocking
  '/media.html': {body: `<!doctype html><html><head>
      <link rel="stylesheet" href="/a.css">
      <link rel="stylesheet" href="/b.css" media="print">
    </head><body><p class="b">text</p></body></html>`},

  '/a.css': {body: A, type: 'text/css', delay: DELAY},
  '/b.css': {body: B, type: 'text/css', delay: DELAY},
  '/a-with-import.css': {body: `@import url("/b.css");\n${A}`, type: 'text/css', delay: DELAY},
};

const server = await serve(routes);
const browser = await launch();
const page = await browser.newPage();
console.log('engine:', await engine(page));
console.log(`every stylesheet delayed ${DELAY}ms server-side\n`);

async function measure(path) {
  await page.goto('about:blank');
  await page.goto(server.origin + path, {waitUntil: 'networkidle0'});
  return page.evaluate(() => {
    const fcp = performance.getEntriesByName('first-contentful-paint')[0];
    const sheets = performance.getEntriesByType('resource').filter((r) => r.name.endsWith('.css'));
    return {
      fcp: Math.round(fcp?.startTime ?? -1),
      sheets: sheets.length,
      // when each stylesheet request STARTED — the tell for serialisation
      starts: sheets.map((s) => Math.round(s.startTime)),
      ends: sheets.map((s) => Math.round(s.responseEnd)),
    };
  });
}

// The first navigation in a fresh browser carries start-up cost that has
// nothing to do with CSS: measured cold, a single stylesheet "cost" more than
// two parallel ones, purely because its request started 80ms later. Warm up
// first, then take the median of several runs.
for (let i = 0; i < 3; i++) await measure('/one.html');

const median = (xs) => xs.slice().sort((a, b) => a - b)[Math.floor(xs.length / 2)];

section('First Contentful Paint by delivery shape (median of 5, after warm-up)');
const results = {};
for (const [label, path] of [
  ['1 blocking sheet', '/one.html'],
  ['2 sheets, parallel <link>', '/parallel.html'],
  ['2 sheets, chained @import', '/import.html'],
]) {
  const runs = [];
  for (let i = 0; i < 5; i++) runs.push(await measure(path));
  const r = runs[0];
  results[label] =
    `FCP ${String(median(runs.map((x) => x.fcp))).padStart(5)}ms   ` +
    `sheets ${r.sheets}   request start gap ${r.starts.length > 1 ? r.starts[1] - r.starts[0] : 0}ms`;
}
rows(results);

section('Reading it');
console.log('  Two parallel <link>s cost roughly one delay, not two — the requests');
console.log('  overlap, so the start gap is ~1ms.');
console.log('  @import cannot overlap: the second request is not discoverable until');
console.log('  the first stylesheet has arrived and been parsed. The start gap is a');
console.log('  full delay, and the delays ADD UP.');
console.log('  Whether a non-matching media stylesheet blocks is measured separately');
console.log('  and properly in ex06-does-print-block.mjs (it does not).');

await browser.close();
await server.close();
