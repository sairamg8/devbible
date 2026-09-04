---
title: "There are two bundle analyzers in Next.js 16 and the documentation names them by bundler — the first-party one reads Turbopack's module graph and traces import chains, and the classic plugin's own heading now says \"for Webpack\""
sidebar_label: "03b · The two analyzers"
sidebar_position: 12
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-09-04 against the Next.js [package bundling guide](https://nextjs.org/docs/app/guides/package-bundling)
> (docs build `version: 16.3.4`, `lastUpdated: 2026-06-01`) and the Next.js
> [version 16 upgrade guide](https://nextjs.org/docs/app/guides/upgrading/version-16)
> (`version: 16.3.4`, `lastUpdated: 2026-08-25`).
> Documentation-verified; **no sandbox run — no analyzer was executed and no byte counts appear here**.
> Target: **Next.js 16.3.4 · `next experimental-analyze` available in 16.1+ · Turbopack default since 16.0**.

**The single most useful feature in the first-party analyzer is not the treemap — it is the import chain, and
it is the one people skip.** A treemap tells you *that* a dependency is large. The import chain tells you *why
it is in the graph at all*: which component, in which route, through which barrel file, on which side of the
client boundary. One produces guesses; the other produces a diff. This page covers `next experimental-analyze`,
its filters and its tracing, and `@next/bundle-analyzer` — whose entry in the same guide is headed *"for
Webpack"*, which since 16.0 means the path you have to opt into. Why you need an analyzer at all, and the CI
gate that broke when the build output changed, is [03](03-bundle-analysis-dynamic-imports-lazy-loading.md).

## `next experimental-analyze` — the first-party analyzer

> *"Available in v16.1 and later."*
> *"The Next.js Bundle Analyzer is integrated with Turbopack's module graph. You can inspect server and client
> modules with precise import tracing, making it easier to find large dependencies."*

```bash
npx next experimental-analyze
```

What the interactive UI gives you, verbatim:

> *"Within the UI, you can filter by route, environment (client or server), and type (JavaScript, CSS, JSON),
> or search by file"*
> *"The treemap shows each module as a rectangle. Where the size of the module is represented by the area of
> the rectangle."*
> *"Click a module to see its size, inspect its full import chain and see exactly where it's used in your
> application"*

🔴 **The import chain is the feature that matters and the one people skip.** A treemap tells you *that* a date
library dominates a rectangle in your client bundle. The import chain tells you *why it is there at all* —
which component, in which route, through which barrel file. Optimising from a treemap alone produces guesses;
optimising from an import chain produces a diff. It is also the only practical way to find the classic RSC
mistake, a utility module that imports one client-only helper and thereby drags an entire library across the
boundary.

Because it reads **Turbopack's** module graph, it also sees the two environments separately — server and client
are filters in the same UI rather than two different tools. That distinction is what the removed build-output
metrics were bad at: *"disagreed on how to account for Client Components payload."*

### Reading it in an order that produces a decision

The UI offers four filters and a search box, and used in an arbitrary order they produce an afternoon of
browsing. Used in this order they produce a pull request:

1. **Filter environment to `client`.** Server-side weight matters for cold starts, but client weight is what a
   user downloads, and it is where the architectural mistakes show. Do the client pass first, always.
2. **Filter to one route.** A whole-app treemap flattens the thing you care about — that *this* route pays for
   something *that* route needed. Per-route is the unit a user experiences.
3. **Sort by area and take the largest rectangle you did not expect.** Not the largest overall; a charting
   library on the chart route is not news. The signal is the module that has no business being there.
4. **Click it and read the full import chain.** This is the step that names the fix. The chain terminates at
   one of a small number of shapes, and each shape has a different remedy — all of them on
   [03c](03c-fixing-what-the-analyzer-finds.md):

| What the chain shows | The fix it implies |
|---|---|
| A barrel file (`index.ts` re-exporting hundreds of modules) between your component and the dependency | `optimizePackageImports` |
| A `'use client'` component importing a library that only turns data into markup | Move the work to a Server Component |
| A large dependency reachable only from one rarely-opened panel or modal | `next/dynamic` |
| A Node-oriented package in the **server** graph that Next.js bundled | `serverExternalPackages` |

5. **Re-run and compare.** `--output` plus the documented `cp` of `.next/diagnostics/analyze` is what turns
   "this feels lighter" into a reviewable before/after ([03](03-bundle-analysis-dynamic-imports-lazy-loading.md)).

⚠️ **Type filters are a debugging aid, not a size story.** Filtering to `CSS` or `JSON` is how you find a
committed fixture or a locale file that got imported into the client graph — a real and common surprise — but
the JavaScript filter is where the download cost lives.

## `@next/bundle-analyzer` — now explicitly the webpack path

🔴 **The heading in the Next.js guide is literally *"`@next/bundle-analyzer` for Webpack"*.** Since Turbopack
became the default bundler in 16.0, the recipe every blog post still shows describes the **non-default**
toolchain.

```js
// next.config.js
const withBundleAnalyzer = require('@next/bundle-analyzer')({
  enabled: process.env.ANALYZE === 'true',
})

module.exports = withBundleAnalyzer(nextConfig)
```

> *"The report will open three new tabs in your browser, which you can inspect."*

It is still the right tool in exactly one situation: you are building with `--webpack`, either because you are
on a platform without Turbopack native bindings, or because you depend on a webpack plugin with no Turbopack
equivalent. Both cases are covered in
[01e · What Turbopack does not support](01e-what-turbopack-does-not-support-and-how-to-read-the-list.md).

| | `next experimental-analyze` | `@next/bundle-analyzer` |
|---|---|---|
| Bundler | Turbopack (the default since 16.0) | webpack |
| Availability | 16.1+ | plugin, any version |
| Wiring | none — a CLI subcommand | wraps `next.config.js` |
| Trigger | `npx next experimental-analyze` | `ANALYZE=true next build` |
| Output | interactive UI, or `.next/diagnostics/analyze` with `--output` | three browser tabs |
| Import-chain tracing | documented | not claimed by this guide |
## Gotchas

**★ Symptom: `next experimental-analyze` is not recognised as a command.** Cause: it landed in **16.1** —
*"Available in v16.1 and later."* Anything earlier does not have it. Fix: check the installed version before
assuming the CLI is broken, and fall back to `@next/bundle-analyzer` with `--webpack` builds until you can
upgrade.

```bash
npx next --version
```

**★ Symptom: `ANALYZE=true next build` produces nothing on Next.js 16.** Cause: `@next/bundle-analyzer` is a
webpack plugin, and 16 builds with Turbopack by default; the guide's own heading for it is *"for Webpack"*.
Fix: use the first-party command, or force the webpack path if you genuinely need that tool.

```bash
npx next experimental-analyze          # Turbopack, the default
ANALYZE=true npx next build --webpack  # only if you must stay on webpack
```

**★ Symptom: the treemap shows a huge dependency and nobody can work out which page pulls it in.** Cause: you
are reading area and ignoring provenance. Fix: click the module and read the import chain — *"inspect its full
import chain and see exactly where it's used in your application"* — then filter by route and environment to
confirm which side of the client boundary the cost lands on. That chain is the diff you are going to write.

**Symptom: server and client bundle sizes seem to be double-counting the same module.** Cause: a module
imported from both environments genuinely exists in both graphs; that is not an artifact of the tool. It is
also precisely what the removed build metrics got wrong — the two bundlers *"disagreed on how to account for
Client Components payload."* Fix: use the environment filter and reason about each graph separately rather than
looking for one total number; there isn't a meaningful single figure.

**Symptom: `next experimental-analyze` output does not reflect a change you just made.** Cause: the guide shows
the command standalone and does not state whether it performs its own build or reads the artifacts of a
previous one — so an ordering assumption is an assumption. Fix: remove the question by always building
immediately before analysing in CI, which costs nothing you were not already paying.

```bash
npx next build && npx next experimental-analyze --output
```

**Symptom: the analyzer's picture disagrees with what production actually ships.** Cause: you analysed a
different bundler than you deploy — `@next/bundle-analyzer` reports the webpack graph while your pipeline
builds with Turbopack, or the reverse. The two produce different module graphs; that difference is exactly what
made the old build metrics unreliable. Fix: analyse the bundler you ship, and if your CI uses `--webpack` while
your laptop does not, make that explicit in the analysis step.

```bash
# Deploying with the default (Turbopack):
npx next experimental-analyze --output

# Deploying with --webpack: analyse that graph instead.
ANALYZE=true npx next build --webpack
```

**Symptom: a package you only import from a Server Component shows up in the client graph.** Cause: something
on the client side reaches it — a shared `lib/` module imported from both environments, a `'use client'` file
re-exporting a type-and-value module, or a barrel that pulls the whole package in for one helper. Fix: read the
import chain to the first `'use client'` boundary in it; that file is the one to split, not the dependency.

```ts
// lib/format.ts — imported from BOTH sides, so everything it imports crosses too.
export { renderMarkdownToHtml } from 'heavy-markdown-lib' // ← drags the library client-side
export function formatCurrency(n: number) { return n.toFixed(2) }
```

```ts
// Split it: lib/format.ts keeps the shared pure helper,
// lib/markdown.server.ts keeps the heavy import and is only imported by Server Components.
export function formatCurrency(n: number) { return n.toFixed(2) }
```

## Interview questions

**★ What does `next experimental-analyze` give you that a treemap alone does not?**
Import-chain tracing, and it is the difference between knowing and guessing. The treemap shows area — which
modules are large. The import chain shows *why each one is in the graph*: which component imported it, through
which intermediate module, in which route. Combined with the route and environment filters, that tells you
whether a dependency is on the client because it has to be or because a barrel file dragged it across the
boundary. It is built on Turbopack's own module graph, which is also why it can show server and client
separately instead of producing one blended number.

**★ Is `@next/bundle-analyzer` deprecated?**
The documentation does not say deprecated; it says *"for Webpack"*, which is a sharper statement than it looks.
Turbopack has been the default bundler since 16.0, so a webpack-only analyzer now describes a path you have to
opt into with `--webpack`. It remains correct if you are genuinely on webpack — a platform with no Turbopack
native bindings, or a build depending on a webpack plugin that has no Turbopack equivalent. For everyone else
it analyses a bundler they are not shipping, which is worse than no analysis because the numbers look real.

**When is bundle analysis the wrong investigation entirely?**
When the complaint is about time-to-first-byte or a slow interaction rather than load weight. A route waiting
on a slow database query is not a bundle problem, and neither is a component re-rendering a thousand rows on
every keystroke — that one is [02](02-react-compiler-retiring-manual-usememo-usecallback.md). Analysis answers
"what is being downloaded and why is it in the graph". Reach for it when first load is slow, when a dependency
upgrade changed weight, or when you suspect something crossed the client boundary that should not have.

**★ Walk me through how you would actually use the analyzer on a route that loads slowly.**
Filter the environment to `client` first, because that is what the user downloads, then filter to the single
route in question — a whole-app view hides the fact that one route is paying for another's dependency. Sort by
area and find the largest rectangle you did not expect; a chart library on the chart route is not a finding.
Click it and read the full import chain, because the chain names the fix: a barrel file in the middle points at
`optimizePackageImports`, a render-only library behind `'use client'` points at moving the work to a Server
Component, something reachable only from a modal points at `next/dynamic`. Then snapshot with `--output`, make
the change, re-run, and compare the two directories so the PR carries evidence rather than a claim.

**What does the `experimental-` prefix in the command name change about how you depend on it?**
It means the CLI surface can move, so anything you build on it should be one line long and easy to fix. In
practice: use it interactively without hesitation, use `--output` in CI to produce an archived artifact for
humans, and do not write a parser against the contents of `.next/diagnostics/analyze` — the guide describes
that directory as something you save, share and copy, and publishes no schema for it. The rule of thumb is that
an experimental tool can be a diagnostic in your pipeline but should not be a gate in it.

---

← [03 · Bundle analysis](03-bundle-analysis-dynamic-imports-lazy-loading.md) · [Chapter index](01-explanation.md) · Next → [03c · Fixing what the analyzer finds](03c-fixing-what-the-analyzer-finds.md)
