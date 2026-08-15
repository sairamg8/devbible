---
title: "13 · Bundlers and the build"
sidebar_label: "Overview"
sidebar_position: 0
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-08-15 against MDN — [JavaScript modules](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Guide/Modules), [Tree shaking](https://developer.mozilla.org/en-US/docs/Glossary/Tree_shaking), [Minification](https://developer.mozilla.org/en-US/docs/Glossary/Minification), [Source map](https://developer.mozilla.org/en-US/docs/Glossary/Source_map), [`Content-Encoding`](https://developer.mozilla.org/en-US/docs/Web/HTTP/Reference/Headers/Content-Encoding) — Node.js [Packages § `exports`](https://nodejs.org/api/packages.html#exports), webpack [Guides § Tree Shaking](https://webpack.js.org/guides/tree-shaking/), Rollup [`treeshake`](https://rollupjs.org/configuration-options/#treeshake), esbuild [§ metafile](https://esbuild.github.io/api/#metafile), web.dev [Reduce JavaScript payloads with code splitting](https://web.dev/articles/reduce-javascript-payloads-with-code-splitting). Documentation-validated; **no bundle sizes, no build times, no console blocks**.

The syllabus row is *ESM in, tree shaking, `sideEffects`, the `exports` map, and why your bundle is
400 kB*.

🔴 **The one idea underneath all three chunks: the bundler keeps what it can *prove* is
reachable.** It does not hunt for dead code — it declines to emit code it never reached and cannot
show is harmless to skip. Every configuration flag in this topic exists to give it that proof, and
every disappointment ("why is this still in my bundle") is a place the proof is missing.

⚠️ **This topic asserts no sizes and no build times.** None were measured here, so it teaches the
mechanisms and the method; the numbers are yours to produce against your own build.

## Chunks

| # | Chunk | Covers |
|---|---|---|
| 01 | **[What a bundler actually does](./01-what-a-bundler-does.md)** | Why bundle when browsers run modules; 🔴 **dev server and production build are different code paths**; the six-step pipeline; the `exports` map — conditions, first-match-wins, and **encapsulation**; the dual-publish double-load and the `instanceof` failure it causes; chunk granularity and the waterfall you can reintroduce; source maps keyed to a release id; and why anything injected at build time is public |
| 02 | **[Tree shaking, and what defeats it](./02-tree-shaking.md)** | Shaking as *keeping*, not removing; why it needs ESM and how transpiling to CommonJS kills it; **side effects as the real blocker**; the three forms of `sideEffects` in `package.json` and the CSS trap; `/*#__PURE__*/` and `/*#__NO_SIDE_EFFECTS__*/`; Rollup's `moduleSideEffects` / `propertyReadSideEffects` and safest-versus-smallest; and the six things that defeat it — a CJS dependency, **a re-export barrel**, a dynamically indexed namespace import, your own top-level work, fields and getters, and dev mode |
| 03 | **[Analysing and shrinking a bundle](./03-analysing-and-shrinking.md)** | Which of the three "sizes" you are looking at (raw · transfer · executed) and why compression flatters you; reading a chunk report and an analyser's treemap or metafile; 🔴 **always ask who imported this**; the three questions in order — **remove, then defer, then shrink**; splitting moves bytes rather than deleting them; the usual weight (duplicate copies, one-big-module dependencies, locale data, a low transpile target, dev-only code, inlined maps and assets); and the checklist worth keeping |

## Five facts worth carrying out of this topic

- **"Works in dev, broken in the build" is structural**, not bad luck — the two paths are different
  code, and only the build path has to analyse your graph statically.
- **`exports` encapsulates a package.** A deep import that stopped resolving was not broken by you.
- **`"sideEffects": false` is a promise, not a setting** — and a wrong one deletes your CSS from
  the production build only.
- **A barrel file turns one import into an edge to everything behind it.** Import the module.
- **Code splitting does not shrink the bundle.** Only removing an import does.

## Phase gate

You can explain what a bundler proves and why ESM is required for it; predict what a given
`exports` map will and will not resolve; say why an unused import survived and name the fix; and
walk a bundle report from "it is too big" to a specific import chain and a decision to remove,
defer or replace.

## Where this connects

- [01 · Import and export](../01-es-modules/01-import-and-export.md) — the static structure every
  claim in this topic rests on
- [02 · Singletons and strict mode](../02-module-semantics/01-singletons-and-strict.md) — module
  top level as code that runs, which is what "side effect" means here
- [05 · The expression](../05-dynamic-import/01-the-expression.md) — `import()`, the deferral in
  step 2 of the shrinking method
- [05 · Code splitting](../05-dynamic-import/02-code-splitting.md) — chunks, the analysable
  specifier, and the stale-chunk 404 after a deploy
- [08 · Cause chains and boundaries](../08-custom-error-classes/02-cause-chains-and-boundaries.md)
  — why `instanceof` is the wrong test when a library can be loaded twice
- [10 · Shipping errors to a reporter](../10-global-error-handling/02-shipping-to-a-reporter.md) —
  what source maps are for once the build is minified
- [12 · Reading a snapshot](../12-finding-a-leak/02-reading-a-snapshot.md) — the same
  follow-the-path discipline, applied to memory instead of size

---

Start → [01 · What a bundler actually does](./01-what-a-bundler-does.md)
