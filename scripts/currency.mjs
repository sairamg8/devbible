#!/usr/bin/env node
/**
 * Regenerates `static/currency.json` — "is what the bible says still current?"
 *
 *   yarn currency            # rewrite it
 *   yarn currency --check    # exit 1 if anything needs a human (CI)
 *   yarn currency --scan     # also walk docs/ and report affected pages
 *   yarn currency --offline  # skip the network, scan only
 *
 * Pins come from `src/data/pins.js`, the single hand-maintained source of truth,
 * exactly as `status.mjs` reads `progress.js`. Sources are npm, endoflife.date
 * and GitHub tags — no auth, no keys.
 *
 * 🔴 The one rule this file encodes: a PATCH drift is not work. It lands in the
 * JSON and is reported, but `--check` stays green. A checker that demands
 * attention on every patch is muted within a month, and then the major that
 * mattered is skimmed past. `--check` fails only on minor+, on an unreachable
 * source, and on a dated LTS/EOL event inside the horizon.
 */

import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {fileURLToPath, pathToFileURL} from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const OUT = path.join(ROOT, 'static/currency.json');
const DOCS = path.join(ROOT, 'docs');
const HORIZON_DAYS = 60;          // how far ahead a dated LTS/EOL event is "news"
const TIMEOUT_MS = 20_000;
const CONCURRENCY = 6;            // 42 at once times out — see pool()

const argv = new Set(process.argv.slice(2));
const OFFLINE = argv.has('--offline');
const SCAN = argv.has('--scan') || argv.has('--check');
const CHECK = argv.has('--check');

// pins.js is ESM inside a package with no "type", so Node cannot import() it by
// path without a warning. Same temp-copy trick status.mjs uses. No transform.
const tmp = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'devbible-')), 'pins.mjs');
fs.copyFileSync(path.join(ROOT, 'src/data/pins.js'), tmp);
const {PINS, UNGOVERNED} = await import(pathToFileURL(tmp).href);

const today = new Date().toISOString().slice(0, 10);

// ── version helpers ─────────────────────────────────────────────────────────
const parts = (v) => String(v ?? '').replace(/^v/, '').split(/[.\-+]/).map((n) => parseInt(n, 10) || 0);
const cmp = (a, b) => {
  const [x, y] = [parts(a), parts(b)];
  for (let i = 0; i < Math.max(x.length, y.length); i++) if ((x[i] ?? 0) !== (y[i] ?? 0)) return (x[i] ?? 0) < (y[i] ?? 0) ? -1 : 1;
  return 0;
};
/**
 * How far `pin` is behind `latest`.
 *
 * Two rules, because version schemes are not all semver:
 *  1. Compare only as many components as the PIN declares. A pin of `3.14`
 *     against a latest of `3.14.7` is current — the pin names a line, and the
 *     line has not moved. Without this, every line-level pin is permanently red.
 *  2. Classify by the index that first differs. `patchIndex` says where patches
 *     begin; it is 2 for semver, but PostgreSQL ships patches in the SECOND
 *     component (18.4 → 18.6 is a patch release, not a feature release), so
 *     that pin sets `patchIndex: 1`.
 */
const drift = (pin, latest, patchIndex = 2) => {
  if (!pin || !latest) return 'unknown';
  const [p, l] = [parts(pin), parts(latest)];
  const trimmed = l.slice(0, p.length);
  if (cmp(p.join('.'), trimmed.join('.')) >= 0) return 'none';
  const i = p.findIndex((n, idx) => n !== (trimmed[idx] ?? 0));
  return i === 0 ? 'major' : i >= patchIndex ? 'patch' : 'minor';
};
const daysUntil = (iso) => {
  if (!iso || typeof iso !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(iso)) return null;
  return Math.round((Date.parse(iso) - Date.parse(today)) / 86_400_000);
};

// ── sources ─────────────────────────────────────────────────────────────────
async function getJSON(url, attempt = 0) {
  try {
    const res = await fetch(url, {signal: AbortSignal.timeout(TIMEOUT_MS), headers: {'user-agent': 'devbible-currency'}});
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return await res.json();
  } catch (e) {
    if (attempt >= 1) throw e;
    return getJSON(url, attempt + 1);
  }
}

/**
 * Run `fn` over `items`, at most CONCURRENCY at a time. Firing all 42 pins at
 * once opens 42 connections to a dozen different hosts and reliably produces
 * UND_ERR_CONNECT_TIMEOUT — measured, not theorised.
 */
async function pool(items, fn) {
  const out = new Array(items.length);
  let next = 0;
  await Promise.all(Array.from({length: CONCURRENCY}, async () => {
    while (next < items.length) { const i = next++; out[i] = await fn(items[i], i); }
  }));
  return out;
}

