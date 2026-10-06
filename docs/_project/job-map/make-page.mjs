// db.json + template.html -> page.html, data-meta.json (companies + counts) and one jobs-<COUNTRY>.json per country the page loads on demand.
import { readFileSync, writeFileSync, readdirSync, unlinkSync } from 'node:fs';
import { position } from './lib.mjs';
const db = JSON.parse(readFileSync(new URL('./db.json', import.meta.url), 'utf8'));
const idx = new Map(db.companies.map((c, i) => [c.name, i]));
for (const f of readdirSync(new URL('./', import.meta.url))) if (/^jobs-[A-Z]+\.json$/.test(f)) unlinkSync(new URL(`./${f}`, import.meta.url));
const shards = {};
for (const j of db.jobs) (shards[j.country] ??= []).push([idx.get(j.company), j.fn, j.track, j.level, j.title, j.location, j.url, j.fn === 'engineering' ? position(j) : '', j.careers ? 1 : 0]);
for (const [cc, rows] of Object.entries(shards)) writeFileSync(new URL(`./jobs-${cc}.json`, import.meta.url), JSON.stringify(rows));
const n = Object.fromEntries(Object.entries(shards).map(([k, v]) => [k, v.length]));
writeFileSync(new URL('./data-meta.json', import.meta.url), JSON.stringify({ d: db.crawled, n, c: db.companies.map((c) => [c.name, c.category, c.tier, c.hq, c.ats ?? '', c.open ?? 0, c.src ?? 'curated', c.careers ?? '']) }));
writeFileSync(new URL('./page.html', import.meta.url), readFileSync(new URL('./template.html', import.meta.url), 'utf8'));
console.log(Object.entries(n).sort((a, b) => b[1] - a[1]).slice(0, 12).map(([k, v]) => `${k}:${v}`).join(' '));
