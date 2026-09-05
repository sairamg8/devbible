---
title: "The SprintDesk performance audit is three pieces of work in a fixed order — produce a bundle map and keep the artefact, fix the interaction latency on the board, then instrument what you changed — and the discipline that makes it an audit rather than a refactor is that every step has an acceptance criterion you can check without a stopwatch"
sidebar_label: "07 · Milestone: performance audit"
sidebar_position: 25
description: "Chapter 11's capstone, act one: running next experimental-analyze --output, keeping .next/diagnostics/analyze as a diffable artefact, reading the treemap on the SprintDesk board, and the three findings a board application reliably produces — with the fix for each and criteria that do not require a number."
---

<span className="db-tier t-know">Know</span>

> Verified: 2026-09-04 against [Package bundling and optimization](https://nextjs.org/docs/app/guides/package-bundling) (`version: 16.3.4`, `lastUpdated: 2026-06-01`) and [Lazy loading](https://nextjs.org/docs/app/guides/lazy-loading) (`2026-03-10`).
> Target: **Next.js 16.3.4** · `next experimental-analyze` available in **v16.1 and later**. Documentation-verified, **no sandbox run** — 🔴 **no bundle sizes, before/after timings or tool output appear on this page.** Every criterion below is something *you* observe in your own artefact.

**An audit is not "make it faster". An audit is a sequence of changes, each of which you can point at afterwards and say what it did. The three acts of this milestone are chosen because each produces a durable artefact: a bundle map you keep on disk and diff, a field metric you collect for one named interaction, and a trace whose spans outlive the person who added them. The order is not negotiable either — the bundle map comes first because it is the only step that tells you what is *in* the client at all, and both of the later steps are cheaper once the client is smaller. This page is act one. Interaction latency on the board is [07b](07b-the-inp-problem-on-the-board.md); tracing and the audit report are [07c](07c-instrumenting-what-you-changed.md).**

## SprintDesk, as a thing being audited

The running project is a multi-tenant task dashboard. The properties that decide where its performance problems live:

- **The dashboard shell is prerendered and the board streams in.** Cache Components is on, so Partial Prerendering is the default; client navigation keeps the previous route in the DOM via `<Activity>`.
- **The board is the interactive surface.** Columns of cards, drag-and-drop that mutates optimistically and reconciles against a Server Action, and a scoped store holding board UI state.
- **Filters live in the URL**, so filtering is a navigation, not a client-side array operation.
- **Card detail renders user-authored markdown**, including fenced code blocks in bug reports.
- **Data is Drizzle on Neon**, team-scoped by a predicate in the data layer.

Three of those five are bundle problems waiting to happen, and one is an interaction-latency problem by construction. That is the audit.

## Scope

| In scope | Out of scope, and where it lands |
|---|---|
| A kept, diffable bundle map | — |
| Moving client-only rendering work to the server | — |
| One named INP regression on the board, measured in the field | [07b](07b-the-inp-problem-on-the-board.md) |
| Tracing the routes you changed, and the span budget | [07c](07c-instrumenting-what-you-changed.md) |
| How Turbopack builds any of this | [01 · Turbopack in dev and production](01-turbopack-in-dev-and-production-fast-refresh.md) |
| Whether React Compiler should be on | [02 · React Compiler](02-react-compiler-retiring-manual-usememo-usecallback.md) |
| The mechanics of `next/dynamic` and `optimizePackageImports` | [03 · Bundle analysis and lazy loading](03-bundle-analysis-dynamic-imports-lazy-loading.md) |
| Which vitals to collect and how to report them | [05 · Core Web Vitals](05-core-web-vitals-tuning-lcp-inp-cls-auditing-workflows.md) |
| What instrumentation itself costs | [06 · What instrumentation costs](06-instrumentationts-for-opentelemetry-and-application-monitori.md) |
| Deploying, self-hosting, and where the collector runs | [ch17 · deployment and observability](../17-deployment-scaling-and-observability/01-explanation.md) |

## The rule that makes it an audit

**One change per commit, and re-generate the artefact after each one.**

The reason is not process hygiene. It is that bundle changes interact: moving a highlighter to the server can also remove a transitive dependency that another component was relying on being present, and code-splitting one widget can move a shared chunk boundary so that an unrelated route gets larger. If you make four changes and then look, you know the total and nothing else. If you make one change and diff, you know that change.

## Act 1 — produce a bundle map you can keep

> *"Bundling is the process of combining your application code and its dependencies into optimized output files for the client and server. Smaller bundles load faster, reduce JavaScript execution time, improve Core Web Vitals, and lower server cold start times."*

Since 16.0 Turbopack is the default bundler, and the analyzer that understands it is first-party:

> *"The Next.js Bundle Analyzer is integrated with Turbopack's module graph. You can inspect server and client modules with precise import tracing, making it easier to find large dependencies."*

```bash
npx next experimental-analyze
```

That opens the interactive view. The audit wants the other form:

```bash
npx next experimental-analyze --output
```

> *"If you want to share the analysis with teammates or compare bundle sizes before/after optimizations, you can skip the interactive view and save the analysis as a static file with the `--output` flag"*

> *"This command writes the output to `.next/diagnostics/analyze`. You can copy this directory elsewhere to compare results"*

🔴 **`.next` is disposable.** The next build wipes it. Copy the directory out immediately, name it after the state it captures, and commit the name to your notes if not the bytes:

```bash
npx next experimental-analyze --output
cp -r .next/diagnostics/analyze ./audit/00-baseline
```

Then, after each change:

```bash
npx next experimental-analyze --output
cp -r .next/diagnostics/analyze ./audit/01-markdown-to-server
```

You now have a sequence of maps rather than an opinion about a trend. That is the artefact the milestone is judged on.

### Reading the map

> *"The treemap shows each module as a rectangle. Where the size of the module is represented by the area of the rectangle."*

> *"Within the UI, you can filter by route, environment (client or server), and type (JavaScript, CSS, JSON), or search by file"*

> *"Click a module to see its size, inspect its full import chain and see exactly where it's used in your application"*

The import chain is the feature that turns the map into a task list. A large rectangle tells you *what*; the chain tells you *why it is there*, which is almost always a single `import` in a single file that someone added in a hurry. Work in this order:

1. **Set the environment filter to `client`.** Server modules are a different problem with a different fix, and mixing them is how people spend an afternoon optimising something that was never shipped to a browser.
2. **Sort by area and look at the top five rectangles only.** The long tail is not where the win is.
3. **For each, open the import chain and write down the file that pulls it in.** Not the package — the file.
4. **Classify each into one of the three findings below.** If it does not fit, it is a fourth finding and it is interesting; write it up.

## Finding 1 — a rendering library shipped to the client to produce static output

This is the one the SprintDesk card detail produces, and the documentation describes the exact shape:

> *"A common cause of large client bundles is doing expensive rendering work in Client Components. This often happens with libraries that exist only to transform data into UI, such as syntax highlighting, chart rendering, or markdown parsing."*

> *"Even though the final output is just a `<code>` block, the entire highlighting library is bundled into the client JavaScript bundle"*

> *"This increases bundle size because the client must download and execute the highlighting library, even though the result is static HTML."*

The card description in SprintDesk is exactly this: user-authored markdown, rendered once, never interactive.

```tsx
// app/(board)/cards/[cardId]/description.tsx — 🔴 before
'use client'

import { Highlight, themes } from 'prism-react-renderer'

export function CardDescription({ code }: { code: string }) {
  return (
    <Highlight code={code} language="tsx" theme={themes.github}>
      {({ className, style, tokens, getLineProps, getTokenProps }) => (
        <pre className={className} style={style}>
          {tokens.map((line, i) => (
            <div key={i} {...getLineProps({ line })}>
              {line.map((token, key) => (
                <span key={key} {...getTokenProps({ token })} />
              ))}
            </div>
          ))}
        </pre>
      )}
    </Highlight>
  )
}
```

The documented test is a question, not a measurement: *"If that work does not require browser APIs or user interaction, it can be run in a Server Component."* A rendered description requires neither.

```tsx
// app/(board)/cards/[cardId]/description.tsx — ✅ after
// The Shiki package runs on the server and is never bundled for the client.
import { codeToHtml } from 'shiki'

export async function CardDescription({ code }: { code: string }) {
  const html = await codeToHtml(code, { lang: 'tsx', theme: 'github-light' })
  return <div dangerouslySetInnerHTML={{ __html: html }} />
}
```

> *"Instead, move the highlighting logic to a Server Component and render the final HTML on the server. The client will only receive the rendered markup."*

**Acceptance criterion.** Re-run the analyzer with the environment filter on `client` and search for the highlighter package by name. *It is not there.* That is the check — not a kilobyte figure, a presence check, and it is binary.

⚠️ `dangerouslySetInnerHTML` is doing what its name says. The input is user-authored, so the sanitisation question is real and it belongs to the security chapter, not to this one. The performance point stands either way: sanitise on the server too, and the client still receives markup rather than a parser.

## Finding 2 — a barrel import from an icon or utility package

SprintDesk's board renders an icon per card — priority, assignee, blocked state. Written the obvious way, that is a named import from a package that exports hundreds of modules.

> *"If you're using a package that exports hundreds of modules (such as icon and utility libraries), you can optimize how those imports are resolved using the `optimizePackageImports` option … This option will only load the modules you actually use, while still giving you the convenience of writing import statements with many named exports."*

```js
// next.config.js
const nextConfig = {
  experimental: { optimizePackageImports: ['icon-library'] },
}
```

Two things before you add anything to that list. First: *"Next.js also optimizes some libraries automatically, thus they do not need to be included in the `optimizePackageImports` list."* Check whether yours already is, or you will "fix" something twice and attribute a win to the wrong change. Second: this is the fix for a **wide** dependency — many small modules behind one entry point — and it is not the fix for a **heavy** one. A charting library is not a barrel problem; it is a boundary problem, and Finding 1 or Finding 3 applies instead.

**Acceptance criterion.** In the new map, the icon package's rectangle is a small number of modules whose names match the icons the board actually uses — not the package's entire export surface. The import chain still points at your board component, which is how you know the ergonomic import survived.

## Finding 3 — a genuinely client-only widget loaded eagerly

Some weight belongs on the client and simply does not belong in the *initial* payload. In SprintDesk that is the burndown chart on the sprint summary panel: interactive, canvas-based, and behind a tab most users never open.

> *"Lazy loading in Next.js helps improve the initial loading performance of an application by decreasing the amount of JavaScript needed to render a route."*

> *"By default, Server Components are automatically code split, and you can use streaming to progressively send pieces of UI from the server to the client. **Lazy loading applies to Client Components.**"*

```tsx
// app/(board)/sprint/summary-panel.tsx
'use client'

import dynamic from 'next/dynamic'
import { useState } from 'react'

const BurndownChart = dynamic(() => import('./burndown-chart'), {
  loading: () => <p>Loading chart…</p>,
  ssr: false,
})

export function SummaryPanel() {
  const [tab, setTab] = useState<'list' | 'chart'>('list')
  return (
    <>
      <button onClick={() => setTab('chart')}>Burndown</button>
      {tab === 'chart' ? <BurndownChart /> : <SprintList />}
    </>
  )
}
```

🔴 **Three documented traps live in that snippet**, and all three are why the file above is a Client Component rather than the server one that renders it:

> *"`ssr: false` option is not supported in Server Components. You will see an error if you try to use it in Server Components."*

> *"`ssr: false` option will only work for Client Components, move it into Client Components ensure the client code-splitting working properly."*

> *"When a Server Component dynamically imports a Client Component, automatic code splitting is currently **not** supported."*

That third one is the quiet one. Putting the `dynamic()` call in the server component that renders the panel does not error — it simply does not split, and your map will show the chart in the initial chunk while your code says it is lazy. The map is what catches it.

**Acceptance criterion.** The chart's modules appear in the map as a chunk attributed to `burndown-chart`, not inside the route's initial client chunk. And a manual check the map cannot make: loading the board with the network throttled shows the fallback text before the chart, which proves the split is real at runtime and not only in the graph.

## 🔴 The CI trap: your size gate may already be passing vacuously

Next.js 16.0 removed `size` and `First Load JS` from the `next build` output, on the grounds that the numbers were inaccurate in server-driven architectures. Any CI step that greps build output for a size budget therefore now finds nothing — and a grep that finds nothing usually reports success.

Check your pipeline before you trust it. If a size gate exists, it must be rebuilt on the analyzer artefact, which is a directory you can diff, rather than on a log line that no longer exists.

```bash
# In CI: produce the artefact and keep it, rather than parsing build output.
npx next experimental-analyze --output
cp -r .next/diagnostics/analyze "./artifacts/analyze-$GITHUB_SHA"
```

Comparing two of those directories is a real gate. Parsing `next build` output is a gate that was disabled by an upgrade and told nobody.

## Act 1 acceptance checklist

- [ ] `./audit/00-baseline` exists and was produced before any change.
- [ ] Each subsequent change has its own dated artefact directory, one per commit.
- [ ] With the environment filter on `client`, the highlighting/markdown library does not appear.
- [ ] The icon package appears as the icons in use, not as its full export surface.
- [ ] The chart appears as its own chunk, and throttled loading shows the fallback.
- [ ] Any CI size gate reads the artefact, not `next build` output.
- [ ] For every change, you can name the file whose import chain caused the module to be there.

## Gotchas

**★ Symptom: the analysis directory is gone and you cannot compare anything.** Cause: `--output` writes to `.next/diagnostics/analyze` and `.next` is rebuilt. Fix: copy it out in the same command that produces it, every time — `cp -r .next/diagnostics/analyze ./audit/NN-name`. The docs say the directory can be copied elsewhere to compare results; nothing copies it for you.

**★ Symptom: you optimised a module that was never in the client bundle.** Cause: the environment filter was left on the default view, so server and client modules were mixed in one treemap. Fix: filter to `client` before ranking anything. Server-side weight is a real concern — it affects cold starts — but it is fixed by `serverExternalPackages` and by not importing things, not by code splitting.

**★ Symptom: a component is wrapped in `next/dynamic` and the map still shows it in the initial chunk.** Cause: the `dynamic()` call is in a Server Component, and *"when a Server Component dynamically imports a Client Component, automatic code splitting is currently not supported"*. Fix: move the `dynamic()` call into a Client Component:

```tsx
'use client'
import dynamic from 'next/dynamic'
const BurndownChart = dynamic(() => import('./burndown-chart'), { ssr: false })
```

**★ Symptom: the build fails with an error about `ssr: false`.** Cause: `ssr: false` was used with `next/dynamic` inside a Server Component — *"`ssr: false` is not allowed with `next/dynamic` in Server Components. Please move it into a Client Component."* Fix: the same move as above. The error is at least loud; the silent version is the previous gotcha.

**★ Symptom: a CI bundle-size check has been green for months and the bundle has been growing.** Cause: 16.0 removed `size` and `First Load JS` from `next build` output, so the parser matches nothing and the gate passes. Fix: gate on the analyzer artefact instead, and assert that the parse produced a value at all rather than treating "no match" as "no regression".

**★ Symptom: `optimizePackageImports` on the icon library changed nothing.** Cause: either the package is already optimised automatically — *"Next.js also optimizes some libraries automatically"* — or the weight was never the barrel; it was one heavy module the package re-exports. Fix: check the import chain on the largest rectangle before reaching for the option. If it resolves to a single heavy module, this is Finding 1 or Finding 3, not Finding 2.

**★ Symptom: moving the highlighter to the server shrank the client bundle and slowed down the page.** Cause: the highlighting now happens during the request, on the server, inside the render path — and if the card detail is dynamic rather than cached, every request pays it. Fix: it is still the right move, but cache the rendered HTML rather than the source. Highlighting is a pure function of the source text, so it is the ideal thing to cache by content — and see [06b](06b-the-price-of-a-span-trace-volume-as-a-production-cost.md) for how to see the cost in a span rather than infer it.

**Symptom: a dynamically imported module fails at runtime with "not a function", but only in production.** Cause: the module has a named export and the dynamic import returned the module namespace object. Fix: resolve the export explicitly, which is the documented shape:

```tsx
const CardMenu = dynamic(() =>
  import('../components/card-menu').then((mod) => mod.CardMenu)
)
```

**Symptom: splitting one widget made a different route larger.** Cause: chunk boundaries are graph-wide; extracting a module can stop it being shared and duplicate its dependencies. Fix: this is exactly why the audit rule is one change per artefact. Diff the whole map, not the route you touched — and if the trade is bad, revert that one change without losing the others.

**Symptom: the treemap is dominated by a module you do not recognise and whose chain ends in `node_modules`.** Cause: a transitive dependency of something you do recognise. Fix: the chain still names the first-party file at the top; that file is where the decision was made. Changing the dependency is rarely the fix — changing which side of the boundary the first-party file lives on usually is.

## Interview questions

**★ Why does the bundle map come first in an audit, before any interaction work?**
Because it is the only step that tells you what is actually in the client, and every later measurement is contaminated by what you have not removed yet. Interaction latency on a page that ships a syntax highlighter it does not use is partly a measurement of parsing and evaluating that highlighter, so you would be tuning around a cost you were about to delete. It is also the cheapest step: reading a treemap costs nothing and the fixes are usually a boundary move rather than an algorithmic change. And it produces the artefact that makes the rest of the audit reviewable.

**★ What is the acceptance criterion for "we moved the highlighter to the server", if you are not allowed to quote a byte count?**
A presence check. Re-run the analyzer, filter the environment to `client`, search the package by name, and confirm it does not appear. That is binary, reproducible by anyone with the artefact, and it cannot be gamed by a lucky build. Byte counts are useful for tracking a trend, but as an acceptance criterion they invite arguing about noise; "the module is not in the client graph" does not.

**★ The `next build` output no longer prints `First Load JS`. What does that mean for a team with a bundle-size gate in CI?**
That the gate is almost certainly passing without checking anything. The fields were removed in 16.0 as inaccurate for server-driven architectures, so a script that greps for them matches nothing — and most such scripts treat "no match" as "nothing to complain about". The replacement is the analyzer artefact: `next experimental-analyze --output` writes a directory to `.next/diagnostics/analyze` that can be copied elsewhere and compared between builds. The second lesson is about the gate itself: assert that the extraction produced a number, so the next upstream change fails loudly instead of silently.

**★ How do you tell a "wide" dependency problem from a "heavy" one, and why does it matter?**
Open the import chain on the largest rectangle. If it resolves to many small modules behind one package entry point — an icon set, a utility library — it is wide, and `optimizePackageImports` is the fix, because it changes how those named imports are resolved so only the used modules load. If it resolves to one large module doing real work — a highlighter, a chart engine, a markdown parser — it is heavy, and no import-resolution trick helps: either the work belongs on the server, or the module belongs behind a dynamic import. Applying the wide fix to a heavy problem produces no change and a false sense of having addressed it.

**★ A colleague wraps a component in `next/dynamic` inside a Server Component and reports the bundle did not change. What happened?**
Automatic code splitting is documented as currently unsupported when a Server Component dynamically imports a Client Component. So the syntax is accepted, the code reads as lazy, and the module is still in the initial chunk. The fix is to move the `dynamic()` call into a Client Component, which is also where `ssr: false` is required to live — that variant at least errors rather than silently no-op-ing. The general lesson is that the map, not the source, is the evidence: this class of bug is invisible in code review and obvious in a treemap.

**Why insist on one change per artefact rather than making all the improvements and measuring once?**
Because bundle changes are not independent. Extracting a module can un-share it and duplicate its dependencies into two chunks; moving a component across the server boundary can remove a transitive dependency that something else was implicitly relying on; enabling an import optimisation can change which modules end up in a shared chunk. Batched, you learn only the sum, and if the sum is disappointing you have no way to find which change fought which. One change per artefact costs a few extra minutes per commit and turns the audit into a set of independently revertable facts.

**The card description is now rendered on the server. What new cost did you create, and how would you see it?**
Server render time on the card detail route, paid per request unless the result is cached. Highlighting is CPU work, it is now in the request path, and it will show up as time inside the route's render span rather than as JavaScript on the client. Because the output is a pure function of the source text, the right response is to cache by content rather than to move it back. The point worth making in an interview is that the work did not disappear — it moved to a place where it is paid once and shared, instead of being paid by every visitor's device.

---

← [06b · The price of a span](06b-the-price-of-a-span-trace-volume-as-a-production-cost.md) · [Chapter 11 overview](01-explanation.md) · Next → [07b · The INP problem on the board](07b-the-inp-problem-on-the-board.md)
