#!/usr/bin/env node
/**
 * Count the explanation pages that actually exist, per track and per phase, and
 * write them to `src/data/page-counts.json`.
 *
 *   yarn page-counts          # rewrite src/data/page-counts.json
 *   yarn page-counts --check  # exit 1 if the committed file is stale (CI)
 *
 * ── Why this exists ──────────────────────────────────────────────────────────
 * `src/data/progress.js` carries a `pages` number per phase, hand-maintained. It
 * is NOT a file count and never was: for Java, phase 4 declares `topics: 13,
 * pages: 13` while `phase-4-lambdas-streams/` holds 28 files. The field tracks
 * *topics whose explanation is written*, and it drives the completion model —
 * `phaseStatus`, `topicsDone`, the percentage.
 *
 * The trouble is that it was also being printed as "187 pages" on the Java card,
 * where there are 2,095. One field cannot be both a progress input and an honest
 * page count, because the 300-line file cap means one topic routinely becomes
 * eight files. So the count is measured here instead, and `progress.js` keeps its
 * field for the model.
 *
 * Measured 2026-09-05 across the corpus: 2,831 declared against 5,875 real.
 *
 * ── What counts as a page ────────────────────────────────────────────────────
 * A leaf `.md` under `docs/<track>/pages/`. Excluded:
 *
 *   README.md       category index pages — furniture, not explanation. The
 *                   sidebar shows them as the category itself.
 *   reviews/        working records kept next to the content they review, and
 *                   already excluded from the build in docusaurus.config.js.
 *   syllabus/       the topic inventory, not an explanation of anything.
 *   _*              🔴 files and directories whose name starts with an
 *                   underscore. `docusaurus.config.js` excludes
 *                   `**\/_*.{js,jsx,ts,tsx,md,mdx}` and `**\/_*\/**`, so these
 *                   never become routes. There are 59 of them — Java's `_plan.md`
 *                   and `_PHASE-NOTES.md` working files — and counting them was
 *                   this script's first bug: it reported 5,875 where the
 *                   2026-09-05 corpus audit, measured independently, reported
 *                   5,816. The difference was exactly those 59.
 *
 * That is the same rule the corpus audit and the currency scan use, so all three
 * agree about what a page is. Keep it that way: a fourth definition of "page" is
 * how the site ends up quoting two different totals again.
 */

import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const DOCS = path.join(ROOT, 'docs');
const OUT = path.join(ROOT, 'src/data/page-counts.json');

const CHECK = process.argv.includes('--check');

/**
 * A page is *validated* when it carries BOTH marks the page contract requires: a
 * tier badge and a dated `> Verified:` line.
 *
 * 🔴 This is measured, never assumed. `summarise()` used to report the validated
 * count as `p.verified ?? p.files` — falling back to the FILE count on any track
 * written here, on the theory that a page written to contract always has both
 * marks. The homepage therefore printed "526/526 validated" for JavaScript when
 * disk held 525: `phase-0-how-javascript-runs/07-loading-scripts.md` deliberately
 * carries no `> Verified:` line (it documents browser-host behaviour nobody ran,
 * and says so in a banner). The page is honest; the number reporting it was not.
 * Measured here, a page that declines to claim verification cannot be counted as
 * having claimed it.
 */
function isValidated(file) {
  let text;
  try {
    text = fs.readFileSync(file, 'utf8');
  } catch {
    return false;
  }
  return /db-tier t-/.test(text) && /^> Verified:/m.test(text);
}

/** Recursively count leaf explanation pages under `dir`, and how many are validated. */
function countPages(dir) {
  let total = 0;
  let validated = 0;
  let entries;
  try {
    entries = fs.readdirSync(dir, {withFileTypes: true});
  } catch {
    return {total: 0, validated: 0};
  }
  for (const entry of entries) {
    if (entry.name.startsWith('_')) continue;
    if (entry.isDirectory()) {
      if (entry.name === 'reviews') continue;
      const sub = countPages(path.join(dir, entry.name));
      total += sub.total;
      validated += sub.validated;
    } else if (entry.name.endsWith('.md') && entry.name !== 'README.md') {
      total += 1;
      if (isValidated(path.join(dir, entry.name))) validated += 1;
    }
  }
  return {total, validated};
}

function listDirs(dir) {
  try {
    return fs
      .readdirSync(dir, {withFileTypes: true})
      .filter((e) => e.isDirectory() && !e.name.startsWith('_'))
      .map((e) => e.name)
      .sort();
  } catch {
    return [];
  }
}

const counts = {};

for (const track of listDirs(DOCS)) {
  const pagesDir = path.join(DOCS, track, 'pages');
  if (!fs.existsSync(pagesDir)) continue;

  // Per phase, keyed by the directory name — which is exactly the `slug` on each
  // phase in progress.js, so the two line up without a mapping table.
  const phases = {};
  const validatedPhases = {};
  for (const slug of listDirs(pagesDir)) {
    const c = countPages(path.join(pagesDir, slug));
    phases[slug] = c.total;
    validatedPhases[slug] = c.validated;
  }

  const track_ = countPages(pagesDir);
  counts[track] = {
    // Not `sum(phases)`: a track can hold loose pages directly under `pages/`
    // that belong to no phase directory, and they are still pages.
    pages: track_.total,
    validated: track_.validated,
    phases,
    validatedPhases,
  };
}

/*
 * No timestamp in the payload. It would change on every run and make this file
 * conflict between the several sessions that share this checkout, for no
 * information — the git history already says when it was regenerated.
 */
const json = JSON.stringify(counts, null, 2) + '\n';

if (CHECK) {
  const current = fs.existsSync(OUT) ? fs.readFileSync(OUT, 'utf8') : '';
  if (current !== json) {
    console.error('page-counts.json is stale. Run `yarn page-counts`.');
    process.exit(1);
  }
  console.log('page-counts.json is current.');
  process.exit(0);
}

fs.mkdirSync(path.dirname(OUT), {recursive: true});
fs.writeFileSync(OUT, json);

const tracks = Object.keys(counts).length;
const total = Object.values(counts).reduce((sum, t) => sum + t.pages, 0);
const validated = Object.values(counts).reduce((sum, t) => sum + t.validated, 0);
console.log(
  `page-counts.json — ${total} pages across ${tracks} tracks, ${validated} validated.`,
);
