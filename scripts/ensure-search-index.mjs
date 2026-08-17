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
 * Freshness
 * ---------
 * The copy is a snapshot. Pages written after it was generated will not appear
 * until you run `yarn search:index` again. That is the deliberate trade: an
 * instant `yarn start` instead of a ~4 minute build on every single start.
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
  '[search] this runs a full site build and takes several minutes (~8 GB peak memory).',
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
