// db.json + template.html -> page.html (the browsable page) + data.json (fetched by the page). Usage: node make-page.mjs
import { readFileSync, writeFileSync } from 'node:fs';
import { position } from './lib.mjs';
const db = JSON.parse(readFileSync(new URL('./db.json', import.meta.url), 'utf8'));
const idx = new Map(db.companies.map((c, i) => [c.name, i]));
const data = { d: db.crawled, c: db.companies.map((c) => [c.name, c.category, c.tier, c.hq, c.ats ?? '', c.open ?? 0, c.src ?? 'curated', c.careers ?? '']),
  j: db.jobs.map((j) => [idx.get(j.company), j.fn, j.track, j.level, j.country, j.title, j.location, j.url, j.fn === 'engineering' ? position(j) : '', j.careers ? 1 : 0]) };
writeFileSync(new URL('./data.json', import.meta.url), JSON.stringify(data));
writeFileSync(new URL('./page.html', import.meta.url), readFileSync(new URL('./template.html', import.meta.url), 'utf8'));
