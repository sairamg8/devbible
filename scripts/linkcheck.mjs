#!/usr/bin/env node
/**
 * The broken-link gate — the check that stands in for a full `yarn build`.
 *
 *   yarn linkcheck                 # whole corpus, exit 1 on any problem
 *   yarn linkcheck docs/angular    # one track or one topic directory
 *
 * 🔴 WHY THIS EXISTS. `docusaurus.config.js` sets `onBrokenLinks: 'throw'`, so ONE
 * unresolvable link fails the `build` job — and `deploy` is then **skipped, not failed**.
 * The workflow shows a single X, https://sairamg8.github.io/devbible/ keeps serving the
 * last good version, and this shared checkout silently blocks EVERY other track's publish
 * until someone thinks to look at Actions. It stayed red for two hours on 2026-09-06.
 *
 * 🔴 TWO defect classes have gone red. They look IDENTICAL in a build log and have
 * OPPOSITE fixes — getting them backwards is the trap:
 *
 *   CLASS 1  dangling forward ref — a link to OUR OWN chunk that is not written yet.
 *            Runs 34008305214, 34008410251.
 *            FIX: de-link to **bold** + *(not written yet)*; re-link when the chunk lands.
 *            ⛔ NOT: make it absolute — that points at nothing.
 *
 *   CLASS 2  inherited href — a link copied verbatim out of upstream docs, carrying the
 *            SOURCE site's relative path. angular.dev writes `guide/directives`; pasted
 *            into our page Docusaurus resolves it against OUR url. Run 34015877866.
 *            FIX: make the href absolute (`https://angular.dev/guide/directives`).
 *            ⛔ NOT: de-link it — that silently drops a real citation.
 *            A quote is the one place a writer is TRYING not to alter the text, so this
 *            class will recur. Inside a `> *"…"*` block every `](…)` belongs to the site
 *            being quoted, never to us.
 */

import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const targets = process.argv.slice(2).filter((a) => !a.startsWith('-'));
const ROOTS = targets.length ? targets.map((t) => path.resolve(ROOT, t)) : [path.join(ROOT, 'docs')];

/** Markdown outside fenced blocks and inline code — where a real link can live. */
function prose(src) {
  const out = [];
  let fenced = false;
  for (const line of src.split('\n')) {
    if (/^\s*(```|~~~)/.test(line)) { fenced = !fenced; out.push(''); continue; }
    out.push(fenced ? '' : line.replace(/`[^`]*`/g, ''));
  }
  return out;
}

function walk(dir, acc = []) {
  for (const e of fs.readdirSync(dir, {withFileTypes: true})) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) walk(p, acc);
    else if (e.name.endsWith('.md') || e.name.endsWith('.mdx')) acc.push(p);
  }
  return acc;
}


/**
 * Resolve a link the way Docusaurus does, not the way the filesystem does.
 * 🔴 Docusaurus strips a leading `NN-` ordering prefix from every path segment, so
 * `04-allowlists/` is served at `allowlists/`. A naive fs.existsSync() check reports
 * 122 false positives on this corpus — the exact reason the older devbible-linkcheck.py
 * "disagreed with" the build log. Match on the stripped name too.
 */
const strip = (n) => n.replace(/^\d+[-.]/, '');

function resolves(fromDir, target) {
  let dir = fromDir;
  const segs = target.split('/').filter((s) => s && s !== '.');
  for (let i = 0; i < segs.length; i++) {
    const seg = segs[i];
    if (seg === '..') { dir = path.dirname(dir); continue; }
    let entries;
    try { entries = fs.readdirSync(dir); } catch { return false; }
    const last = i === segs.length - 1;
    // A final segment may name the file with or without its .md extension.
    const cands = last ? [seg, `${seg}.md`, `${seg}.mdx`] : [seg];
    const hit = entries.find((e) => cands.some((c) => e === c || strip(e) === strip(c)));
    if (!hit) return false;
    dir = path.join(dir, hit);
  }
  if (!fs.existsSync(dir)) return false;
  if (fs.statSync(dir).isFile()) return true;
  // A directory link serves its README/index.
  return ['README.md', 'index.md', 'index.mdx'].some((n) => fs.existsSync(path.join(dir, n)));
}

const problems = [];
const files = ROOTS.flatMap((r) => (fs.existsSync(r) ? (fs.statSync(r).isDirectory() ? walk(r) : [r]) : []));

for (const file of files) {
  prose(fs.readFileSync(file, 'utf8')).forEach((line, i) => {
    for (const m of line.matchAll(/\]\(([^)\s]+)\)/g)) {
      const raw = m[1];
      // Absolute, anchor-only, mail, and site-root links are Docusaurus's problem, not ours.
      if (/^(https?:|mailto:|#|\/)/.test(raw)) continue;
      const target = raw.split('#')[0];
      if (!target) continue;
      if (resolves(path.dirname(file), target)) continue;
      const cls = /\.mdx?$/.test(target)
        ? ['CLASS-1 dangling own-chunk ref', 'de-link to **bold** *(not written yet)*']
        : ['CLASS-2 inherited href from quoted docs', 'make the href absolute to the upstream origin'];
      problems.push({file: path.relative(ROOT, file), line: i + 1, raw, cls: cls[0], fix: cls[1]});
    }
  });
}

for (const p of problems) {
  console.log(`${p.file}:${p.line}\n  ${p.cls}  ->  ${p.raw}\n  FIX: ${p.fix}`);
}
console.log(`\n${files.length} files scanned, ${problems.length} problem(s).`);
if (problems.length) {
  console.log('🔴 onBrokenLinks is THROW — this WILL fail the build and skip the deploy.');
  process.exit(1);
}
