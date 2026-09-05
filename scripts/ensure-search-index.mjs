#!/usr/bin/env node
/**
 * Makes site search work under `yarn start`.
 *
 * The problem this solves
 * ----------------------
 * @easyops-cn/docusaurus-search-local builds its index in the `postBuild`
 * lifecycle hook, by parsing the generated HTML with cheerio. No build means no
 * HTML, which means no index — so the dev server has always shown a search box
 * that finds nothing. That is the plugin's documented behaviour, not a fault.
 *
 * The fix
 * -------
 * The client fetches `<baseUrl>search-index{context}.json`, and Docusaurus
 * serves everything in `static/` at `<baseUrl>` in dev exactly as it does in a
 * build. So an index generated once and dropped into `static/` is served at the
 * URL the client already asks for, and search works under `yarn start`.
 *
 * This is only stable because `hashed: true` puts the content hash in the QUERY
 * STRING and leaves the filename alone (`hashed: "filename"` would put it in the
 * filename and every rebuild would orphan the copy). The query string is ignored
 * when serving a static file, so a slightly stale hash costs nothing.
 *
 * The site-wide index
 * -------------------
 * The build alone leaves the ROOT index — the one the search box uses on `/`,
 * where no technology context matches — holding a single page. This script runs
 * `scripts/merge-root-index.mjs` over the scratch build before copying, which
 * fills it with every page title in the corpus. Read that file's header for why
 * titles and not headings.
 *
 * Freshness
 * ---------
 * The copy is a snapshot. Pages written after it was generated will not appear
 * until you run `yarn search:index` again. That is the deliberate trade: an
 * instant `yarn start` instead of a full site build on every single start.
 *
 * What the refresh actually costs
 * ------------------------------
 * `yarn search:index` is not an indexing job — it is a complete production
 * build, because the plugin can only index HTML that exists. Measured
 * 2026-09-04: 6,515 markdown files, 1.3M lines, producing 26 index files
 * totalling 97 MB. The header used to say "~4 minutes"; that estimate predates
 * a corpus this size and is no longer quoted here, because the honest answer is
 * "as long as `yarn build` takes, plus the cheerio pass".
 *
 * 🔴 This build is tuned the same way `yarn build` is. It was not, until
 * 2026-09-04: this script shelled out to a bare `yarn docusaurus build` and set
 * only DOCUSAURUS_GENERATED_FILES_DIR_NAME, so the index refresh ran with
 * UNBOUNDED SSG worker threads, no worker recycling and the default V8 heap —
 * on 6,515 pages that is the configuration that thrashes and OOMs, which is why
 * the refresh felt far slower than a normal build. The env block below keeps the
 * two in step. If you change `yarn build`'s tuning in package.json, change it
 * here too.
 */

import {execFileSync} from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const staticDir = path.join(root, 'static');

// Matches the gitignored `build-*` prefix, so the scratch build never shows up
// as untracked noise in a checkout several sessions share.
const tmpOutDir = path.join(root, 'build-search-index-tmp');
const tmpGeneratedDir = '.docusaurus-search-index-tmp';

// Kept deliberately in step with `yarn build` in package.json. A bare
// `docusaurus build` uses as many SSG worker threads as it likes, never recycles
// them, and runs on the default V8 heap — fine for a small site, and the reason
// an index refresh on 6,515 pages used to crawl and then die. Anything the caller
// has already set wins, so `DOCUSAURUS_SSG_WORKER_THREAD_COUNT=8 yarn search:index`
// still does what it says.
const BUILD_TUNING = {
  DOCUSAURUS_SSG_WORKER_THREAD_COUNT: '4',
  DOCUSAURUS_SSG_WORKER_THREAD_RECYCLER_MAX_MEMORY: '500000000',
};

function buildTuning() {
  const env = {};
  for (const [key, value] of Object.entries(BUILD_TUNING)) {
    env[key] = process.env[key] ?? value;
  }

  // Appended rather than replaced: NODE_OPTIONS may already carry flags this
  // script knows nothing about, and clobbering them would be a worse bug than
  // the one being fixed. An explicit --max-old-space-size from the caller wins.
  const nodeOptions = process.env.NODE_OPTIONS ?? '';
  env.NODE_OPTIONS = nodeOptions.includes('--max-old-space-size')
    ? nodeOptions
    : `${nodeOptions} --max-old-space-size=8192`.trim();

  return env;
}

