#!/usr/bin/env node
/**
 * The validation pipeline — "which pages have actually been checked, and what is next?"
 *
 *   yarn validate                     # recompute from disk → static/validation.json + summary
 *   yarn validate --queue             # the next units to work, risk-ordered
 *   yarn validate --unit <dir>        # the brief for ONE unit + its ledger row template
 *   yarn validate --check             # CI: exit 1 on a malformed stamp
 *   yarn validate --drift             # progress.js `verified:` numbers vs what is on disk
 *   yarn validate --guard <gitref>    # did a validation pass quietly REWRITE instead of check?
 *
 * 🔴 The one rule this file encodes: **state is derived from the pages, never stored
 * beside them.** Two validation plans have been written for this corpus (V1–V7,
 * 2026-08-16; F0–F3, 2026-08-31) and between them they produced 0 validated pages
 * outside Next.js — because a plan in prose has no cursor, and a session that dies
 * takes its progress with it. Here the progress bar IS `grep -c '^> Validated:'`
 * over docs/. Nothing to keep in sync, nothing to lose, and any cold session can
 * ask `--queue` what to do next and get the same answer.
 *
 * 🔴 Two marks, two meanings — do not collapse them:
 *   `> Verified:`  the page was SOURCED when it was written (author's citation).
 *   `> Validated:` the page's claims were RE-CHECKED later (validator's stamp).
 * A page can carry the first and still have never been checked by anyone else. The
 * 164 imported toolchain pages carry NEITHER, which is why they lead the queue.
 *
 * Ledger path is `$DEVBIBLE_MEMORY` (default below) — findings are banked in the
 * memory store per unit, never in this repo and never at the end of a campaign.
 */

