#!/usr/bin/env node
// Usage:
//   node jobs.mjs "Razorpay"                      one company
//   node jobs.mjs Razorpay Postman --track java   several
//   node jobs.mjs --preset fintech                every preset company in a category (fintech|saas|unicorn|bigtech|gcc|services) or tier (t1|t2|t3)
//   node jobs.mjs --preset all --region india
// Flags: --region india|us|canada|europe|any (default india)  --track ui|node|java|fullstack|other-eng
import { chromium } from 'playwright';
import { ATS } from './ats.mjs';
import { classify } from './lib.mjs';
import { resolve, presets } from './resolve.mjs';

const args = process.argv.slice(2);
const flag = (k) => { const i = args.indexOf(`--${k}`); if (i < 0) return null; const v = args[i + 1]; args.splice(i, 2); return v; };
const region = flag('region') ?? 'india', track = flag('track'), preset = flag('preset');
let targets = args.map((n) => ({ name: n }));
if (preset) {
  const all = presets();
  const p = preset.toLowerCase();
  targets = all.filter((c) => p === 'all' || c.category === p || `t${c.tier}` === p).map((c) => ({ name: c.name }));
  if (!targets.length) { console.error(`No preset "${preset}". Use all, t1-t3, or a category.`); process.exit(1); }
}
if (!targets.length) { console.error('Give a company name or --preset <category|tier|all>'); process.exit(1); }

let browser;
const getBrowser = async () => (browser ??= await chromium.launch({ executablePath: process.env.CHROME || undefined }));
const rank = { java: 0, node: 1, ui: 2, fullstack: 3, 'other-eng': 4 };

for (const t of targets) {
  process.stderr.write(`… ${t.name}\n`);
  const r = await resolve(t.name, { browser: await getBrowser().catch(() => null) });
  console.log(`\n## ${t.name}  ${r.ats ? `(${r.ats}, via ${r.via})` : '(no job system found)'}`);
  if (!r.ats) {
    if (r.dom?.length) {
      console.log(`Careers page: ${r.careersUrl}\nLinks that look like engineering roles (not region-filtered):`);
      r.dom.slice(0, 15).forEach((d) => console.log(`- ${d.title} — ${d.url}`));
    } else console.log(r.careersUrl ? `Careers page: ${r.careersUrl} (no job list readable — open it manually)` : 'Could not find a careers page. Try the exact company domain.');
    continue;
  }
  let raw;
  try { raw = (await ATS[r.ats].list(r.slug)) ?? []; } catch (e) { console.log(`error: ${e.message}`); continue; }
  const jobs = raw.map((j) => classify(j, region)).filter(Boolean).filter((j) => !track || j.track === track).sort((a, b) => rank[a.track] - rank[b.track]);
  console.log(`${raw.length} open total · ${jobs.length} engineering roles in ${region}${track ? ` (${track})` : ''}`);
  for (const j of jobs) console.log(`- [${j.track}] ${j.title} · ${j.level} · ${j.location} — ${j.url}`);
}
await browser?.close();