// Only used for the "here is what you are about to pay for" line, so a failure
// to walk the tree must never take the build down with it.
function mdFileCount() {
  const walk = (dir) => {
    let n = 0;
    let entries;
    try {
      entries = fs.readdirSync(dir, {withFileTypes: true});
    } catch {
      return 0;
    }
    for (const entry of entries) {
      if (entry.isDirectory()) n += walk(path.join(dir, entry.name));
      else if (/\.mdx?$/.test(entry.name)) n += 1;
    }
    return n;
  };
  const n = walk(path.join(root, 'docs'));
  return n > 0 ? n.toLocaleString('en-US') : 'thousands of';
}

const force = process.argv.includes('--force');

const existing = () =>
  fs.existsSync(staticDir)
    ? fs
        .readdirSync(staticDir)
        .filter((f) => /^search-index.*\.json$/.test(f))
        .sort()
    : [];

const mb = (bytes) => `${(bytes / 1048576).toFixed(1)} MB`;

const found = existing();

if (found.length > 0 && !force) {
  const newest = Math.max(
    ...found.map((f) => fs.statSync(path.join(staticDir, f)).mtimeMs),
  );
  const total = found.reduce(
    (sum, f) => sum + fs.statSync(path.join(staticDir, f)).size,
    0,
  );
  const age = Date.now() - newest;
  const hours = Math.floor(age / 3600000);
  const when = hours >= 24 ? `${Math.floor(hours / 24)}d ago` : `${hours}h ago`;

  console.log(
    `[search] using ${found.length} existing index file(s), ${mb(total)}, generated ${when}.`,
  );
  console.log(
    '[search] pages written since then will NOT be findable — run `yarn search:index` to refresh.',
  );
  process.exit(0);
}

console.log(
  force
    ? '[search] regenerating the search index (--force).'
    : '[search] no search index found in static/ — generating one now.',
);
console.log(
  '[search] this runs a FULL site build — the plugin can only index HTML that exists.',
);
console.log(
  `[search] ${mdFileCount()} markdown files to render, then a cheerio pass over the output.`,
);
console.log(
  '[search] budget the same wall clock as `yarn build`, and ~8 GB peak memory.',
);
console.log(
  '[search] ⚠️  hard rule 12: claim your row in the build/dev-server registry before running this',
);
console.log(
  '[search]     if other sessions are live — a build is as heavy as a dev server.',
);

fs.rmSync(tmpOutDir, {recursive: true, force: true});

try {
  execFileSync(
    'yarn',
    ['docusaurus', 'build', '--out-dir', path.basename(tmpOutDir)],
    {
      cwd: root,
      stdio: 'inherit',
      env: {
        ...process.env,
        DOCUSAURUS_GENERATED_FILES_DIR_NAME: tmpGeneratedDir,
        ...buildTuning(),
      },
    },
  );
} catch {
  console.error(
    '[search] the build failed, so no index was generated. In a shared checkout this is',
  );
  console.error(
    '[search] often another session mid-write (a duplicate route, a missing import) rather',
  );
  console.error('[search] than anything wrong here — wait and retry.');
  process.exit(1);
}

// Gives the ROOT index its site-wide content, exactly as `yarn build` does. Both
// call sites or neither: wiring only package.json produces a dev server whose
// homepage search is empty while production's works — the same divergence the
// build tuning above had to be brought back into step over.
try {
  execFileSync(process.execPath, [
    path.join(root, 'scripts', 'merge-root-index.mjs'),
    tmpOutDir,
  ], {cwd: root, stdio: 'inherit'});
} catch {
  console.error(
    '[search] the per-technology indexes were built, but merging them into the site-wide',
  );
  console.error(
    '[search] root index failed. static/ was left untouched — see the error above.',
  );
  process.exit(1);
}

const generated = fs
  .readdirSync(tmpOutDir)
  .filter((f) => /^search-index.*\.json$/.test(f));

if (generated.length === 0) {
  console.error(
    '[search] the build produced no search-index*.json — is the theme still registered',
  );
  console.error('[search] in docusaurus.config.js?');
  process.exit(1);
}

fs.mkdirSync(staticDir, {recursive: true});

// Clear stale indexes first: the set of context files changes whenever a
// technology folder is added or removed, and an orphan would be served forever.
for (const stale of existing()) {
  fs.rmSync(path.join(staticDir, stale));
}

let total = 0;
for (const file of generated) {
  const from = path.join(tmpOutDir, file);
  fs.copyFileSync(from, path.join(staticDir, file));
  total += fs.statSync(from).size;
}

fs.rmSync(tmpOutDir, {recursive: true, force: true});

console.log(
  `[search] wrote ${generated.length} index file(s) to static/, ${mb(total)} total.`,
);
console.log('[search] search now works under `yarn start`.');