/** Resolve one pin against its declared source. Never throws — returns `error`. */
async function resolve(pin) {
  const [kind, ref] = [pin.source.slice(0, pin.source.indexOf(':')), pin.source.slice(pin.source.indexOf(':') + 1)];
  try {
    if (kind === 'npm') {
      return {latest: (await getJSON(`https://registry.npmjs.org/${ref}/latest`)).version};
    }
    if (kind === 'eol') {
      const cycles = await getJSON(`https://endoflife.date/api/${ref}.json`);
      // Cycles come newest-first. Which one is "the target" is the policy's job.
      const line = pin.cycle ? cycles.find((c) => String(c.cycle) === String(pin.cycle)) : null;
      const events = [];
      for (const c of cycles) {
        // `lts` is a future date when that cycle has not entered LTS yet.
        const d = daysUntil(typeof c.lts === 'string' ? c.lts : null);
        if (d !== null && d >= 0 && d <= HORIZON_DAYS) events.push({kind: 'lts', cycle: c.cycle, date: c.lts, inDays: d});
      }
      const eolDays = daysUntil(typeof (line ?? cycles[0]).eol === 'string' ? (line ?? cycles[0]).eol : null);
      if (eolDays !== null && eolDays >= 0 && eolDays <= HORIZON_DAYS) {
        events.push({kind: 'eol', cycle: (line ?? cycles[0]).cycle, date: (line ?? cycles[0]).eol, inDays: eolDays});
      }
      return {
        latest: (pin.policy === 'lts' || pin.policy === 'major') && line ? line.latest : cycles[0].latest,
        newestOverall: cycles[0].latest,
        newestCycle: String(cycles[0].cycle),
        eol: (line ?? cycles[0]).eol ?? null,
        events,
      };
    }
    if (kind === 'gh') {
      const tags = await getJSON(`https://api.github.com/repos/${ref}/tags?per_page=100`);
      const stable = tags
        .filter((t) => !/(rc|alpha|beta|-m\d|preview|snapshot)/i.test(t.name))
        // Tags are not uniform: `v2.55.0`, `r6.0.3`, `version-3.21.7`,
        // `flyway-12.0.0`. Take the first dotted number in the tag name.
        .map((t) => t.name.match(/(\d+(?:\.\d+)+)/)?.[1])
        .filter(Boolean);
      if (!stable.length) throw new Error('no stable tags');
      return {latest: stable.sort(cmp).at(-1)};
    }
    throw new Error(`unknown source kind "${kind}"`);
  } catch (e) {
    return {error: e.cause?.code ?? e.cause?.message ?? e.message};
  }
}

// ── the pin → page index ────────────────────────────────────────────────────
/**
 * Walk every `> Verified:` line and record which version each page claims for
 * each pin. Two payoffs: the blast radius of a bump, and the inconsistencies
 * that already exist (one product pinned at two versions across the corpus).
 */
function scanPages() {
  const hits = Object.fromEntries(Object.keys(PINS).map((k) => [k, {pages: 0, versions: {}, files: []}]));
  const walk = (dir) => {
    for (const e of fs.readdirSync(dir, {withFileTypes: true})) {
      const p = path.join(dir, e.name);
      if (e.isDirectory()) { walk(p); continue; }
      if (!e.name.endsWith('.md') && !e.name.endsWith('.mdx')) continue;
      const lines = fs.readFileSync(p, 'utf8').split('\n').filter((l) => l.startsWith('> Verified:'));
      if (!lines.length) continue;
      const blob = lines.join(' ').toLowerCase();
      for (const [key, pin] of Object.entries(PINS)) {
        for (const name of pin.names) {
          // `**node 24.19.0**`, `node 24.19.0`, `node@24.19.0`, `node v24`
          const esc = name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
          const bold = [...blob.matchAll(new RegExp(`\\*\\*${esc}[^a-z0-9]{0,4}v?(\\d+(?:\\.\\d+)+)`, 'g'))].map((m) => m[1]);
          const plain = [...blob.matchAll(new RegExp(`${esc}[^a-z0-9]{0,4}v?(\\d+(?:\\.\\d+)+)`, 'g'))].map((m) => m[1]);
          // Bold is the page's own pin; plain text may be a historical citation.
          const found = bold.length ? bold : plain.slice(0, 1);
          if (!found.length) continue;
          hits[key].pages++;
          hits[key].files.push(path.relative(ROOT, p));
          for (const v of found) hits[key].versions[v] = (hits[key].versions[v] ?? 0) + 1;
          break;                                          // one hit per pin per page
        }
      }
    }
  };
  if (fs.existsSync(DOCS)) walk(DOCS);
  return hits;
}

