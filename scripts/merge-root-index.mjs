#!/usr/bin/env node
/**
 * Gives the SITE-WIDE search box something to search.
 *
 * The problem this solves
 * ----------------------
 * `searchContextByPaths` in docusaurus.config.js splits the index one-per
 * technology, because a single whole-site index measured 94.7 MB. That split is
 * what makes search inside /docs/react search only React — and it works.
 *
 * Its documented cost was the other half: a reader on `/` matches NO context, so
 * the search box fetches the ROOT index, and with
 * `useAllContextsWithNoSearchContext: false` the plugin puts into that root index
 * only the pages that matched no context at all. On this site that is exactly one
 * page (docs/README.md). Every query typed on the homepage returned
 * "No documents were found".
 *
 * The fix
 * -------
 * After the build, merge the TITLE documents — slot 0 — of every per-technology
 * index into the root index and rebuild its lunr index. The homepage then
 * searches page titles across every technology, and every other route keeps the
 * scoped index it already had.
 *
 * 🔴 This is NOT `useAllContextsWithNoSearchContext: true`. That flag ALSO pushes
 * every heading and every paragraph into the root index, which is how you get the
 * 94.7 MB file back. Slot 0 only. The size is printed on every run so the day
 * that stops being true is the day someone sees it.
 *
 * Why titles only, and not headings
 * ---------------------------------
 * Measured over this corpus: `Gotchas` occurs as a heading 2,074 times and
 * `Interview questions` 2,038 times, across 13 technologies. The search box shows
 * 8 suggestions. Headings would cost 5x the bytes to fill that list with the same
 * two words. Titles cannot: no page is titled "Gotchas", and the 300-line cap in
 * instructions.md means a page title IS a concept, so 2,895 pages are 2,895
 * distinct search targets.
 *
 * The honest limitation, worth knowing before trusting it: the homepage searches
 * TITLES. `multer`, `EADDRINUSE` and `ILIKE` appear in no page title anywhere in
 * the corpus, so they miss from `/` and hit from inside their own technology.
 *
 * Where it runs
 * -------------
 * Two places, and it must stay two:
 *   - `yarn build`                     (package.json) — what CI deploys
 *   - `scripts/ensure-search-index.mjs`              — what `yarn start` serves
 * Wiring only the first gives a dev server whose homepage search is empty while
 * production's works.
 *
 * NOT a Docusaurus plugin hook, deliberately: @docusaurus/core runs every
 * plugin's postBuild inside `Promise.all(plugins.map(...))`, so a plugin doing
 * this would race the search theme for the very files it reads. A `&&` in the
 * build script is ordered.
 *
 * Usage: node scripts/merge-root-index.mjs <outDir>
 */

import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';
import {createRequire} from 'node:module';
import {fileURLToPath} from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const require_ = createRequire(import.meta.url);

const PLUGIN = '@easyops-cn/docusaurus-search-local';
const pluginRoot = () => {
  try {
    return path.dirname(require_.resolve(`${PLUGIN}/package.json`));
  } catch {
    console.error(`[merge-root-index] ✖ cannot resolve ${PLUGIN} — is it still installed?`);
    process.exit(1);
  }
};

/**
 * 🔴 The search plugin's OWN index builder, imported rather than re-implemented.
 *
 * The alternative is to copy its eight lines of lunr configuration here. That
 * copy is the single worst failure this script can have: if upstream ever
 * changes a stemmer, a field or the tokenizer, a hand-rolled mirror keeps
 * producing a file that loads cleanly, parses cleanly, and searches subtly
 * wrong — the browser's query pipeline stemming one way while the index was
 * written the other. Nothing in this repo's pipeline would catch it.
 *
 * Importing means the site-wide index cannot be built differently from the
 * per-technology ones, because the same function builds both. The cost is a
 * private deep path into dist/, which fails LOUDLY at the next `yarn upgrade`
 * that moves it — a build failure naming the file to go read.
 */
