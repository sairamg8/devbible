/**
 * Phase 0 — does a `media="print"` stylesheet block the first paint?
 *
 * ex05 produced a surprise: the page with an extra print stylesheet painted
 * LATER than the page with two parallel screen stylesheets, which is the
 * opposite of the usual claim. Rather than write the usual claim on a page,
 * this isolates the question.
 *
 * Controls, all with the same 600ms server delay:
 *   none    — no stylesheet at all              (floor)
 *   screen  — one normal stylesheet             (known to block)
 *   print   — one media="print" stylesheet only (the question)
 *   noscript-ish: an unmatched media query      (same question, different form)
 */
import {launch, engine, serve, section, rows} from './harness.mjs';

const DELAY = 600;
const CSS = 'body { background: #eee; }';
const page1 = (head) => `<!doctype html><html><head>${head}</head><body><p>text</p></body></html>`;

const server = await serve({
  '/none.html': {body: page1('')},
  '/screen.html': {body: page1('<link rel="stylesheet" href="/s.css">')},
  '/print.html': {body: page1('<link rel="stylesheet" href="/s.css" media="print">')},
  '/unmatched.html': {body: page1('<link rel="stylesheet" href="/s.css" media="(min-width: 99999px)">')},
  '/s.css': {body: CSS, type: 'text/css', delay: DELAY},
});

const browser = await launch();
const page = await browser.newPage();
console.log('engine:', await engine(page));
console.log(`stylesheet delayed ${DELAY}ms server-side; FCP is median of 5 after warm-up\n`);

async function fcp(path) {
  await page.goto('about:blank');
  await page.goto(server.origin + path, {waitUntil: 'networkidle0'});
  return page.evaluate(() => {
    const e = performance.getEntriesByName('first-contentful-paint')[0];
    return Math.round(e?.startTime ?? -1);
  });
}

for (let i = 0; i < 3; i++) await fcp('/screen.html'); // warm up

const median = (xs) => xs.slice().sort((a, b) => a - b)[Math.floor(xs.length / 2)];
const out = {};
for (const [label, path] of [
  ['no stylesheet (floor)', '/none.html'],
  ['media="print"', '/print.html'],
  ['media not matching', '/unmatched.html'],
  ['normal stylesheet', '/screen.html'],
]) {
  const runs = [];
  for (let i = 0; i < 5; i++) runs.push(await fcp(path));
  out[label] = `FCP ${String(median(runs)).padStart(5)}ms   runs ${JSON.stringify(runs)}`;
}

section(`Does a non-matching stylesheet block the first paint? — ${await engine(page)}`);
rows(out);

section('Verdict');
const nums = Object.fromEntries(
  Object.entries(out).map(([k, v]) => [k, Number(v.match(/FCP\s+(\d+)/)[1])]),
);
const floor = nums['no stylesheet (floor)'];
for (const [k, v] of Object.entries(nums)) {
  if (k === 'no stylesheet (floor)') continue;
  const blocked = v - floor > DELAY * 0.5;
  console.log(`  ${k.padEnd(22)} ${v}ms  (floor ${floor}ms)  → ${blocked ? 'BLOCKS the first paint' : 'does not block'}`);
}

await browser.close();
await server.close();