// ── build ───────────────────────────────────────────────────────────────────
const scan = SCAN ? scanPages() : null;

const entries = await pool(Object.entries(PINS), async ([key, pin]) => {
    const up = OFFLINE ? {error: 'offline'} : await resolve(pin);
    const level = pin.policy === 'frozen' ? 'frozen'
      : pin.pin === null ? 'unanchored'
      : up.error ? 'unknown'
      : drift(pin.pin, up.latest, pin.patchIndex);
    const s = scan?.[key];
    // The modal version is what the corpus actually pins; the rest are mostly
    // historical citations inside the same `> Verified:` sentence.
    const ranked = s ? Object.entries(s.versions).sort((a, b) => b[1] - a[1]) : [];
    const modal = ranked[0]?.[0] ?? null;
    const minority = ranked.slice(1).map(([v, n]) => `${v}×${n}`);
    return [key, {
      label: pin.label,
      source: pin.source,
      policy: pin.policy,
      pin: pin.pin,
      latest: up.latest ?? null,
      newestOverall: up.newestOverall ?? null,
      drift: level,
      eol: up.eol ?? null,
      events: up.events ?? [],
      tracks: pin.tracks,
      pages: s?.pages ?? null,
      // What the pages themselves say, vs what pins.js declares. A mismatch is
      // the real defect; the trailing minority is context, not a failure.
      claimed: modal,
      claimedMatchesPin: modal && pin.pin ? cmp(modal, pin.pin) === 0 : null,
      minority: minority.length ? minority : null,
      error: up.error ?? null,
      note: pin.note ?? null,
      checked: pin.checked,
    }];
});

const pins = Object.fromEntries(entries);
const at = (lvl) => entries.filter(([, p]) => p.drift === lvl).length;
const events = entries.flatMap(([k, p]) => p.events.map((e) => ({pin: k, ...e})));
const inconsistent = entries.filter(([, p]) => p.claimedMatchesPin === false).map(([k]) => k);
const unreachable = entries.filter(([, p]) => p.error && p.error !== 'offline').map(([k]) => k);

// Per-language rollup: a track is as stale as its worst pin.
const RANK = {none: 0, frozen: 0, unknown: 1, patch: 1, unanchored: 2, minor: 3, major: 4};
const tracks = {};
for (const [, p] of entries) {
  for (const t of p.tracks) {
    if (!tracks[t] || RANK[p.drift] > RANK[tracks[t]]) tracks[t] = p.drift;
  }
}
for (const t of UNGOVERNED ?? []) tracks[t] ??= 'ungoverned';

const json = JSON.stringify({
  version: 1,
  generatedFrom: 'src/data/pins.js',
  generated: today,
  horizonDays: HORIZON_DAYS,
  totals: {
    pins: entries.length,
    current: at('none'), patch: at('patch'), minor: at('minor'), major: at('major'),
    unanchored: at('unanchored'), unreachable: unreachable.length,
    inconsistent: inconsistent.length, events: events.length,
  },
  events, inconsistent, unreachable, tracks, pins,
}, null, 2) + '\n';

fs.writeFileSync(OUT, json);
console.log(`wrote ${path.relative(ROOT, OUT)}`);

// ── report ──────────────────────────────────────────────────────────────────
const ICON = {none: '✅', patch: '·', minor: '⚠️ ', major: '🔴', unanchored: '❔', unknown: '？', frozen: '🧊'};
for (const [key, p] of entries) {
  if (p.drift === 'none' && p.claimedMatchesPin !== false && !p.events.length) continue;
  const pages = p.pages ? ` ${p.pages}p` : '';
  console.log(`${ICON[p.drift] ?? ' '} ${p.label.padEnd(18)} ${String(p.pin ?? '—').padEnd(10)} → ${String(p.latest ?? p.error).padEnd(10)}${pages}${p.claimedMatchesPin === false ? `  🔴 pages say ${p.claimed}` : ''}${p.minority ? `  (also ${p.minority.slice(0, 3).join(', ')})` : ''}`);
}
for (const e of events) console.log(`📅 ${PINS[e.pin].label} — ${e.kind.toUpperCase()} for cycle ${e.cycle} on ${e.date} (${e.inDays} days)`);
console.log(`\n${at('none')} current · ${at('patch')} patch · ${at('minor')} minor · ${at('major')} major · ${at('unanchored')} unanchored · ${inconsistent.length} inconsistent`);

if (CHECK) {
  const fail = at('minor') + at('major') + events.length + unreachable.length;
  if (fail) { console.error(`\ncurrency --check: ${fail} item(s) need a human. Patch drift is ignored by design.`); process.exit(1); }
  console.log('currency --check: nothing needs a human');
}
