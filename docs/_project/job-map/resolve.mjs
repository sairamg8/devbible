// name -> { ats, slug } by (1) preset list, (2) guessing public board slugs, (3) rendering the careers page and spotting the job system.
import { readFileSync } from 'node:fs';
import { ATS } from './ats.mjs';

export const presets = () => JSON.parse(readFileSync(new URL('./companies.json', import.meta.url), 'utf8'));

const slugs = (n) => {
  const base = n.toLowerCase().replace(/[^a-z0-9 ]/g, '').trim();
  return [...new Set([base.replace(/ /g, ''), base.replace(/ /g, '-'), base.split(' ')[0]])];
};
const SIMPLE = ['greenhouse', 'lever', 'ashby', 'smartrecruiters'];

// Pulls an ATS id out of any URL seen on the page.
export function sniff(url) {
  let m;
  if ((m = url.match(/(?:job-)?boards\.greenhouse\.io\/(?:embed\/job_board\?for=)?([\w-]+)/)) && !['embed', 'v1'].includes(m[1])) return { ats: 'greenhouse', slug: m[1] };
  if ((m = url.match(/jobs\.lever\.co\/([\w-]+)/))) return { ats: 'lever', slug: m[1] };
  if ((m = url.match(/jobs\.ashbyhq\.com\/([\w.-]+)/))) return { ats: 'ashby', slug: m[1] };
  if ((m = url.match(/(?:careers|jobs)\.smartrecruiters\.com\/([\w-]+)/))) return { ats: 'smartrecruiters', slug: m[1] };
  if ((m = url.match(/\/\/([\w-]+)\.(wd\d+)\.myworkdayjobs\.com\/(?:[a-z]{2}-[A-Z]{2}\/)?([\w-]+)/)) && !/^(wday|cxs)$/.test(m[3])) return { ats: 'workday', slug: `${m[1]}.${m[2]}.myworkdayjobs.com|${m[1]}|${m[3]}` };
  return null;
}

async function alive(url) {
  try { const r = await fetch(url, { redirect: 'follow', signal: AbortSignal.timeout(8000), headers: { 'user-agent': 'Mozilla/5.0' } }); return r.ok ? r.url : null; } catch { return null; }
}

export async function resolve(name, { browser } = {}) {
  const hit = presets().find((c) => c.name.toLowerCase() === name.toLowerCase() && c.ats);
  if (hit) return { ats: hit.ats, slug: hit.slug, via: 'preset' };
  // 2) guess slugs on the open boards
  for (const slug of slugs(name)) for (const ats of SIMPLE) {
    try { const jobs = await ATS[ats].list(slug); if (jobs && jobs.length) return { ats, slug, via: 'slug-guess' }; } catch {}
  }
  // 3) find the careers page and watch what it loads
  const s = slugs(name)[0];
  const cands = ['careers.', 'jobs.', 'www.'].flatMap((p) => ['com', 'in', 'io', 'co'].flatMap((t) => (p === 'www.' ? [`https://www.${s}.${t}/careers`, `https://www.${s}.${t}/jobs`] : [`https://${p}${s}.${t}`])));
  let page, careersUrl;
  for (const u of cands) { const live = await alive(u); if (live) { careersUrl = live; break; } }
  if (!careersUrl || !browser) return { ats: null, careersUrl, via: 'none' };
  page = await browser.newPage();
  const seen = new Set();
  page.on('request', (r) => seen.add(r.url()));
  try { await page.goto(careersUrl, { waitUntil: 'networkidle', timeout: 45000 }); await page.waitForTimeout(1500); } catch {}
  const links = await page.$$eval('a[href],iframe[src]', (e) => e.map((x) => x.href || x.src)).catch(() => []);
  const dom = await page.$$eval('a', (as) => as.map((a) => ({ title: a.textContent.trim().replace(/\s+/g, ' '), url: a.href })).filter((a) => /engineer|developer|sde/i.test(a.title) && a.title.length < 120)).catch(() => []);
  await page.close();
  for (const u of [...links, ...seen]) { const s2 = sniff(u); if (s2) return { ...s2, via: 'careers-page', careersUrl }; }
  return { ats: null, careersUrl, via: 'dom', dom };
}
