// For companies with no readable job board: find the real careers website, render it, and pull the position links off it.
// Usage: node crawl-careers.mjs [--limit N] [--only "Name1,Name2"]    -> careers-results.json
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { chromium } from 'playwright';
import { ATS } from './ats.mjs';
import { resolve } from './resolve.mjs';

const read = (n, d) => { try { return JSON.parse(readFileSync(new URL(n, import.meta.url), 'utf8')); } catch { return d; } };
const args = process.argv.slice(2);
const arg = (k) => { const i = args.indexOf(`--${k}`); return i < 0 ? null : args[i + 1]; };
const only = arg('only')?.split(',').map((s) => s.trim().toLowerCase());
const outFile = new URL('./careers-results.json', import.meta.url);
const done = new Map(read('./careers-results.json', []).map((r) => [r.name.toLowerCase(), r]));

const curated = read('./companies.json', []).filter((c) => !c.ats);
const unresolved = read('./unresolved.json', []);
const seen = new Set();
const pri = (x) => ({ wikipedia: 1, yc: 2 }[x.src] ?? 0);
let todo = [...curated, ...unresolved].sort((a, b) => pri(a) - pri(b)).filter((c) => !seen.has(c.name.toLowerCase()) && seen.add(c.name.toLowerCase()));
if (only) todo = todo.filter((c) => only.includes(c.name.toLowerCase()));
todo = todo.filter((c) => !done.has(c.name.toLowerCase()) || only);
if (arg('limit')) todo = todo.slice(0, Number(arg('limit')));
console.error(`${todo.length} companies to crawl`);

const ENG = /\b(engineer|developer|sde|programmer|architect|software|swe|frontend|front-end|backend|back-end|full[- ]?stack)\b/i;
const NOT = /\b(learn more|read more|blog|docs|documentation|developer (portal|docs|hub|tools|program|relations|advocate|support)|api|sdk|apply now|view all|see all|engineering blog|culture|life at)\b/i;
const MORE = /(open|current|all|available) (positions|roles|jobs|openings)|view (all )?(jobs|roles|openings|positions)|see (all )?(jobs|roles|openings|positions)|search (jobs|roles)|explore (jobs|roles|opportunities)|join (us|our team)|careers? (at|home)/i;

const HINTS = { Flipkart: 'https://www.flipkartcareers.com', Zomato: 'https://www.eternal.com', Myntra: 'https://www.myntra.com', Nykaa: 'https://www.nykaa.com' };
const browser = await chromium.launch({ executablePath: process.env.CHROME || undefined });

async function extract(page) {
  return page.$$eval('a[href]', (as) => as.map((a) => ({ title: (a.textContent || '').trim().replace(/\s+/g, ' '), url: a.href })).filter((a) => a.title.length > 6 && a.title.length < 110 && /^https?:/.test(a.url))).catch(() => []);
}
const jobLinks = (links) => {
  const m = new Map();
  for (const l of links) if (ENG.test(l.title) && !NOT.test(l.title) && !m.has(l.url)) m.set(l.url, { title: l.title, url: l.url, ...(l.location ? { location: l.location } : {}) });
  return [...m.values()].slice(0, 40);
};

async function crawl(c) {
  const out = { name: c.name, careersUrl: null, ats: null, slug: null, dom: [] };
  const r = await resolve(c.name, { browser, website: c.website ?? HINTS[c.name], quick: true });
  out.careersUrl = r.careersUrl ?? null;
  if (r.ats) {
    out.ats = r.ats; out.slug = r.slug; out.via = r.via;
    try { const raw = (await ATS[r.ats].list(r.slug)) ?? []; if (raw.length) return out; } catch {}
  }
  out.dom = jobLinks(r.dom ?? []);
  // one hop: follow an "open positions / view all jobs" link and read that page too
  if (!out.dom.length && out.careersUrl) {
    const page = await browser.newPage();
    try {
      await page.goto(out.careersUrl, { waitUntil: 'domcontentloaded', timeout: 30000 }); await page.waitForTimeout(3000);
      const links = await extract(page);
      const next = links.find((l) => MORE.test(l.title) && l.url !== out.careersUrl);
      if (next) {
        await page.goto(next.url, { waitUntil: 'domcontentloaded', timeout: 30000 }); await page.waitForTimeout(4000);
        out.dom = jobLinks(await extract(page));
        out.listUrl = next.url;
      }
    } catch {} finally { await page.close(); }
  }
  return out;
}

const results = [...done.values()];
let n = 0;
const queue = [...todo];
await Promise.all(Array.from({ length: 5 }, async () => {
  for (let c; (c = queue.shift()); ) {
    let r;
    try { r = await Promise.race([crawl(c), new Promise((_, rej) => setTimeout(() => rej(new Error('timeout')), 120000))]); }
    catch (e) { r = { name: c.name, careersUrl: null, ats: null, dom: [], error: e.message }; }
    const i = results.findIndex((x) => x.name.toLowerCase() === c.name.toLowerCase()); if (i >= 0) results.splice(i, 1);
    results.push(r);
    console.error(`${String(++n).padStart(4)}/${todo.length} ${c.name.padEnd(22)} ${r.ats ? 'board ' + r.ats : r.dom.length + ' links'} ${r.careersUrl ?? '-'}`);
    if (n % 10 === 0) writeFileSync(outFile, JSON.stringify(results, null, 1));
  }
}));
writeFileSync(outFile, JSON.stringify(results, null, 1));
await browser.close();
const ok = results.filter((r) => r.careersUrl).length;
console.log(`${results.length} companies: ${ok} careers sites found, ${results.filter((r) => r.dom.length).length} with position links, ${results.filter((r) => r.ats).length} with a job board`);