const BUILD_INDEX = 'dist/server/server/utils/buildIndex.js';
let buildIndex;
try {
  ({buildIndex} = require_(path.join(pluginRoot(), BUILD_INDEX)));
} catch (error) {
  console.error(`[merge-root-index] ✖ cannot load ${PLUGIN}/${BUILD_INDEX}`);
  console.error(`[merge-root-index]   ${error.message}`);
  console.error(
    '[merge-root-index]   The plugin moved its index builder. Re-read that file and update this path;',
  );
  console.error(
    '[merge-root-index]   do NOT reimplement its lunr configuration here — a copy drifts silently.',
  );
  process.exit(1);
}

/**
 * Mirrors the plugin options in docusaurus.config.js, plus the Joi defaults for
 * the two it does not set (validateOptions.js:18-21). Only these three fields
 * are read by buildIndex.
 */
const INDEX_CONFIG = {
  language: ['en'],
  removeDefaultStopWordFilter: [],
  removeDefaultStemmer: false,
};

/** Only for the self-test below — the index itself is built by the plugin. */
const lunr = require_(require_.resolve('lunr', {paths: [pluginRoot()]}));

/** SearchDocumentType. Slot 0 is the only one this script writes. */
const TITLE = 0;
const SLOT_COUNT = 5;

/**
 * A merged root index far larger than a couple of MB means slots other than
 * TITLE have been merged in — i.e. the 94.7 MB regression, caught before it
 * ships rather than after. Generous on purpose: the projection at full corpus
 * is ~2.6 MB, so this fires only on a real mistake.
 */
const MAX_BYTES = 16 * 1024 * 1024;
const WARN_BYTES = 6 * 1024 * 1024;

const mb = (bytes) => `${(bytes / 1048576).toFixed(2)} MB`;
const kb = (bytes) => `${(bytes / 1024).toFixed(0)} KB`;

function die(message, ...rest) {
  console.error(`[merge-root-index] ✖ ${message}`);
  for (const line of rest) console.error(`[merge-root-index]   ${line}`);
  process.exit(1);
}

const outDir = path.resolve(root, process.argv[2] ?? 'build');

if (!fs.existsSync(outDir)) {
  die(`no such directory: ${outDir}`, 'usage: node scripts/merge-root-index.mjs <outDir>');
}

// ---------------------------------------------------------------------------
// Inputs
// ---------------------------------------------------------------------------

// Context paths come from docs/ — the SAME derivation docusaurus.config.js uses
// to build `searchContextByPaths`. Going the other way, filename -> context, is
// lossy: the plugin writes `docs/eslint-oxlint` as `search-index-docs-eslint-
// oxlint.json`, and nothing in that name says which hyphens were slashes.
const docsDir = path.join(root, 'docs');
const expectedContexts = fs
  .readdirSync(docsDir, {withFileTypes: true})
  .filter((entry) => entry.isDirectory() && !entry.name.startsWith('_'))
  .map((entry) => `docs/${entry.name}`)
  .sort();

/** The plugin's forward transform, which is the unambiguous direction. */
const fileForContext = (contextPath) =>
  `search-index-${contextPath.replace(/\//g, '-')}.json`;

const claimed = new Set();
const contextFiles = [];
const missingContexts = [];

