#!/usr/bin/env node
/**
 * The MDX parse gate — the second check that stands in for a full `yarn build`.
 *
 *   yarn mdxcheck                  # whole corpus, exit 1 on any failure
 *   yarn mdxcheck docs/angular     # one track or one topic directory
 *
 * 🔴 WHY THIS EXISTS. `yarn linkcheck` covers broken links, and nothing covered the
 * OTHER way a page fails the build: MDX cannot parse it. Same blast radius — the
 * `build` job fails, `deploy` is **skipped, not failed**, the workflow shows a single
 * X, https://sairamg8.github.io/devbible/ keeps serving the last good version, and
 * this shared checkout silently blocks EVERY other track's publish. Run 34034019419
 * died this way on 2026-09-06, and the defect was only visible after a 4-minute CI
 * round trip because the only local detector was a full build.
 *
 * 🔴 DOCUSAURUS PARSES `.md` AS MDX. `docusaurus.config.js` sets no `markdown.format`,
 * so Docusaurus 3's default applies and every `.md` in docs/ goes through the MDX
 * parser. A bare `{` or `<Word>` in prose is therefore CODE, not text.
 *
 * 🔴 THE TWO CLASSES SEEN SO FAR:
 *
 *   ACORN    "Could not parse expression with acorn" — a `{` reached the parser as
 *            prose and MDX tried to read a JSX expression. The cause is usually a
 *            code span that closed EARLIER than the author meant: an inline span
 *            delimited with single backticks whose content itself contains backticks
 *            (a JS template literal). Run 34034019419, chunk 14b line 119:
 *            `body = `{ if (…) }``  closed at the 2nd backtick, dumping `{ if (…) }`
 *            into prose; acorn was handed an `if` STATEMENT in expression position.
 *            FIX: re-delimit with ``double backticks`` and pad with spaces.
 *            ⛔ NOT: backslash-escaping the brace — it renders as a literal `\{`.
 *
 *   JSX-TAG  "Expected a closing tag for `<X>`" — a bare `<Something>` in prose read
 *            as a JSX element. Placeholders like `<TOPIC>` and `<what>` do this.
 *            FIX: wrap it in a code span, or use `&lt;`.
 *
 * ⚠️ SCOPE. This runs the parser only — the same @mdx-js/mdx the build uses, on the
 * same `format: 'mdx'`. It does not run Docusaurus's remark/rehype plugin chain, so
 * it catches parse failures (the class that has actually gone red) and not every
 * possible build error. It is a fast gate, not a substitute for a release build.
 *
 * 🔴 It honours the `exclude` list in docusaurus.config.js. Reporting a file the
 * build never loads is how a checker earns a reputation for crying wolf and gets
 * ignored — the same trap that made the old linkcheck's 122 false positives useless.
 */

import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {compile} from '@mdx-js/mdx';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const targets = process.argv.slice(2).filter((a) => !a.startsWith('-'));
const ROOTS = targets.length ? targets.map((t) => path.resolve(ROOT, t)) : [path.join(ROOT, 'docs')];

/** Mirrors `exclude` in docusaurus.config.js — files the docs plugin never loads. */
const excluded = (p) => {
  const segs = path.relative(ROOT, p).split(path.sep);
  return segs.includes('reviews') || segs.some((s) => s.startsWith('_'));
};

function walk(dir, acc = []) {
  for (const e of fs.readdirSync(dir, {withFileTypes: true})) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) walk(p, acc);
    else if (e.name.endsWith('.md') || e.name.endsWith('.mdx')) acc.push(p);
  }
  return acc;
}

/** Docusaurus strips YAML frontmatter before MDX ever sees the source. */
const body = (src) => src.replace(/^---\r?\n[\s\S]*?\r?\n---\r?\n/, (m) => '\n'.repeat(m.split('\n').length - 1));

function classify(reason = '') {
  if (/acorn/i.test(reason)) {
    return ['ACORN — a `{` reached the parser as prose',
            'a code span closed early: re-delimit with ``double backticks`` and pad with spaces'];
  }
  if (/closing tag/i.test(reason)) {
    return ['JSX-TAG — a bare `<Word>` read as a JSX element',
            'wrap it in a code span, or write &lt;'];
  }
  return ['MDX parse failure', 'read the reason above against the MDX spec'];
}

const files = ROOTS
  .flatMap((r) => (fs.existsSync(r) ? (fs.statSync(r).isDirectory() ? walk(r) : [r]) : []))
  .filter((f) => !excluded(f));

const problems = [];
for (const file of files) {
  try {
    await compile(body(fs.readFileSync(file, 'utf8')), {format: 'mdx'});
  } catch (e) {
    const reason = e.reason || e.message;
    const [cls, fix] = classify(reason);
    problems.push({file: path.relative(ROOT, file), line: e.line ?? '?', column: e.column ?? '?', reason, cls, fix});
  }
}

for (const p of problems) {
  console.log(`${p.file}:${p.line}:${p.column}\n  ${p.cls}\n  ${p.reason}\n  FIX: ${p.fix}`);
}
console.log(`\n${files.length} files checked, ${problems.length} problem(s).`);
if (problems.length) {
  console.log('🔴 MDX cannot parse this — the build WILL fail and the deploy will be SKIPPED.');
  process.exit(1);
}
