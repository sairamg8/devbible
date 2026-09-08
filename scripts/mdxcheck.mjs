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
 *   EXPR     🔴 ADDED 2026-09-08. `ReferenceError: <name> is not defined`, raised during
 *            STATIC RENDERING, not parsing. `{string}` in prose is *valid MDX* — it is a
 *            JSX expression — so `compile()` accepts it happily and the page dies later,
 *            in SSG, when the expression is evaluated against a scope that has no such
 *            name. **This class is why the deploy was red for 20 hours on 2026-09-07/08:
 *            `mdxcheck` and `linkcheck` were BOTH green the whole time.** Three shapes,
 *            one root cause — something reached prose that the author meant as code:
 *              · a bare `{ident}`      — `BASE_URL: {string} the base url`
 *              · nested backticks      — ``(`scope: { id: `todo-${todo.id}` }`)`` closes
 *                                        the span at the 2nd backtick
 *              · a `\``-escaped backtick INSIDE a code span — ``(`key={\`p-${i}\`}`)``.
 *                🔴 Markdown does NOT process backslash escapes in a code span, so the
 *                span ends AT that backtick and `${i}` lands in prose.
 *            FIX for all three: re-delimit with ``double backticks``.
 *            ⛔ NOT a backslash — `\{` and `\<` render the backslash literally.
 *
 * ⚠️ SCOPE. This runs the parser and a free-identifier scan of every MDX expression — the
 * same @mdx-js/mdx the build uses, on the same `format: 'mdx'`. It does not run
 * Docusaurus's remark/rehype plugin chain or actually render, so it catches the three
 * classes that have gone red and not every possible build error. It is a fast gate, not
 * a substitute for a release build.
 *
 * 🔴 WHY THE EXPRESSION SCAN IS SAFE TO FAIL ON. Measured over the whole corpus the day
 * it was added: 1,717 MDX expression nodes, of which 1,339 are `{/* comments *\/}` and
 * every one of the remaining 378 is a bare numeric literal (`{0}`, `{1}`, `{2}`) or `{}`.
 * **Not one legitimate page referenced an identifier.** So flagging a free identifier is
 * a zero-false-positive check here, which is the bar a gate has to clear before it is
 * allowed to exit 1 — see the 122 false positives that got the old linkcheck ignored.
 *
 * 🔴 It honours the `exclude` list in docusaurus.config.js. Reporting a file the
 * build never loads is how a checker earns a reputation for crying wolf and gets
 * ignored — the same trap that made the old linkcheck's 122 false positives useless.
 */

import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {compile, createProcessor} from '@mdx-js/mdx';

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

/**
 * Names an MDX expression may reference without exploding at render time. MDX evaluates
 * against the component scope plus the usual globals; nothing else is in there. Kept
 * deliberately generous — a false negative costs one CI round trip, a false positive
 * costs the gate its credibility.
 */
const IN_SCOPE = new Set([
  'props', 'undefined', 'null', 'true', 'false', 'NaN', 'Infinity',
  'Math', 'JSON', 'Date', 'String', 'Number', 'Boolean', 'Array', 'Object',
]);

/** Every binding a pattern introduces, so an inline arrow's own params are not "free". */
function patternNames(node, out) {
  if (!node || typeof node.type !== 'string') return;
  if (node.type === 'Identifier') out.add(node.name);
  else if (node.type === 'ObjectPattern') for (const p of node.properties) patternNames(p.value ?? p.argument, out);
  else if (node.type === 'ArrayPattern') for (const e of node.elements) patternNames(e, out);
  else if (node.type === 'AssignmentPattern') patternNames(node.left, out);
  else if (node.type === 'RestElement') patternNames(node.argument, out);
}

/**
 * Identifiers an expression READS and never defines — exactly what becomes
 * `ReferenceError: <name> is not defined` when SSG evaluates the page.
 */
