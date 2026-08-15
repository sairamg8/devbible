---
title: "03 · Analysing and shrinking a bundle"
sidebar_label: "03 · Analysing and shrinking"
sidebar_position: 3
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-08-15 against MDN — [Minification](https://developer.mozilla.org/en-US/docs/Glossary/Minification), [`Content-Encoding`](https://developer.mozilla.org/en-US/docs/Web/HTTP/Reference/Headers/Content-Encoding), [Source map](https://developer.mozilla.org/en-US/docs/Glossary/Source_map), [`import()`](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Operators/import) — webpack [Guides § Tree Shaking](https://webpack.js.org/guides/tree-shaking/), Rollup [`treeshake`](https://rollupjs.org/configuration-options/#treeshake), esbuild [API § metafile](https://esbuild.github.io/api/#metafile) and [§ analyze](https://esbuild.github.io/api/#analyze), and web.dev [Reduce JavaScript payloads with code splitting](https://web.dev/articles/reduce-javascript-payloads-with-code-splitting). Documentation-validated; **no bundle sizes, no build times, no console blocks, and no reproduced analyser output**.

## "Why is my bundle 400 kB" is the wrong first question

The right one is **which modules are in it, and who imported them**. Size is a symptom; the import
chain is the cause, and it is the only thing you can act on. The method is the same shape as
finding a leak — you do not browse, you **diff and follow a path**
([12 · Reading a snapshot](../12-finding-a-leak/02-reading-a-snapshot.md)).

⚠️ **This page prints no sizes.** Every number depends on your dependencies, your target and your
compression, and none was measured here. What transfers is the procedure and what each number
means.

## Know which number you are looking at

Three different sizes get called "the bundle size", and they answer different questions:

| Number | Where it comes from | What it governs |
|---|---|---|
| **Raw / uncompressed** | the emitted file on disk, what analysers usually report | parse and compile work in the browser |
| **Transfer (compressed)** | the network panel, after `Content-Encoding` | download time |
| **Executed** | a coverage tool | how much of what you shipped is actually used |

🔴 **Do not celebrate a compressed number and ignore the raw one.** Compression is applied to
bytes on the wire; the engine still parses and compiles the *uncompressed* source. MDN lists
`gzip`, `br` (Brotli) and `zstd` as the encodings a server negotiates — text compresses well, and
that is exactly why a change that halves the transfer size may barely move startup cost.

**Minification is separate again.** It shortens names and drops whitespace before compression;
MDN's framing is that it removes what is unnecessary for execution but not for a reader. It shrinks
raw bytes without removing a single module — useful, and never the fix for "we ship a library we
do not use".

## Reading the report

Every bundler can tell you what it emitted, and each ecosystem has an analyser on top: a treemap
plugin for webpack or Rollup, and for esbuild the **`metafile`** JSON — inputs, outputs, byte
counts and the import relationships between them — with `--analyze` printing a human-readable
version of the same data.

Read them in this order:

1. **The chunk list.** How many chunks, how big each is, and which are loaded at startup versus on
   demand. A single huge entry chunk and a page-load waterfall are different problems.
2. **The biggest inputs inside the biggest chunk.** Not the biggest file overall — the biggest
   contributors to the chunk the user waits for.
3. **The import chain for each one.** Every analyser can answer *why is this here*. This is the
   step people skip, and it is the one that produces the fix.

⚠️ **Analyser byte counts are usually pre-compression, and after minification they are attributed
to the module the bytes came from.** Treat them as *relative* weight — "this dependency is a
quarter of the entry chunk" — not as what the user downloads.

## Then ask three questions, in order

For each heavy module, in this order, because the cheapest answer is first:

**1 · Is it needed at all?** A utility library used for two functions, a date library used for one
format, a polyfill for a browser you no longer support. Removing an import is the only change that
makes the total smaller.

**2 · Is it needed at startup?** If not, it is an `import()` behind the interaction that needs it
([05 · Code splitting](../05-dynamic-import/02-code-splitting.md)). web.dev's code-splitting
guidance is exactly this — send only what is necessary at the very beginning and lazy-load the
rest.

🔴 **Splitting does not shrink anything. It moves it.** The total is the same or slightly larger;
what improves is the *first* payload. Say which one you are optimising, or you will "fix" a size
problem and wonder why the number in CI did not move.

**3 · Can it be smaller?** A lighter dependency, a deep import instead of a barrel, or the platform
(`Intl` instead of a formatting library). This is where the tree-shaking work from
[02 · Tree shaking](./02-tree-shaking.md) pays off — but only after the first two questions, because
shaking a dependency you did not need is effort spent keeping it.

## The usual suspects, and what each looks like in the report

**Two copies of the same library.** The unmistakable sign: the same package name at two paths, or
under two versions. Causes are a version conflict in the dependency tree, or a dual-published
package resolved through both `import` and `require`
([01 · What a bundler does](./01-what-a-bundler-does.md)). Beyond the bytes it breaks singletons and
`instanceof`. Fix by deduplicating the tree or pinning one condition.

**A dependency that is one big module.** Nothing to shake, because there is nothing to shake *out*
— a CommonJS build or a single bundled file. Look for an ESM build, a modular sibling package, or
a platform API that replaces it.

**Locale, icon or timezone data.** Frequently larger than the library that consumes it, and
frequently all of it is included because the lookup is dynamic
([02 · what defeats tree shaking](./02-tree-shaking.md)). Import the locales you support explicitly.

**Polyfills and syntax lowering from a low target.** The transpiler's target list decides how much
helper code and how many polyfills are injected, and an old target rewrites modern syntax into
much larger output. Raising the target to what you actually support is often the single largest
change available, and it costs nothing at run time.

**Development-only code that survived.** Warning machinery, mock data, a dev fixture imported from
a shared module. It is meant to be removed by the build-time constant fold
([01 · What the build injects](./01-what-a-bundler-does.md)); if you can find the strings in the
output, the fold did not happen.

**Source maps or assets inlined into the JavaScript.** An inline source map lives inside the file
it describes; small assets are inlined as data URIs below a threshold. Both are legitimate
settings and both show up as unexplained weight.

## What to fix, and what to leave

**Fix, in roughly this order:** duplicated copies of a dependency · a needlessly low transpile
target · anything development-only reaching production · a heavy dependency used for one function ·
a barrel import in a hot path · non-startup features loaded eagerly.

**Leave alone:** micro-optimising your own source. Application code is almost never the weight —
dependencies and generated code are — and shrinking hand-written modules costs readability for
bytes that compression was going to take anyway.

## The checklist worth keeping

- ✅ **Measure before and after, the same way.** One number, one method, written down.
- ✅ **Look at the entry chunk first** — that is what the user waits for.
- ✅ **Always ask "who imported this"** before deciding what to do about it.
- ✅ **Remove before you defer, defer before you shrink.**
- ✅ **Check for duplicate copies** every time the tree changes.
- ✅ **Confirm the production build**, never the dev server — different code paths
  ([01 · What a bundler does](./01-what-a-bundler-does.md)).
- ✅ **Put a budget in CI** so the next regression is caught by the build, not by a user.
- ⛔ **Do not quote a number you did not produce on your own build**, including the ones in this
  phase's sources.

## Gotchas

**Symptom: the compressed size barely changed after a big removal.**
Cause — you removed repetitive code, which compressed extremely well already.
Fix — judge parse-cost work by the raw size and download work by the transfer size; report both.

**Symptom: splitting a route changed nothing in the reported total.**
Cause — splitting moves bytes between chunks; it does not delete them.
Fix — measure the *initial* payload instead, and be explicit about which number the change targets.

**Symptom: the same library appears twice in the treemap.**
Cause — a version conflict, or one copy resolved through `import` and one through `require`.
Fix — deduplicate or pin a single resolution; expect broken singletons until you do.

**Symptom: the bundle grew after a dependency bump, with no code change.**
Cause — the new version changed its build output, its `exports` conditions, or its own
dependencies.
Fix — re-run the analyser and compare the import chains, not the totals.

**Symptom: enormous output for a small application.**
Cause — a very low browser target injecting helpers and polyfills into everything.
Fix — raise the target to your real support matrix and rebuild.

**Symptom: development warnings are visible in the production output.**
Cause — the environment constant was not replaced, so the branch was never folded away.
Fix — check the build's define/replacement configuration; the strings surviving is the proof.

**Symptom: analyser numbers do not match the network panel.**
Cause — the analyser reports pre-compression bytes.
Fix — use the analyser for relative weight and the network panel for transfer size.

## Interview questions

**★ How do you find out why a bundle is large?**
Read the chunk report, take the largest inputs of the *entry* chunk, and follow each one's import
chain to the code that pulled it in. The chain is the actionable part, not the size.

**★ Which size number matters?**
Both, for different reasons — compressed bytes govern download time, uncompressed bytes govern
parse and compile work, and a coverage tool tells you how much of it ran at all.

**★ Does code splitting make the bundle smaller?**
No. It moves code out of the initial payload; the total is unchanged or slightly larger. Only
removing an import shrinks the total.

**★ In what order do you attack a heavy dependency?**
Remove it if it is unnecessary, defer it behind `import()` if it is not needed at startup, and
only then look for a lighter replacement or better shaking.

**★ Why would the same library appear twice?**
Two versions in the dependency tree, or a dual-published package resolved through both `import` and
`require` — which also gives you two module states and failing `instanceof`.

**★ How can the transpile target dominate bundle size?**
A low target lowers modern syntax into much larger equivalents and injects helpers and polyfills
throughout the output — with no source change of your own.

**★ What does minification do that tree shaking does not?**
Minification shortens and strips what is unnecessary for execution within the code you kept. Tree
shaking decides what is kept at all. Neither substitutes for the other.

**How do you stop a size regression coming back?**
A budget checked in CI against the same measurement, so the build fails rather than the user
noticing.

---

← Prev: [02 · Tree shaking, and what defeats it](./02-tree-shaking.md) ·
[Topic index](./README.md)