for (const contextPath of expectedContexts) {
  const file = fileForContext(contextPath);
  if (fs.existsSync(path.join(outDir, file))) {
    claimed.add(file);
    contextFiles.push({file, contextPath});
  } else {
    // Not necessarily a fault: docs/reviews is excluded from the docs plugin and
    // docs/graphify-out holds no markdown, so neither can produce an index. A
    // folder full of ROUTED markdown with no index is a real gap, so count and
    // report that instead of counting files on disk.
    //
    // Mirrors the `exclude` list in docusaurus.config.js. It cannot be imported
    // from there: Docusaurus loads that file through jiti, which supplies the
    // `require` its `themes` array calls, and a plain ESM import would throw.
    const excluded = (name) => name === 'reviews' || name.startsWith('_');

    let markdown = 0;
    const walk = (dir) => {
      for (const entry of fs.readdirSync(dir, {withFileTypes: true})) {
        if (excluded(entry.name)) continue;
        if (entry.isDirectory()) walk(path.join(dir, entry.name));
        else if (/\.mdx?$/.test(entry.name)) markdown++;
      }
    };
    try {
      if (!excluded(path.basename(contextPath))) walk(path.join(root, contextPath));
    } catch {
      /* unreadable is not this script's problem to report */
    }
    missingContexts.push({contextPath, markdown});
  }
}

const orphanFiles = fs
  .readdirSync(outDir)
  .filter((f) => /^search-index-docs-.+\.json$/.test(f) && !claimed.has(f));

if (contextFiles.length === 0) {
  // `yarn build:fast` drops the search theme entirely (docusaurus.config.js
  // `themes: FAST_BUILD ? [] : [...]`), so there is legitimately nothing to
  // merge. Any other build reaching here has lost its search theme.
  if (process.env.FAST_BUILD === 'true') {
    console.log(
      '[merge-root-index] FAST_BUILD=true — search theme disabled, nothing to merge.',
    );
    process.exit(0);
  }
  die(
    `no search-index-docs-*.json in ${outDir}`,
    'is @easyops-cn/docusaurus-search-local still registered in docusaurus.config.js?',
  );
}

const rootFile = path.join(outDir, 'search-index.json');
if (!fs.existsSync(rootFile)) {
  die(
    `${contextFiles.length} context indexes but no search-index.json`,
    'the plugin emits the root index only when hideSearchBarWithNoSearchContext is false.',
  );
}

const rootIndex = JSON.parse(fs.readFileSync(rootFile, 'utf8'));
if (!Array.isArray(rootIndex) || rootIndex.length !== SLOT_COUNT) {
  die(
    `search-index.json is not a ${SLOT_COUNT}-slot array (got ${
      Array.isArray(rootIndex) ? `${rootIndex.length} slots` : typeof rootIndex
    })`,
    'the plugin changed its on-disk format — this script must be re-read against it.',
  );
}

// ---------------------------------------------------------------------------
// Collect the title documents
// ---------------------------------------------------------------------------

const titles = [];
const perContext = [];

for (const {file, contextPath} of contextFiles) {
  const parsed = JSON.parse(fs.readFileSync(path.join(outDir, file), 'utf8'));

  if (!Array.isArray(parsed) || parsed.length !== SLOT_COUNT) {
    die(`${file} is not a ${SLOT_COUNT}-slot array`, 'the plugin changed its on-disk format.');
  }
  const slot = parsed[TITLE];
  if (!slot || !Array.isArray(slot.documents)) {
    die(`${file} slot ${TITLE} has no documents array`, 'the plugin changed its on-disk format.');
  }
  if (slot.documents.length === 0) {
    die(`${file} contains zero title documents`, 'a technology indexed to nothing — that is a build fault, not a merge fault.');
  }

  for (const doc of slot.documents) {
    // /search dereferences `document.b.slice()` and `page.t` with no guard
    // (SearchPage.jsx), so a malformed document here is a crash in the reader's
    // browser and nowhere else. Refuse to write it.
    if (typeof doc.t !== 'string' || typeof doc.u !== 'string' || !Array.isArray(doc.b)) {
      die(
        `${file}: title document ${JSON.stringify(doc).slice(0, 120)} is missing t, u or b`,
        'the search page reads all three without a null check.',
      );
    }
    titles.push(doc);
  }

  perContext.push({context: contextPath, count: slot.documents.length});
}

// ---------------------------------------------------------------------------
// Drop anything a previous run of this script already merged in
// ---------------------------------------------------------------------------

