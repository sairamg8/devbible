// Finds companies on its own (no hand-made list) from open sources, then probes their job boards.
//   YC "hiring" list  -> website/name -> guess Greenhouse/Lever/Ashby/SmartRecruiters/Workable board
//   Arbeitnow, Remotive, RemoteOK, Himalayas public job APIs -> jobs + company names directly
// Writes discovered.json (companies) and jobs-agg.json (jobs from aggregator APIs). Usage: node find-companies.mjs
import { readFileSync, writeFileSync } from 'node:fs';
import { ATS } from './ats.mjs';
import { classify, countryOf } from './lib.mjs';
import { fetchWikidata } from './wikidata.mjs';

const UA = { 'user-agent': 'devbible-jobmap/1.0' };
const j = async (u) => { try { const r = await fetch(u, { headers: UA, signal: AbortSignal.timeout(40000) }); return r.ok ? await r.json() : null; } catch { return null; } };
const strip = (h = '') => String(h).replace(/<[^>]+>/g, ' ');
const pool = async (items, n, fn) => { const q = [...items]; await Promise.all(Array.from({ length: n }, async () => { for (let x; (x = q.shift()); ) await fn(x); })); };
const known = new Set(JSON.parse(readFileSync(new URL('./companies.json', import.meta.url), 'utf8')).map((c) => c.name.toLowerCase()));
const PROBE = ['greenhouse', 'lever', 'ashby', 'workable', 'smartrecruiters'];

// ---- 1. Y Combinator companies that are hiring ----
const yc = (await j('https://yc-oss.github.io/api/companies/hiring.json')) ?? [];
console.error(`YC hiring: ${yc.length}`);
const discovered = [], unresolved = [];
const seenNames = new Set(known);
async function probe(name, extra, meta) {
  const base = name.toLowerCase().replace(/[^a-z0-9]/g, '');
  const cands = [...new Set([...extra, base, name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')].filter((x) => x && x.length > 1))];
  for (const slug of cands) for (const ats of PROBE) {
    try {
      const jobs = await ATS[ats].list(slug);
      if (jobs && jobs.length) { discovered.push({ name, tier: 0, ats, slug, ...meta }); return true; }
    } catch {}
  }
  unresolved.push({ name, tier: 0, ...meta });
  return false;
}
await pool(yc, 14, async (c) => {
  if (seenNames.has(c.name.toLowerCase())) return;
  seenNames.add(c.name.toLowerCase());
  const host = (() => { try { return new URL(c.website).hostname.replace(/^www\./, '').split('.')[0]; } catch { return ''; } })();
  await probe(c.name, [host, c.slug], { category: 'startup', hq: countryOf(c.all_locations).toLowerCase().replace(/remote|other/, 'us'), src: 'yc', website: c.website, size: Number(c.team_size) || null, blurb: c.one_liner });
});
console.error(`YC companies with a readable board: ${discovered.length}`);

// ---- 1b. Wikipedia unicorn list: company + country, so India / Germany / Canada / Europe are covered by name ----
const wiki = await j('https://en.wikipedia.org/w/api.php?action=parse&page=List_of_unicorn_startup_companies&prop=wikitext&format=json&formatversion=2');
const wt = wiki?.parse?.wikitext ?? '';
const CC = { india: 'in', germany: 'de', canada: 'ca', 'united states': 'us', usa: 'us' };
const EUROPE = /united kingdom|^uk$|france|netherlands|sweden|switzerland|ireland|spain|poland|denmark|finland|norway|estonia|lithuania|austria|belgium|italy|portugal|czech|luxembourg|latvia|romania/i;
const wikiRows = [];
for (const row of wt.slice(wt.indexOf('!Company')).split('\n|-')) {
  const cells = row.split('\n|').map((x) => x.trim());
  const name = cells[1]?.match(/\[\[(?:[^\]|]*\|)?([^\]]+)\]\]/)?.[1] ?? cells[1]?.replace(/[\[\]']/g, '');
  const country = (row.match(/\{\{flag\|([^}|]+)/i) ?? [])[1]?.toLowerCase();
  if (!name || !country || name.length > 40) continue;
  const hq = CC[country] ?? (EUROPE.test(country) ? 'eu' : null);
  if (hq) wikiRows.push({ name, hq });
}
console.error(`Wikipedia unicorns in IN/US/CA/DE/EU: ${wikiRows.length}`);
const before = discovered.length;
await pool(wikiRows, 14, async (w) => {
  if (seenNames.has(w.name.toLowerCase())) return;
  seenNames.add(w.name.toLowerCase());
  await probe(w.name, [], { category: 'unicorn', hq: w.hq, src: 'wikipedia' });
});
console.error(`Wikipedia companies with a readable board: ${discovered.length - before}`);

// ---- 1c. Wikidata: the largest companies of 28 countries, with their own website and industry ----
const wd = await fetchWikidata(250, (m) => console.error('wikidata', m));
console.error(`Wikidata companies: ${wd.length}`);
const beforeWd = discovered.length;
await pool(wd, 14, async (w) => {
  if (seenNames.has(w.name.toLowerCase())) return;
  seenNames.add(w.name.toLowerCase());
  const host = (() => { try { return new URL(w.website).hostname.replace(/^www\./, '').split('.')[0]; } catch { return ''; } })();
  const { name, ...meta } = w;
  await probe(name, [host], meta);
});
console.error(`Wikidata companies with a readable board: ${discovered.length - beforeWd}`);

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

for (let p = 1; p <= 15; p++) {
  const d = await j(`https://www.themuse.com/api/public/jobs?page=${p}`);
  if (!d?.results?.length) break;
  d.results.forEach((x) => agg.push({ company: x.company?.name, title: x.name, location: (x.locations ?? []).map((l) => l.name).join('; ') || 'Remote', url: x.refs?.landing_page, desc: strip(x.contents), src: 'themuse' }));
}
const jb = await j('https://jobicy.com/api/v2/remote-jobs?count=100');
(jb?.jobs ?? []).forEach((x) => agg.push({ company: x.companyName, title: x.jobTitle, location: x.jobGeo || 'Remote', url: x.url, desc: strip(x.jobDescription), src: 'jobicy' }));
const wn = await j('https://www.workingnomads.com/api/exposed_jobs/');
(Array.isArray(wn) ? wn : []).forEach((x) => agg.push({ company: x.company_name, title: x.title, location: x.location || 'Remote', url: x.url, desc: strip(x.description), src: 'workingnomads' }));
console.error(`aggregator rows incl. Muse/Jobicy/WorkingNomads: ${agg.length}`);
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
writeFileSync(new URL('./unresolved.json', import.meta.url), JSON.stringify(unresolved, null, 1));
writeFileSync(new URL('./jobs-agg.json', import.meta.url), JSON.stringify(aggJobs));
console.log(`discovered ${discovered.length} board companies + ${aggCos.size} aggregator companies (${aggJobs.length} roles)`);
