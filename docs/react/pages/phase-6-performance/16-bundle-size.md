---
title: "Bundle size"
sidebar_label: "16 · Bundle size"
sidebar_position: 16
---

<span className="db-tier t-know">Know</span>

> Verified: 2026-08-14 against **react 19.2.8**.
> ⚠️ **react.dev documents almost nothing about bundling** — it is bundler and
> framework territory. The React-specific facts here are cited
> ([`lazy`](https://react.dev/reference/react/lazy), and the **measured** dev-vs-prod
> bundle figures on
> [Phase 0 · 07](../phase-0-how-react-runs/07-strictmode.md)); the rest is reasoning
> about how bundlers work, marked as such.
> No sandbox script backs this page.

**What actually reaches the browser, and the two failures that put far more there
than anyone intended.**

## The one React-specific fact that matters

Phase 0 measured it, and it is the largest single bundle mistake available:

| Build | Size |
|---|---|
| development | **1,125,752 bytes** |
| production | **194,799 bytes** |

Nearly **6×**. And the selector is not a different import:

> **What selects the build is `process.env.NODE_ENV`.** It is not a separate file
> you import; it is a dead-code branch inside `react-dom` that a minifier removes
> when the value is `'production'`.

Every bundler sets this for you in a production build — and misconfiguring it is how
apps ship the development build to users, complete with warning strings, component
stacks and the double-invoke machinery.

The check is one command:

```console
$ grep -c "Warning: " dist/assets/index-*.js
0
```

A production bundle contains no React warning strings. **Non-zero means you shipped
the development build**, and it costs almost a megabyte before any of your own code.

Verify this before optimising anything else — it dwarfs every other item on this
page.

## Reading a bundle analysis

Every bundler has a visualiser (`rollup-plugin-visualizer`, `webpack-bundle-analyzer`,
`vite-bundle-visualizer`, `source-map-explorer`). What to look for, in order:

1. **The largest single dependency.** Usually one library nobody remembers adding —
   a date library, a full icon set, a charting package, a markdown renderer.
2. **Anything appearing twice.** Two versions of the same package, or the same code
   in two chunks. Usually a peer-dependency mismatch or a mixed ESM/CJS resolution —
   the same class of problem that produces
   [duplicate context modules](../phase-5-refs-context-reducers/04-createcontext-usecontext.md).
3. **Whether the initial chunk contains code for screens the user has not visited.**
   That is [topic 12](12-lazy-loading.md).
4. **Locale and icon data**, which are famously large and famously unnoticed.

Compare **gzip or brotli** sizes, not raw. Raw size overstates repetitive code
dramatically, and users download the compressed bytes.

## Tree-shaking, and why it fails

Tree-shaking removes exports nothing imports. It needs static ESM imports it can
analyse, and it fails quietly rather than loudly. The common causes:

**Namespace imports.** `import * as X` asks for everything, and many bundlers cannot
narrow it.

**CommonJS.** `require` is dynamic, so a CJS dependency generally cannot be shaken.
A single CJS library can anchor a large amount of code.

**Side effects.** If a package is not marked `"sideEffects": false`, the bundler must
assume importing a module does something observable and keeps it. A package with an
inaccurate `sideEffects` field is a common cause of a large bundle with no obvious
culprit.

**Barrel files.** `index.ts` re-exporting everything means importing one helper
pulls in the barrel's whole graph. Usually shakeable in theory; frequently not in
practice, especially with CJS or side effects anywhere in the chain.

**The tell is the same in all four cases:** you imported one function and the
analyser shows the whole library.

## 🔴 One heavy import in a leaf component

The failure worth the emphasis, because it is invisible in review:

```jsx
// in a rarely-opened settings panel
import { Chart } from 'heavy-charting-library';
```

A static import means that library is in the bundle for **every** user, on **every**
page load, whether or not they ever open that panel. The component is lazy in the
sense that it rarely renders — but the *code* is not lazy at all.

Nothing about the diff looks expensive. One import line in one leaf file.

The fix is [topic 12](12-lazy-loading.md): make the *component* lazy so the import
becomes a separate chunk. This is the single highest-value application of code
splitting after route-level splitting, and the bundle analyser is how you find the
candidates.

## What React itself costs

React and React DOM are a fixed floor you cannot split away — they are needed to
render anything. Phase 0's measurement puts the production pair at roughly 195 KB
raw, and Phase 0 · 14 compares that against alternatives. It is worth knowing as a
baseline so you can tell "React is big" from "our dependencies are big", which are
different problems with different answers.

## Gotchas

**Symptom:** the production bundle is over a megabyte before application code.
**Cause:** the development build shipped, because `NODE_ENV` was not `'production'`.
**Fix:** `grep -c "Warning: "` the output. Non-zero means the dev build. Fix the
build config before anything else.

**Symptom:** one function was imported and the whole library is in the bundle.
**Cause:** a namespace import, a CJS package, a missing or wrong `sideEffects` field,
or a barrel file.
**Fix:** named imports from the specific module, and check the package's format and
`sideEffects` declaration.

**Symptom:** a package appears twice in the analysis.
**Cause:** two versions resolved, or mixed module formats.
**Fix:** deduplicate. The same root cause breaks React context across module copies.

**Symptom:** a rarely-used screen's dependency is in the initial chunk.
**Cause:** a static import in a leaf component.
**Fix:** `lazy` that component so the import becomes its own chunk.

**Symptom:** the bundle looks fine and the app still loads slowly.
**Cause:** size is not the only mount cost — parse, execute and hydrate all matter.
**Fix:** [topic 15](15-expensive-initial-mount.md).

**Symptom:** raw sizes were compared and the win did not materialise.
**Cause:** users download compressed bytes; raw size overstates repetitive code.
**Fix:** compare gzip or brotli.

## Interview questions

**★ What is the single largest bundle mistake in a React app?**
Shipping the development build, which is roughly six times larger — Phase 0 measured
1,125,752 bytes against 194,799. It is selected by `process.env.NODE_ENV`, a
dead-code branch inside `react-dom` that a minifier strips when the value is
`'production'`, not a separate import. The check is grepping the output for React
warning strings: a production bundle contains none.

**★ Why does tree-shaking fail?**
It needs static ESM imports it can analyse, and it fails silently. Namespace imports
ask for everything; CommonJS is dynamic and generally cannot be shaken; a package
without an accurate `"sideEffects": false` forces the bundler to assume importing a
module does something observable; and barrel files pull in a whole graph for one
helper. In all four cases the symptom is identical — you imported one function and
the analyser shows the entire library.

**★ How does one import in a leaf component become a problem?**
A static import puts that dependency in the bundle for every user on every page
load, regardless of whether the component ever renders. A charting or editor library
in a rarely-opened panel is the classic case, and the diff is one import line in one
file, so nothing about it looks expensive in review. Making the component `lazy`
turns the import into a separate chunk.

**What do you look at first in a bundle analysis?**
The largest single dependency, then anything appearing twice — duplicate versions or
mixed module formats — then whether the initial chunk contains code for screens the
user has not visited, then locale and icon data. And compare gzip or brotli sizes
rather than raw, since that is what users actually download.

**Is React itself the problem when a bundle is large?**
Almost never. React and React DOM are a fixed floor of roughly 195 KB raw in
production that cannot be split away, since they are needed to render anything.
Knowing that baseline is what lets you distinguish "React is big" from "our
dependencies are big" — and it is nearly always the second.

---

← Prev: [Expensive initial mount](15-expensive-initial-mount.md) · Index: [Phase 6](README.md) · Next → [`useDeferredValue` for a laggy list](17-usedeferredvalue.md)
