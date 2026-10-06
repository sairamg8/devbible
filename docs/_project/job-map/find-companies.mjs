// Finds companies on its own (no hand-made list) from open sources, then probes their job boards.
//   YC "hiring" list  -> website/name -> guess Greenhouse/Lever/Ashby/SmartRecruiters/Workable board
//   Arbeitnow, Remotive, RemoteOK, Himalayas public job APIs -> jobs + company names directly
// Writes discovered.json (companies) and jobs-agg.json (jobs from aggregator APIs). Usage: node find-companies.mjs
import { readFileSync, writeFileSync } from 'node:fs';
import { ATS } from './ats.mjs';
import { classify, countryOf } from './lib.mjs';

const UA = { 'user-agent': 'devbible-jobmap/1.0' };
const j = async (u) => { try { const r = await fetch(u, { headers: UA, signal: AbortSignal.timeout(40000) }); return r.ok ? await r.json() : null; } catch { return null; } };
const strip = (h = '') => String(h).replace(/<[^>]+>/g, ' ');
const pool = async (items, n, fn) => { const q = [...items]; await Promise.all(Array.from({ length: n }, async () => { for (let x; (x = q.shift()); ) await fn(x); })); };
const known = new Set(JSON.parse(readFileSync(new URL('./companies.json', import.meta.url), 'utf8')).map((c) => c.name.toLowerCase()));
const PROBE = ['greenhouse', 'lever', 'ashby', 'workable', 'smartrecruiters'];

// ---- 1. Y Combinator companies that are hiring ----
const yc = (await j('https://yc-oss.github.io/api/companies/hiring.json')) ?? [];
console.error(`YC hiring: ${yc.length}`);
const discovered = [];
await pool(yc, 14, async (c) => {
  if (known.has(c.name.toLowerCase())) return;
  const host = (() => { try { return new URL(c.website).hostname.replace(/^www\./, '').split('.')[0]; } catch { return ''; } })();
  const cands = [...new Set([host, c.slug, c.name.toLowerCase().replace(/[^a-z0-9]/g, ''), c.name.toLowerCase().replace(/[^a-z0-9]+/g, '-')].filter(Boolean))];
  for (const slug of cands) for (const ats of PROBE) {
    try {
      const jobs = await ATS[ats].list(slug);
      if (jobs && jobs.length) {
        discovered.push({ name: c.name, category: 'startup', tier: 0, hq: countryOf(c.all_locations).toLowerCase().replace('remote', 'us').replace('other', 'us'), src: 'yc', ats, slug, website: c.website, size: Number(c.team_size) || null, blurb: c.one_liner });
        return;
      }
    } catch {}
  }
});
console.error(`YC companies with a readable board: ${discovered.length}`);

// ---- 2. Aggregator APIs: jobs come with company names ----
const agg = []; // {company, title, location, url, desc, src}
for (let p = 1; p <= 12; p++) {
  const d = await j(`https://www.arbeitnow.com/api/job-board-api?page=${p}`);
  if (!d?.data?.length) break;
  d.data.forEach((x) => agg.push({ company: x.company_name, title: x.title, location: x.location + (x.remote ? ' (remote)' : '') + ', Germany', url: x.url, desc: strip(x.description), src: 'arbeitnow' }));
}
const rem = await j('https://remotive.com/api/remote-jobs?category=software-dev&limit=500');
(rem?.jobs ?? []).forEach((x) => agg.push({ company: x.company_name, title: x.title, location: x.candidate_required_location || 'Remote', url: x.url, desc: strip(x.description), src: 'remotive' }));
const rok = await j('https://remoteok.com/api');
(Array.isArray(rok) ? rok.slice(1) : []).forEach((x) => agg.push({ company: x.company, title: x.position, location: x.location || 'Remote', url: x.url, desc: strip(x.description), src: 'remoteok' }));
for (let off = 0; off < 400; off += 20) {
  const d = await j(`https://himalayas.app/jobs/api?limit=20&offset=${off}`);
  if (!d?.jobs?.length) break;
  d.jobs.forEach((x) => agg.push({ company: x.companyName, title: x.title, location: (x.locationRestrictions ?? []).join(', ') || 'Remote', url: x.applicationLink || x.guid, desc: strip(x.description), src: 'himalayas' }));
}
console.error(`aggregator rows: ${agg.length}`);

const have = new Set([...known, ...discovered.map((d) => d.name.toLowerCase())]);
const aggJobs = [], aggCos = new Map();
for (const a of agg) {
  if (!a.company || !a.url || have.has(a.company.toLowerCase())) continue;
  const k = classify({ title: a.title, location: a.location, url: a.url, desc: a.desc }, 'any');
  if (!k) continue;
  aggJobs.push({ company: a.company, ...k, country: countryOf(a.location), src: a.src });
  if (!aggCos.has(a.company)) aggCos.set(a.company, { name: a.company, category: 'startup', tier: 0, hq: countryOf(a.location).toLowerCase(), src: a.src, ats: 'aggregator' });
}
writeFileSync(new URL('./discovered.json', import.meta.url), JSON.stringify([...discovered, ...aggCos.values()], null, 1));
writeFileSync(new URL('./jobs-agg.json', import.meta.url), JSON.stringify(aggJobs));
console.log(`discovered ${discovered.length} board companies + ${aggCos.size} aggregator companies (${aggJobs.length} roles)`);