// Document ids are unique only within ONE build: scanDocuments.js walks a single
// module-level counter across every context in turn. So `i` is a safe key here,
// and ONLY here — never across indexes from two different builds.
const contextPaths = perContext.map((c) => c.context);

// baseUrl, derived from the data rather than assumed: a context's own title urls
// start with `<baseUrl><contextPath>`.
const sample = titles[0];
const at = sample.u.indexOf(perContext[0].context);
if (at < 0) {
  die(
    `cannot derive baseUrl: ${JSON.stringify(sample.u)} does not contain ${perContext[0].context}`,
    'routeBasePath and searchContextByPaths have drifted apart.',
  );
}
const baseUrl = sample.u.slice(0, at);

/** The plugin's own context rule, verbatim: uri === path || uri.startsWith(path + '/'). */
const matchesAContext = (url) => {
  if (!url.startsWith(baseUrl)) return false;
  const uri = url.slice(baseUrl.length);
  return contextPaths.some((p) => uri === p || uri.startsWith(`${p}/`));
};

// Keeping only the genuinely root-owned documents makes this idempotent: run it
// twice on the same outDir and the second run rebuilds the same file rather than
// doubling it.
const rootOwned = rootIndex[TITLE].documents.filter((doc) => !matchesAContext(doc.u));
const alreadyMerged = rootIndex[TITLE].documents.length - rootOwned.length;

const merged = [...rootOwned, ...titles];

// ---------------------------------------------------------------------------
// Assertions that must hold before anything is written
// ---------------------------------------------------------------------------

const byId = new Map();
for (const doc of merged) {
  const clash = byId.get(doc.i);
  if (clash) {
    die(
      `duplicate document id ${doc.i}`,
      `${clash.u}`,
      `${doc.u}`,
      'ids are unique only within a single build. Do not merge index files produced by different builds:',
      'the parent links (`p`) would cross-link into the wrong pages, silently.',
    );
  }
  byId.set(doc.i, doc);
}

if (perContext.length < 2) {
  die(
    `only ${perContext.length} context index found — a global index over one technology is not global`,
    'check that the glob matched, and that the build indexed every docs/ folder.',
  );
}

// Every root heading/description/content document points at a title via `p`.
// worker.js resolves that against slot 0 and SearchPage.jsx then reads `page.b`
// with no guard, so an unresolvable parent is a TypeError in the browser.
const titleIds = new Set(merged.map((d) => d.i));
for (let slot = 0; slot < SLOT_COUNT; slot++) {
  if (slot === TITLE) continue;
  for (const doc of rootIndex[slot]?.documents ?? []) {
    if (doc.p !== undefined && !titleIds.has(doc.p)) {
      die(
        `root slot ${slot} document ${doc.i} has parent ${doc.p}, which is not a title`,
        'the search page dereferences the parent without a null check.',
      );
    }
  }
}

// ---------------------------------------------------------------------------
// Rebuild slot 0 — and only slot 0
// ---------------------------------------------------------------------------

// Slot 0 gains every page title; slots 1-4 keep exactly the documents the build
// put there. Handing the whole set back to the plugin's own builder means the
// site-wide index is constructed by the identical code path as the scoped ones.
const documentsBySlot = rootIndex.map((slot, i) =>
  i === TITLE ? merged : (slot?.documents ?? []),
);

const rebuilt = buildIndex(documentsBySlot, INDEX_CONFIG);

if (!Array.isArray(rebuilt) || rebuilt.length !== SLOT_COUNT) {
  die(
    `the plugin's buildIndex returned ${
      Array.isArray(rebuilt) ? `${rebuilt.length} slots` : typeof rebuilt
    }, expected ${SLOT_COUNT}`,
    'its output shape changed — this script must be re-read against it.',
  );
}

const json = JSON.stringify(rebuilt);
const bytes = Buffer.byteLength(json);

