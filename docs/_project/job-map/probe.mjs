// Finds which public ATS board (if any) each company in companies.json uses.
// Usage: node probe.mjs   -> rewrites companies.json adding {ats, slug}
import { readFileSync, writeFileSync } from 'node:fs';
import { ATS } from './ats.mjs';

const file = new URL('./companies.json', import.meta.url);
const companies = JSON.parse(readFileSync(file, 'utf8'));
const slugs = (n) => {
  const base = n.toLowerCase().replace(/[^a-z0-9 ]/g, '');
  return [...new Set([base.replace(/ /g, ''), base.replace(/ /g, '-'), base.split(' ')[0]])];
};
for (const c of companies) {
  if (c.ats) continue;
  outer: for (const slug of c.slugs ?? slugs(c.name)) {
    for (const [ats, impl] of Object.entries(ATS)) {
      try {
        const jobs = await impl.list(slug);
        if (jobs) { c.ats = ats; c.slug = slug; c.probeCount = jobs.length; break outer; }
      } catch {}
    }
  }
  console.log(c.name.padEnd(16), c.ats ? `${c.ats}/${c.slug} (${c.probeCount})` : '-');
}
writeFileSync(file, JSON.stringify(companies, null, 1) + '\n');