function freeIdentifiers(estree) {
  const found = new Set();
  const declared = new Set();
  (function walk(node, parent) {
    if (!node || typeof node.type !== 'string') return;
    if (node.type === 'Identifier') {
      // `a.b` reads `a`, never `b`; `{b: 1}` defines a key, it does not read one.
      const isMemberProp = parent?.type === 'MemberExpression' && parent.property === node && !parent.computed;
      const isPropKey = parent?.type === 'Property' && parent.key === node && !parent.computed;
      if (!isMemberProp && !isPropKey && !declared.has(node.name) && !IN_SCOPE.has(node.name)) found.add(node.name);
      return;
    }
    if (node.type === 'ArrowFunctionExpression' || node.type === 'FunctionExpression') {
      for (const p of node.params) patternNames(p, declared);
    }
    if (node.type === 'VariableDeclarator') patternNames(node.id, declared);
    for (const key of Object.keys(node)) {
      if (key === 'loc' || key === 'range' || key === 'start' || key === 'end') continue;
      const v = node[key];
      if (Array.isArray(v)) for (const c of v) walk(c, node);
      else if (v && typeof v.type === 'string') walk(v, node);
    }
  })(estree, null);
  return [...found];
}

/** The same parser the build uses, so the mdast (and its attached estree) matches. */
const processor = createProcessor({format: 'mdx'});

function scanExpressions(src) {
  const hits = [];
  let tree;
  try {
    tree = processor.parse(src);
  } catch {
    return hits; // Unparseable is the ACORN/JSX-TAG classes' business, already reported.
  }
  (function visit(node) {
    if (node.type === 'mdxTextExpression' || node.type === 'mdxFlowExpression') {
      const estree = node.data?.estree;
      if (estree) {
        const free = freeIdentifiers(estree);
        if (free.length) {
          hits.push({
            line: node.position?.start?.line ?? '?',
            column: node.position?.start?.column ?? '?',
            names: free,
            text: `{${(node.value ?? '').replace(/\s+/g, ' ').slice(0, 60)}}`,
          });
        }
      }
    }
    for (const c of node.children ?? []) visit(c);
  })(tree);
  return hits;
}

const files = ROOTS
  .flatMap((r) => (fs.existsSync(r) ? (fs.statSync(r).isDirectory() ? walk(r) : [r]) : []))
  .filter((f) => !excluded(f));

const problems = [];
for (const file of files) {
  const src = body(fs.readFileSync(file, 'utf8'));
  const rel = path.relative(ROOT, file);
  try {
    await compile(src, {format: 'mdx'});
  } catch (e) {
    const reason = e.reason || e.message;
    const [cls, fix] = classify(reason);
    problems.push({file: rel, line: e.line ?? '?', column: e.column ?? '?', reason, cls, fix});
    continue; // It never compiled; the expression scan would only add noise.
  }
  // 🔴 It COMPILED. That is not the same as it rendering — see the EXPR class above.
  for (const h of scanExpressions(src)) {
    problems.push({
      file: rel,
      line: h.line,
      column: h.column,
      reason: `${h.text} evaluates ${h.names.map((n) => `\`${n}\``).join(', ')} at render time — nothing defines ${h.names.length > 1 ? 'them' : 'it'}`,
      cls: 'EXPR — prose read as a JSX expression (compiles, then dies in SSG)',
      fix: 'this was meant to be code: re-delimit the span with ``double backticks``',
    });
  }
}

for (const p of problems) {
  console.log(`${p.file}:${p.line}:${p.column}\n  ${p.cls}\n  ${p.reason}\n  FIX: ${p.fix}`);
}
console.log(`\n${files.length} files checked, ${problems.length} problem(s).`);
if (problems.length) {
  console.log('🔴 The build WILL fail on this and the deploy will be SKIPPED (skipped, not failed —');
  console.log('   one X in the workflow, and the live site keeps serving the last good version).');
  process.exit(1);
}