if (bytes > MAX_BYTES) {
  die(
    `merged root index is ${mb(bytes)}, over the ${mb(MAX_BYTES)} ceiling`,
    'this script merges TITLE documents only. That size means other slots got in —',
    'which is the 94.7 MB whole-site index the per-technology split exists to prevent.',
  );
}

// ---------------------------------------------------------------------------
// Prove the index can find its own documents before shipping it
// ---------------------------------------------------------------------------
//
// Using the plugin's own builder rules out a drifting lunr config, but not a
// drifting CONTRACT: a renamed ref field, a changed document shape, or an
// INDEX_CONFIG above that no longer matches the plugin's defaults would all
// still produce a file that loads and parses and finds nothing. Nothing else in
// this repo's pipeline would notice — no CI step reads build output, the
// indexes are gitignored so no diff appears, and ensure-search-index.mjs errors
// only when the file COUNT is zero.
//
// So query the index we just built, with terms taken from documents we know are
// in it. Self-referential on purpose: it cannot go stale as the corpus changes.

const loaded = lunr.Index.load(JSON.parse(json)[TITLE].index);
const probes = [];
const step = Math.max(1, Math.floor(merged.length / 25));

for (let i = 0; i < merged.length && probes.length < 25; i += step) {
  const doc = merged[i];
  const term = (doc.t.match(/[A-Za-z][A-Za-z0-9]{4,}/g) ?? [])
    .sort((a, b) => b.length - a.length)[0];
  if (!term) continue;
  probes.push({doc, term});
}

const failed = probes.filter(
  ({doc, term}) => !loaded.search(term).some((hit) => hit.ref === doc.i.toString()),
);

if (probes.length < 5) {
  die(`only ${probes.length} usable self-test probes — titles are not what this script expects.`);
}
if (failed.length > 0) {
  die(
    `${failed.length}/${probes.length} self-test queries did not find their own document`,
    ...failed.slice(0, 3).map(({doc, term}) => `"${term}" did not return ${doc.u}`),
    'the lunr build config here has drifted from the plugin\'s buildIndex.js.',
  );
}

// ---------------------------------------------------------------------------
// Write
// ---------------------------------------------------------------------------

const before = fs.statSync(rootFile).size;
fs.writeFileSync(rootFile, json);

const gz = zlib.gzipSync(json).length;

console.log(
  `[merge-root-index] ${perContext.length} technologies -> ${merged.length} page titles in the site-wide index`,
);
for (const {context, count} of perContext) {
  console.log(`[merge-root-index]   ${String(count).padStart(5)}  ${context}`);
}
if (rootOwned.length > 0) {
  console.log(
    `[merge-root-index]   ${String(rootOwned.length).padStart(5)}  (pages matching no technology)`,
  );
}
// A folder full of markdown that produced no index is the failure this script
// makes visible for the first time: the reader gets "no results" for a whole
// technology and cannot tell that from "the bible does not cover it".
for (const {contextPath, markdown} of missingContexts) {
  if (markdown === 0) continue;
  console.log(
    `[merge-root-index] ⚠️  ${contextPath} has ${markdown} markdown files but NO index — it is missing from site-wide search.`,
  );
}
for (const file of orphanFiles) {
  console.log(
    `[merge-root-index] ⚠️  ${file} matches no docs/ folder and was NOT merged — stale output directory?`,
  );
}
if (alreadyMerged > 0) {
  console.log(
    `[merge-root-index] re-ran on an already-merged index — rebuilt from scratch, dropped ${alreadyMerged} stale entries.`,
  );
}
console.log(
  `[merge-root-index] search-index.json ${kb(before)} -> ${kb(bytes)} (${kb(gz)} gzipped), ${probes.length} self-test queries passed.`,
);
if (bytes > WARN_BYTES) {
  console.log(
    `[merge-root-index] ⚠️  over ${mb(WARN_BYTES)} — every homepage visitor downloads this before their first result.`,
  );
}
