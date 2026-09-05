#!/usr/bin/env node
/**
 * Regenerates `static/status.json` — the one status file the dashboard fetches
 * (Docusaurus serves `static/` at the site root, so it lands on
 * `/devbible/status.json`).
 *
 *   yarn status            # rewrite it
 *   yarn status --check    # exit 1 if it is stale
 *
 * Counts are derived from `src/data/progress.js`, which stays the single
 * hand-maintained source of truth — so the two can never disagree.
 *
 * Two fields are hand-written and PRESERVED across a regeneration:
 * `note`, and a `status` of `parked` or `blocked` (a human decision the counts
 * cannot infer). Edit those in the JSON; everything else is overwritten.
 */

import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {fileURLToPath, pathToFileURL} from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const OUT = path.join(ROOT, 'static/status.json');
const HELD = new Set(['parked', 'blocked']);

// progress.js is ESM inside a CommonJS-default package, so Node cannot
// import() it by path. Copy it to a temp .mjs — no transform, no dependency.
const tmp = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'devbible-')), 'progress.mjs');
fs.copyFileSync(path.join(ROOT, 'src/data/progress.js'), tmp);
const {LANGUAGES, summarise} = await import(pathToFileURL(tmp).href);

// Whatever the last file said, keyed by language: `{status, note}`.
const previous = Object.fromEntries(
  (fs.existsSync(OUT) ? JSON.parse(fs.readFileSync(OUT, 'utf8')).languages : []).map((l) => [l.key, l]),
);

/**
 * An imported track counts validated pages, not written ones, so `not-started`
 * would be a lie about it — the pages are all there, unchecked. It gets its own
 * three words instead, and `topics`/`completed` are pages rather than syllabus
 * rows. See the `imported` note at the top of `src/data/progress.js`.
 */
function statusOf(s, pending) {
  if (s.imported) {
    return pending === 0 ? 'validated' : s.topicsDone === 0 ? 'imported' : 'validating';
  }
  return pending === 0 ? 'complete' : s.topicsDone === 0 ? 'not-started' : 'in-progress';
}

const languages = Object.keys(LANGUAGES).map((key) => {
  const s = summarise(key);
  const prev = previous[key] ?? {};
  const pending = s.topicsTotal - s.topicsDone;
  const phase = s.inFlight ?? s.nextPhase;
  return {
    key,
    label: s.label,
    status: HELD.has(prev.status) ? prev.status : statusOf(s, pending),
    percent: s.percent,
    counts: s.imported ? 'pages validated' : 'syllabus topics explained',
    topics: s.topicsTotal,
    completed: s.topicsDone,
    pending,
    imported: !!s.imported,
    phases: `${s.phasesDone}/${s.phasesTotal}`,
    next: phase ? `${phase.n} · ${phase.name}` : null,
    docs: s.docsPath,
    updated: s.updated ?? null,
    note: prev.note ?? null,
  };
});

const count = (status) => languages.filter((l) => l.status === status).length;
// The two families count different units — syllabus topics explained on one
// side, imported pages validated on the other — so they are summed apart. Added
// together they would report a single meaningless number, which is the mistake
// the homepage roll-up strip was removed for.
const written = languages.filter((l) => !l.imported);
const imported = languages.filter((l) => l.imported);
const sum = (rows, field) => rows.reduce((n, l) => n + l[field], 0);

const json =
  JSON.stringify(
    {
      version: 3,
      generatedFrom: 'src/data/progress.js',
      // The freshest per-language stamp, not a wall clock: a build timestamp
      // would churn the diff on every run and make --check useless.
      updated: languages.reduce((newest, l) => (l.updated > newest ? l.updated : newest), ''),
      totals: {
        languages: languages.length,
        complete: count('complete'),
        inProgress: count('in-progress'),
        notStarted: count('not-started'),
        parked: count('parked'),
        blocked: count('blocked'),
        topics: sum(written, 'topics'),
        completed: sum(written, 'completed'),
        pending: sum(written, 'pending'),
        percent: Math.round((sum(written, 'completed') / sum(written, 'topics')) * 100),
      },
      importedTotals: {
        tracks: imported.length,
        untouched: count('imported'),
        validating: count('validating'),
        validated: count('validated'),
        pages: sum(imported, 'topics'),
        pagesValidated: sum(imported, 'completed'),
        percent: Math.round((sum(imported, 'completed') / sum(imported, 'topics')) * 100),
      },
      languages,
    },
    null,
    2,
  ) + '\n';

if (process.argv.includes('--check')) {
  if (json !== (fs.existsSync(OUT) ? fs.readFileSync(OUT, 'utf8') : '')) {
    console.error('status.json is stale — run `yarn status` and commit static/status.json');
    process.exit(1);
  }
  console.log('status.json is up to date');
} else {
  fs.writeFileSync(OUT, json);
  console.log(`wrote ${path.relative(ROOT, OUT)}`);
}
