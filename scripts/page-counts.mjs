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
 *
 * That is the same rule the currency scan uses, so the two agree about what a
 * page is.
 */

import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const DOCS = path.join(ROOT, 'docs');
const OUT = path.join(ROOT, 'src/data/page-counts.json');

const CHECK = process.argv.includes('--check');

/** Recursively count leaf explanation pages under `dir`. */
function countPages(dir) {
  let total = 0;
  let entries;
  try {
    entries = fs.readdirSync(dir, {withFileTypes: true});
  } catch {
    return 0;
  }
  for (const entry of entries) {
    if (entry.isDirectory()) {
      if (entry.name === 'reviews') continue;
      total += countPages(path.join(dir, entry.name));
    } else if (entry.name.endsWith('.md') && entry.name !== 'README.md') {
      total += 1;
    }
  }
  return total;
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
  for (const slug of listDirs(pagesDir)) {
    phases[slug] = countPages(path.join(pagesDir, slug));
  }

  counts[track] = {
    // Not `sum(phases)`: a track can hold loose pages directly under `pages/`
    // that belong to no phase directory, and they are still pages.
    pages: countPages(pagesDir),
    phases,
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
console.log(`page-counts.json — ${total} pages across ${tracks} tracks.`);