import fs from 'node:fs';
import path from 'node:path';
import {execSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const DOCS = path.join(ROOT, 'docs');
const OUT = path.join(ROOT, 'static/validation.json');
const MEMORY = process.env.DEVBIBLE_MEMORY || '/mnt/Storage/my-learning/claude/devbible';
const LEDGER = path.join(MEMORY, 'VALIDATION-LEDGER.md');

const LINE_CAP = 300;
const STALE_DAYS = 180;           // a `> Verified:` older than this is worth re-checking
const TODAY = new Date().toISOString().slice(0, 10);

// Tracks that are review artifacts or scaffolding, not reader-facing pages.
const NOT_CONTENT = new Set(['reviews']);

const argv = process.argv.slice(2);
const flag = (name) => argv.includes(name);
const val = (name, dflt) => {
  const i = argv.indexOf(name);
  return i >= 0 && argv[i + 1] && !argv[i + 1].startsWith('--') ? argv[i + 1] : dflt;
};

// ── marks ───────────────────────────────────────────────────────────────────
// Anchored at line start, exactly as house-style.md specifies them, so a mention
// of "> Verified:" inside a code fence or prose cannot fake a mark.
const RE = {
  badge:     /^<span className="db-tier/m,
  verified:  /^> Verified:/m,
  validated: /^> Validated:/m,
  interview: /^## Interview questions\s*$/m,
  gotchas:   /^## Gotchas\s*$/m,
  console:   /^```console/gm,
  proven:    /sandbox-proven/,
  // first date on the mark's line — `> Verified: 2026-09-04 for **Next.js …`
  dateOn:    (mark) => new RegExp(`^> ${mark}:[^\\n]*?(\\d{4}-\\d{2}-\\d{2})`, 'm'),
};

const daysSince = (iso) => (Date.now() - Date.parse(iso)) / 86_400_000;

/**
 * Score one file's risk. Higher = more likely to be teaching something wrong.
 *
 * Deliberately derived from marks alone, with no per-track special cases: the raw
 * imports rise to the top because they lack every mark, not because a list here
 * names them. A hardcoded list goes stale the moment a track is converted.
 */
function scoreFile(f) {
  let score = 0;
  const why = [];
  if (f.validated) return {score: 0, why: ['validated']};

  if (!f.verified)       { score += 40; why.push('never sourced'); }
  else if (f.verifiedAge !== null && f.verifiedAge > STALE_DAYS) {
    score += 15; why.push(`sourced ${Math.round(f.verifiedAge)}d ago`);
  }
  if (!f.badge)          { score += 25; why.push('no tier badge'); }
  if (f.consoleBlocks && !f.proven) {
    // 🔴 A flag, not a verdict. Per FILE and low-weighted on purpose: the 636-file
    // risk set is exactly reproduced by this test, but a spot check shows pages
    // whose `> Verified:` line names the container and port they were run in and
    // simply predate the `sandbox-proven` marker. Scoring this like a defect
    // buried the raw imports — which have PROVEN errors — 13 places down.
    score += 12;
    why.push(`${f.consoleBlocks} console block(s), no provenance marker`);
  }
  if (!f.readme && !f.interview) { score += 10; why.push('no Interview questions'); }
  if (!f.readme && !f.gotchas)   { score += 10; why.push('no Gotchas'); }
  if (f.lines > LINE_CAP)        { score += 8;  why.push(`${f.lines} lines, over cap`); }
  return {score, why};
}

// ── walk ────────────────────────────────────────────────────────────────────
function walk(dir, acc = []) {
  for (const e of fs.readdirSync(dir, {withFileTypes: true})) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) walk(p, acc);
    else if (e.name.endsWith('.md')) acc.push(p);
  }
  return acc;
}

function readFileState(abs) {
  const src = fs.readFileSync(abs, 'utf8');
  const rel = path.relative(ROOT, abs);
  const vDate = src.match(RE.dateOn('Verified'))?.[1] ?? null;
  const f = {
    path: rel,
    readme: path.basename(abs) === 'README.md',
    lines: src.split('\n').length,
    badge: RE.badge.test(src),
    verified: RE.verified.test(src),
    validated: RE.validated.test(src),
    verifiedDate: vDate,
    verifiedAge: vDate ? daysSince(vDate) : null,
    validatedDate: src.match(RE.dateOn('Validated'))?.[1] ?? null,
    interview: RE.interview.test(src),
    gotchas: RE.gotchas.test(src),
    consoleBlocks: (src.match(RE.console) || []).length,
    proven: RE.proven.test(src),
  };
  Object.assign(f, scoreFile(f));
  return f;
}

/**
 * Collect into UNITS. A unit is the deepest directory holding pages — which is
 * one topic for a chunked native track and one chapter for a flat imported one.
 * That matches devbible-topic's "the unit of work is one topic, always": small
 * enough to finish and bank inside one session, which is the whole point.
 */
function collect() {
  const tracks = new Map();
  for (const track of fs.readdirSync(DOCS).sort()) {
    const tdir = path.join(DOCS, track);
    if (!fs.statSync(tdir).isDirectory() || NOT_CONTENT.has(track)) continue;
    const files = walk(tdir)
      .filter((p) => !/\/(syllabus|reviews)\//.test(p))   // boards and historical records take no stamp
      .map(readFileState);
    if (!files.length) continue;

    const units = new Map();
    for (const f of files) {
      const dir = path.dirname(f.path);
      if (!units.has(dir)) units.set(dir, {unit: dir, track, files: []});
      units.get(dir).files.push(f);
    }
    for (const u of units.values()) {
      u.pages = u.files.filter((f) => !f.readme).length;
      u.validated = u.files.filter((f) => f.validated).length;
      u.verified = u.files.filter((f) => f.verified).length;
      u.converted = u.files.filter((f) => f.verified && f.badge).length;
      u.score = u.files.reduce((n, f) => n + f.score, 0);
      // 🔴 Order on DENSITY, not on the sum. Summed risk is really a size
      // measure: a 71-file Java topic outranked every raw-import chapter purely
      // by being large, which inverts the project's own ranking principle.
      u.density = Math.round(u.score / u.files.length);
      u.done = u.files.every((f) => f.validated);
      // Aggregate the reasons across the unit as COUNTS. A set-union says
      // "never sourced" when one file of seventy is, and repeats the console
      // line once per distinct block count.
      const tally = {
        'never sourced': u.files.filter((f) => !f.verified).length,
        'no tier badge': u.files.filter((f) => !f.badge).length,
        'console blocks, no provenance': u.files.filter((f) => f.consoleBlocks && !f.proven).length,
        'no Interview questions': u.files.filter((f) => !f.readme && !f.interview).length,
        'no Gotchas': u.files.filter((f) => !f.readme && !f.gotchas).length,
        'over the 300-line cap': u.files.filter((f) => f.lines > LINE_CAP).length,
        'sourced over 180d ago': u.files.filter((f) => f.verified && f.verifiedAge > STALE_DAYS).length,
      };
      u.why = Object.entries(tally).filter(([, n]) => n > 0)
        .sort((a, b) => b[1] - a[1])
        .map(([k, n]) => `${n}/${u.files.length} ${k}`);
    }

    const all = [...units.values()].filter((u) => u.files.length);
    tracks.set(track, {
      track,
      files: files.length,
      pages: files.filter((f) => !f.readme).length,
      verified: files.filter((f) => f.verified).length,
      converted: files.filter((f) => f.verified && f.badge).length,
      validated: files.filter((f) => f.validated).length,
      consoleBlocks: files.reduce((n, f) => n + (f.proven ? 0 : f.consoleBlocks), 0),
      overCap: files.filter((f) => f.lines > LINE_CAP).length,
      noInterview: files.filter((f) => !f.readme && !f.interview).length,
      score: files.reduce((n, f) => n + f.score, 0),
      // an imported track is one nothing has ever sourced — derived, not declared
      imported: files.every((f) => !f.verified),
      units: all,
    });
  }
  return tracks;
}

// ── reports ─────────────────────────────────────────────────────────────────
const pct = (n, d) => (d ? `${Math.round((n / d) * 100)}%` : '—');
const pad = (s, n) => String(s).padEnd(n);
const lpad = (s, n) => String(s).padStart(n);

function summary(tracks) {
  const rows = [...tracks.values()]
    .map((t) => ({...t, density: Math.round(t.score / t.files)}))
    .sort((a, b) => b.density - a.density);
  console.log(`\n  devbible validation state — ${TODAY}\n`);
  console.log(`  ${pad('track', 24)}${lpad('pages', 6)}${lpad('sourced', 9)}${lpad('validated', 11)}${lpad('risk/pg', 9)}  notes`);
  console.log(`  ${'─'.repeat(78)}`);
  let P = 0, V = 0, S = 0;
  for (const t of rows) {
    P += t.pages; V += t.validated; S += t.score;
    const notes = [];
    if (t.imported) notes.push('RAW IMPORT');
    if (t.consoleBlocks) notes.push(`${t.consoleBlocks} console`);
    if (t.noInterview) notes.push(`${t.noInterview} no-interview`);
    if (t.overCap) notes.push(`${t.overCap} over-cap`);
    console.log(`  ${pad(t.track, 24)}${lpad(t.pages, 6)}${lpad(pct(t.verified, t.files), 9)}${lpad(`${t.validated}/${t.files}`, 11)}${lpad(t.density, 9)}  ${notes.join(' · ')}`);
  }
  console.log(`  ${'─'.repeat(78)}`);
  console.log(`  ${pad('TOTAL', 24)}${lpad(P, 6)}${lpad('', 9)}${lpad(`${V} validated`, 11)}${lpad('', 9)}\n`);
  console.log(`  Next: yarn validate --queue        (what to work on)`);
  console.log(`        yarn validate --unit <dir>   (the brief for one unit)\n`);
}

function queue(tracks) {
  const limit = Number(val('--limit', 12));
  const only = val('--track', null);
  const scope = val('--scope', 'all');            // imported | native | all
  const by = val('--by', 'density');              // density (default) | score
  let units = [...tracks.values()]
    .filter((t) => (only ? t.track === only : true))
    .filter((t) => (scope === 'imported' ? t.imported : scope === 'native' ? !t.imported : true))
    .flatMap((t) => t.units)
    .filter((u) => !u.done)
    .sort((a, b) => b[by] - a[by] || a.files.length - b.files.length || a.unit.localeCompare(b.unit));

  const total = units.length;
  units = units.slice(0, limit);
  console.log(`\n  ${total} units pending${only ? ` in ${only}` : ''}${scope !== 'all' ? ` (${scope})` : ''} — showing ${units.length}, by risk ${by}\n`);
  for (const [i, u] of units.entries()) {
    console.log(`  ${lpad(i + 1, 3)}. ${u.unit}`);
    console.log(`       ${u.pages} pages · risk ${u.density}/file (${u.score} total) · ${u.validated}/${u.files.length} stamped`);
    for (const w of u.why.slice(0, 4)) console.log(`       ${w}`);
  }
  console.log(`\n  Take the top one:  yarn validate --unit ${units[0]?.unit ?? '<dir>'}\n`);
}

function unit(tracks, dir) {
  const norm = dir.replace(/\/$/, '');
  const u = [...tracks.values()].flatMap((t) => t.units).find((x) => x.unit === norm);
  if (!u) return console.error(`  no unit at "${norm}" — run --queue for valid paths\n`), process.exit(2);

  console.log(`\n  UNIT  ${u.unit}`);
  console.log(`  ${u.pages} pages · risk ${u.score} · ${u.validated}/${u.files.length} already stamped\n`);
  console.log(`  ${pad('file', 52)}${lpad('lines', 6)}  marks   what is missing`);
  console.log(`  ${'─'.repeat(96)}`);
  for (const f of u.files.sort((a, b) => b.score - a.score)) {
    const marks = `${f.badge ? 'B' : '·'}${f.verified ? 'V' : '·'}${f.validated ? '✓' : '·'}`;
    console.log(`  ${pad(path.basename(f.path), 52)}${lpad(f.lines, 6)}  ${marks}     ${f.why.join(' · ')}`);
  }
  console.log(`\n  marks: B tier badge · V "> Verified:" (sourced when written) · ✓ "> Validated:" (re-checked)\n`);
  console.log(`  How to run this unit — .agents/references/validation-pipeline.md`);
  console.log(`  Severity ladder + evidence ladder — .agents/references/verification.md`);
  console.log(`  🔴 S5 (wording, ordering, style) is LEDGER-ONLY. A pass that rewrites prose is not a validation pass.\n`);
  console.log(`  Stamp each file under its existing "> Verified:" line, leaving that line intact:\n`);
  console.log(`      > Validated: ${TODAY} · claims + output provenance · session <id>\n`);
  console.log(`  Then bank the row in ${LEDGER} BEFORE starting the next unit:\n`);
  console.log(`  | ${u.unit} | ${TODAY} | ${u.pages} | S1:_ S2:_ S3:_ S4:_ S5:_ | <one line: what was wrong> | <session> |\n`);
}

function check(tracks) {
  const bad = [];
  for (const t of tracks.values()) {
    for (const u of t.units) {
      for (const f of u.files) {
        if (!f.validated) continue;
        // A stamp is only worth counting if it is dated and sits on a sourced page.
        if (!f.validatedDate) bad.push(`${f.path}: "> Validated:" with no YYYY-MM-DD date`);
        if (!f.verified) bad.push(`${f.path}: stamped "> Validated:" but has no "> Verified:" line`);
      }
    }
  }
  if (bad.length) {
    console.error(`\n  ✗ ${bad.length} malformed stamp(s):\n`);
    for (const b of bad) console.error(`    ${b}`);
    console.error('');
    process.exit(1);
  }
  const v = [...tracks.values()].reduce((n, t) => n + t.validated, 0);
  console.log(`\n  ✓ every one of the ${v} "> Validated:" stamps is well-formed\n`);
}

/**
 * `progress.js` carries a hand-maintained `verified: N` per imported chapter and
 * every one of them is currently 0. Nothing recomputes it, so the homepage will
 * keep reading 0% after a track is validated. This says by how much it lies.
 */
function drift(tracks) {
  // 🔴 Read the numbers, do not import the module. progress.js imports
  // ./page-counts.json, which Node will not load without an import attribute, and
  // every workaround (temp copy in /tmp, sibling scratch file) either breaks the
  // relative import or writes into a checkout several sessions share. The
  // `verified:` values are one regex away and this needs nothing else from it.
  const src = fs.readFileSync(path.join(ROOT, 'src/data/progress.js'), 'utf8');
  const rows = [];
  let track = null;
  for (const line of src.split('\n')) {
    const lang = line.match(/^ {2}'?([a-z0-9-]+)'?: \{\s*$/);
    if (lang) { track = lang[1]; continue; }
    const ph = line.match(/slug: '([^']+)'/);
    const ver = line.match(/verified: (\d+)/);
    if (!track || !ph || !ver) continue;
    const t = tracks.get(track);
    if (!t) continue;
    const u = t.units.find((x) => x.unit.endsWith(`/${ph[1]}`));
    const onDisk = u ? u.converted : 0;
    if (onDisk !== Number(ver[1])) rows.push([`${track}/${ph[1]}`, Number(ver[1]), onDisk]);
  }
  if (!rows.length) return console.log(`\n  ✓ progress.js "verified:" matches disk everywhere\n`);
  console.log(`\n  ${rows.length} chapter(s) where progress.js disagrees with disk:\n`);
  console.log(`  ${pad('chapter', 50)}${lpad('progress.js', 12)}${lpad('on disk', 9)}`);
  for (const [c, said, real] of rows) console.log(`  ${pad(c, 50)}${lpad(said, 12)}${lpad(real, 9)}`);
  console.log(`\n  🔴 Edit progress.js only if you own that track's lane — several sessions collide there.\n`);
}

/**
 * The anti-rewrite guard. The documented biggest failure mode of every validation
 * pass attempted here is that it stops checking and starts rewriting for depth —
 * "it already happened to this exact corpus once". That is invisible to the cap
 * check, the MDX check and the link check, and it is detectable by diff shape:
 * a file that gained a stamp should have changed by a handful of lines, not fifty,
 * and should almost never have got SHORTER (that is a trim, not a fix).
 */
function guard(ref) {
  let out;
  try {
    out = execSync(`git diff --numstat ${ref}..HEAD -- docs/`, {cwd: ROOT, encoding: 'utf8'});
  } catch {
    return console.error(`\n  cannot diff "${ref}" — pass a reachable git ref\n`), process.exit(2);
  }
  const churn = Number(val('--churn', 40));
  const rows = [];
  for (const line of out.trim().split('\n').filter(Boolean)) {
    const [add, del, file] = line.split('\t');
    if (add === '-') continue;                              // binary
    const abs = path.join(ROOT, file);
    if (!fs.existsSync(abs)) continue;
    if (!RE.validated.test(fs.readFileSync(abs, 'utf8'))) continue;   // not a validation pass
    const [a, d] = [Number(add), Number(del)];
    const shrank = d > a;
    if (a + d > churn || shrank) rows.push({file, a, d, shrank});
  }
  if (!rows.length) return console.log(`\n  ✓ no stamped file since ${ref} shows rewrite-shaped churn\n`);
  console.log(`\n  ${rows.length} stamped file(s) to eyeball — validation should be small, additive edits:\n`);
  for (const r of rows) {
    console.log(`  ${r.shrank ? '🔴 SHRANK' : '⚠ churn  '}  +${r.a}/-${r.d}  ${r.file}`);
  }
  console.log(`\n  🔴 A file that got SHORTER under a validation pass is a trim, not a fix — check it against`);
  console.log(`     the 300-line rule: content is split on a concept boundary, never cut to fit.\n`);
}

// ── main ────────────────────────────────────────────────────────────────────
const tracks = collect();

if (flag('--queue')) queue(tracks);
else if (flag('--unit')) unit(tracks, val('--unit', ''));
else if (flag('--check')) check(tracks);
else if (flag('--drift')) drift(tracks);
else if (flag('--guard')) guard(val('--guard', 'HEAD~1'));
else {
  const json = {
    generated: TODAY,
    lineCap: LINE_CAP,
    totals: {
      files: [...tracks.values()].reduce((n, t) => n + t.files, 0),
      pages: [...tracks.values()].reduce((n, t) => n + t.pages, 0),
      verified: [...tracks.values()].reduce((n, t) => n + t.verified, 0),
      validated: [...tracks.values()].reduce((n, t) => n + t.validated, 0),
      pendingUnits: [...tracks.values()].flatMap((t) => t.units).filter((u) => !u.done).length,
    },
    tracks: Object.fromEntries([...tracks].map(([k, t]) => [k, {
      pages: t.pages, files: t.files, verified: t.verified, converted: t.converted,
      validated: t.validated, imported: t.imported, score: t.score,
      consoleBlocks: t.consoleBlocks, overCap: t.overCap, noInterview: t.noInterview,
      units: t.units.map((u) => ({
        unit: u.unit, pages: u.pages, validated: u.validated, score: u.score, why: u.why,
      })),
    }])),
  };
  fs.writeFileSync(OUT, JSON.stringify(json, null, 2) + '\n');
  summary(tracks);
  console.log(`  wrote ${path.relative(ROOT, OUT)}\n`);
}
