---
title: "01 · What a bundler actually does"
sidebar_label: "01 · What a bundler does"
sidebar_position: 1
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-08-15 against MDN — [JavaScript modules](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Guide/Modules), [`import()`](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Operators/import), [`<script type="module">`](https://developer.mozilla.org/en-US/docs/Web/HTML/Reference/Elements/script/type/module), [`<link rel="modulepreload">`](https://developer.mozilla.org/en-US/docs/Web/HTML/Reference/Attributes/rel/modulepreload), [Source map](https://developer.mozilla.org/en-US/docs/Glossary/Source_map), [Tree shaking](https://developer.mozilla.org/en-US/docs/Glossary/Tree_shaking), [Minification](https://developer.mozilla.org/en-US/docs/Glossary/Minification) — and Node.js [Packages § `exports`](https://nodejs.org/api/packages.html#exports), [§ `type`](https://nodejs.org/api/packages.html#type). Documentation-validated; **no timings, no bundle sizes, no console blocks**.

⚠️ **No sizes or build times appear on this page.** Nothing was measured here, so the numbers you
will read elsewhere ("saves 30 kB") are not repeated — the mechanisms are what transfer, and the
numbers are yours to produce with your own analyser.

## Browsers run modules. So why bundle at all?

`<script type="module">` works everywhere, and a small application can ship unbundled. What a
bundler buys is not "modules working" — it is four things a raw module graph does not give you:

| | What it does |
|---|---|
| **Fewer requests** | a deep graph is a deep chain of requests; bundling flattens it |
| **Dead-code removal** | tree shaking, plus stripping development-only branches |
| **Rewriting for the runtime** | bare specifiers (`import x from 'lodash'`) are not resolvable in a browser |
| **Everything that is not JavaScript** | TypeScript, JSX, CSS, assets, environment injection |

🔴 **The third row is the one people forget.** A browser cannot resolve `'react'` — that is a Node
resolution convention. Without a bundler you need an import map, and the moment a dependency
imports another bare specifier you are maintaining the whole graph by hand.

**Modern tools do two different jobs.** In development they usually serve native ES modules and
transform files on demand, which is why the dev server starts instantly; for production they run a
real bundler over the graph. **The two paths are different code**, which is exactly why "works in
dev, broken in the build" is such a common report — and why the
[05 · unanalysable specifier](../05-dynamic-import/02-code-splitting.md) fails only in the build.

## The pipeline, in the order it happens

1. **Resolve** — turn every specifier into a file, using the package's `exports` map and the
   platform conditions.
2. **Parse and build the graph** — from the entry points outward, recording every import and
   export.
3. **Transform** — TypeScript, JSX, syntax lowering for the target, environment replacement.
4. **Optimise** — tree shaking, scope hoisting, constant folding, minification.
5. **Split into chunks** — one per entry point, one per `import()`, plus shared chunks.
6. **Emit** — hashed filenames, source maps, and an asset manifest.

**Steps 1 and 4 are where the surprises live**, and they are the rest of this topic.

## Resolution: the `exports` map decides what you get

```json
{
  "name": "thing",
  "type": "module",
  "exports": {
    ".": { "types": "./dist/index.d.ts", "import": "./dist/index.js", "require": "./dist/index.cjs" },
    "./util": "./dist/util.js"
  }
}
```

The `exports` field does two jobs at once, and both cause real errors:

**It maps conditions to files.** `import` versus `require`, and often `browser` versus `node` —
which is how one package ships an ESM build and a CommonJS build. The **order of keys matters**,
because the first matching condition wins, and `types` must come first when present.

🔴 **It also *encapsulates* the package.** Once `exports` exists, **only the listed subpaths are
importable** — a deep import into `thing/dist/internal.js` fails even though the file is right
there. That is the point: the package's public surface is now declared, and the maintainer can
move everything else.

**`"type": "module"`** decides how `.js` files in that package are interpreted. `.mjs` and `.cjs`
are always explicit and are the reliable escape when a package must ship both
(**15 · CommonJS in a modern world** *(not written yet)*).

⚠️ **A dual-published package can be loaded twice** — once through `import`, once through
`require` — giving you two copies with separate module state. That is where "`instanceof` is
false for my own class" comes from
([08 · Cause chains and boundaries](../08-custom-error-classes/02-cause-chains-and-boundaries.md)),
and it is worth checking when a singleton misbehaves.

## Chunks: what ends up where

- **One chunk per entry point**, and one per `import()` call the bundler can resolve statically.
- **Shared code** used by several chunks is usually hoisted into a common chunk rather than
  duplicated.
- **Filenames are content-hashed**, so a chunk can be cached forever and a change produces a new
  name — which is also why a stale page's chunk request 404s after a deploy
  ([05 · Code splitting](../05-dynamic-import/02-code-splitting.md)).

🔴 **A chunk graph that is too fine is as bad as no splitting at all.** Every chunk is a request
and a dependency edge; splitting a route into twelve tiny chunks reintroduces the waterfall that
bundling was meant to remove. `modulepreload` hints and merging small chunks are the two knobs.

## Source maps are part of the build, not an afterthought

A production stack trace is unreadable without them
([10 · Shipping errors to a reporter](../10-global-error-handling/02-shipping-to-a-reporter.md)).
Three decisions, and the middle one is the one that gets skipped:

| Decision | The usual right answer |
|---|---|
| Generate them? | ✅ always, for production builds |
| Serve them publicly? | ❌ upload them to the error reporter instead |
| Key them to what? | the **release id**, so an old stack resolves against the right build |

## What the build injects

```js
if (process.env.NODE_ENV !== 'production') { … }   // replaced with a literal, then removed
```

**Environment replacement is a text substitution done at build time**, which is why the branch
disappears entirely afterwards — the condition becomes `if ('development' !== 'production')`, the
minifier folds it, and the code inside is dropped. This is how development-only warnings cost
nothing in production.

⚠️ **Anything injected at build time is public.** A value substituted into the bundle is in the
bundle, readable by anyone; only server-side configuration is secret, and a key prefixed for
client exposure is a key you have decided to publish.

## Gotchas

**Symptom: a bare specifier fails without a bundler.**
Cause — `'react'` is a Node resolution convention; browsers need a URL or an import map.
Fix — bundle it, or declare it in an import map.

**Symptom: it works in the dev server and breaks in the build.**
Cause — the two paths are different code; the dev server serves modules, the build bundles them.
Fix — reproduce against a production build; suspect anything the bundler must analyse statically.

**Symptom: a deep import into a dependency stopped resolving.**
Cause — the package added an `exports` map, which encapsulates everything unlisted.
Fix — use a listed subpath, or ask the maintainer to export it.

**Symptom: two copies of the same library, and `instanceof` fails between them.**
Cause — a dual-published package loaded through both `import` and `require`.
Fix — force one condition, deduplicate the dependency, and branch on `code` rather than class.

**Symptom: `types` resolution breaks after an `exports` edit.**
Cause — condition order; the first match wins and `types` must come first.
Fix — reorder the keys.

**Symptom: splitting made the page slower.**
Cause — too many small chunks, so the request waterfall returned.
Fix — merge small chunks; add `modulepreload` for the ones you know are coming.

**Symptom: a secret appeared in the client bundle.**
Cause — build-time injection puts the value in the output.
Fix — keep secrets server-side; treat every injected value as published.

## Interview questions

**★ Why bundle when browsers support modules?**
Fewer requests than a deep graph, dead-code removal, rewriting bare specifiers a browser cannot
resolve, and handling everything that is not JavaScript. Not because modules do not work.

**★ Why does something work in dev and fail in the build?**
Development usually serves native modules with on-demand transforms; production runs a real
bundler. Different code paths — and anything the bundler must analyse statically, such as a
dynamic specifier, fails only in the build.

**★ What does the `exports` field do?**
Maps conditions (`import`, `require`, `browser`, `types`) to files — first match wins — and
**encapsulates** the package, so unlisted subpaths become unimportable.

**★ How do you end up with two copies of a library?**
Dual publishing plus mixed resolution: one consumer `import`s the ESM build, another `require`s
the CJS build. They have separate module state, so singletons and `instanceof` break.

**★ Where should source maps live?**
Generated for production, uploaded to the error reporter keyed to the release id, and not served
publicly.

**★ Is a value injected at build time secret?**
No. It is in the bundle and readable. Only server-side configuration is secret.

**Can splitting make things slower?**
Yes — too many small chunks rebuild the request waterfall. Merge them, and preload the ones you
know are needed.

---

← [Topic index](./README.md) · Next → [02 · Tree shaking, and what defeats it](./02-tree-shaking.md)
