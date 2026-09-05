---
title: "A bundle number tells you nothing you can act on — the artifact that resolves a boundary regression is an import chain, and the distribution that grades it comes from real sessions, not from a Lighthouse run on your laptop"
sidebar_label: "06b · Measuring the boundary"
sidebar_position: 9
description: "The toolchain: Turbopack's experimental analyzer and the webpack plugin, import-chain tracing, useReportWebVitals in the field, optimizePackageImports and serverExternalPackages, the documentation's own prism-to-shiki example, and an ordered attribution procedure."
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-09-04 against the Next.js documentation — [Optimizing package bundling](https://nextjs.org/docs/app/guides/package-bundling) (`version: 16.3.4`, `lastUpdated` 2026-06-01) and [`useReportWebVitals`](https://nextjs.org/docs/app/api-reference/functions/use-report-web-vitals) (`version: 16.3.4`, `lastUpdated` 2026-02-27); thresholds and sub-part shares from web.dev — [LCP](https://web.dev/articles/lcp), [Optimize LCP](https://web.dev/articles/optimize-lcp), [INP](https://web.dev/articles/inp).
> Target: **Next.js 16.3.4**, App Router. Documentation-verified; **no sandbox run**, **no benchmarks run**, **no bundle measured** — every config snippet and every quoted sentence comes from the documentation, and no tool output is reproduced here.
> Validated: 2026-09-05 · claims + version spine re-checked against the Next.js 16.3.4 docs · session d2e9b9fe

**[06](06-bundle-size-implications-and-core-web-vitals-impact.md) argued which metric a boundary decision moves. This is the other half: the tools that tell you *which* decision moved it. The single most common failure in this work is looking at a bundle size — a number that is true, reproducible and almost never actionable — when the fact you need is an import chain, because under the `'use client'` module-graph rule the question is always "which client file pulled this in". The second most common failure is grading the result on a laptop, when both thresholds are defined at the 75th percentile of real sessions.**

## What to actually look at

### 1 · The module graph, with import chains

The question is never "how big is the bundle". Under the module-graph rule the question is always **"which client module pulled this in"**, and the answer is an import chain. Next.js ships two analyzers.

**Turbopack, experimental, available in v16.1 and later:**

```bash
npx next experimental-analyze
```

It is *"integrated with Turbopack's module graph"* and lets you *"inspect server and client modules with precise import tracing"*, filter by route and by environment (client or server), and — the part that matters — click a module to *"inspect its full import chain and see exactly where it's used in your application"*.

For before/after comparison, skip the interactive view:

```bash
npx next experimental-analyze --output
cp -r .next/diagnostics/analyze ./analyze-before-refactor
```

**Webpack:**

```js
// next.config.js
/** @type {import('next').NextConfig} */
const nextConfig = {}

const withBundleAnalyzer = require('@next/bundle-analyzer')({
  enabled: process.env.ANALYZE === 'true',
})

module.exports = withBundleAnalyzer(nextConfig)
```

```bash
ANALYZE=true npm run build
```

⚠️ **The Turbopack analyzer is marked experimental in the documentation.** Turbopack is the default bundler in 16, so this is the one you will reach for; treat its interface as subject to change and keep the artifact (`--output`) rather than a screenshot.

### 2 · The field, not the lab

`useReportWebVitals` reports real metrics from real sessions. The documentation's own example is a lesson in the subject of this chapter:

```jsx
// app/_components/web-vitals.js
'use client'

import { useReportWebVitals } from 'next/web-vitals'

const logWebVitals = (metric) => {
  console.log(metric)
}

export function WebVitals() {
  useReportWebVitals(logWebVitals)

  return null
}
```

> *"Since the `useReportWebVitals` hook requires the `'use client'` directive, the most performant approach is to create a separate component that the root layout imports. This confines the client boundary exclusively to the `WebVitals` component."*

**That is the push-down rule applied to the measuring instrument itself** — a one-line client component that renders `null`, so that instrumenting the root layout does not convert the root layout into a Client Component.

The `metric` object carries `id`, `name`, `delta`, `entries`, `navigationType`, `rating` (`"good"`, `"needs-improvement"`, `"poor"`) and `value`. Ship it somewhere:

```js
function postWebVitals(metric) {
  const body = JSON.stringify(metric)
  const url = 'https://example.com/analytics'

  // Use `navigator.sendBeacon()` if available, falling back to `fetch()`.
  if (navigator.sendBeacon) {
    navigator.sendBeacon(url, body)
  } else {
    fetch(url, { body, method: 'POST', keepalive: true })
  }
}

useReportWebVitals(postWebVitals)
```

🔴 **The callback reference must be stable.** The documentation is explicit: *"New functions passed to `useReportWebVitals` are called with the available metrics up to that point. To prevent reporting duplicated data, ensure that the callback function reference does not change."* Defining the callback inline in the component body is the default mistake, and it inflates your own numbers.

⚠️ The reference's metric list includes both `FID` and `INP`. The responsiveness article I checked defines and sets thresholds for **INP**; I did not confirm FID's retirement date against a primary source in this pass, so treat FID as legacy and act on INP.

### 3 · The two config levers the docs name

**Packages with many exports** — icon and utility libraries:

```js
// next.config.js
/** @type {import('next').NextConfig} */
const nextConfig = {
  experimental: {
    optimizePackageImports: ['icon-library'],
  },
}

module.exports = nextConfig
```

> *"This option will only load the modules you actually use, while still giving you the convenience of writing import statements with many named exports."*

Next.js optimizes some libraries automatically, so check the supported list before adding one.

**Server-side packages you do not want bundled** — *"Packages imported inside Server Components and Route Handlers are automatically bundled by Next.js"*, which is occasionally wrong for a native module or a package with runtime file access:

```js
// next.config.js
/** @type {import('next').NextConfig} */
const nextConfig = {
  serverExternalPackages: ['package-name'],
}

module.exports = nextConfig
```

## The worked example the documentation gives

The docs' own case is the canonical bundle-size mistake and is worth reproducing exactly, because it is not a strawman — it is what a blog post looks like when someone reaches for the library they know:

```tsx
// app/blog/[slug]/page.tsx
'use client'

import Highlight from 'prism-react-renderer'
import theme from 'prism-react-renderer/themes/github'

export default function Page() {
  const code = `export function hello() {
    console.log("hi")
  }`

  return (
    <article>
      <h1>Blog Post Title</h1>

      {/* The prism package and its tokenization logic are shipped to the client */}
      <Highlight code={code} language="tsx" theme={theme}>
        {({ className, style, tokens, getLineProps, getTokenProps }) => (
          <pre className={className} style={style}>
            <code>
              {tokens.map((line, i) => (
                <div key={i} {...getLineProps({ line })}>
                  {line.map((token, key) => (
                    <span key={key} {...getTokenProps({ token })} />
                  ))}
                </div>
              ))}
            </code>
          </pre>
        )}
      </Highlight>
    </article>
  )
}
```

> *"This increases bundle size because the client must download and execute the highlighting library, even though the result is static HTML."*

```tsx
// app/blog/[slug]/page.tsx
import { codeToHtml } from 'shiki'

export default async function Page() {
  const code = `export function hello() {
    console.log("hi")
  }`

  // The Shiki package runs on the server and is never bundled for the client.
  const highlightedHtml = await codeToHtml(code, {
    lang: 'tsx',
    theme: 'github-dark',
  })

  return (
    <article>
      <h1>Blog Post Title</h1>

      {/* Client receives plain markup */}
      <pre>
        <code dangerouslySetInnerHTML={{ __html: highlightedHtml }} />
      </pre>
    </article>
  )
}
```

The generalisation is the test worth carrying: **a library whose only job is to turn data into markup does not belong on the client.** Syntax highlighting, chart rendering, markdown parsing, date formatting with a locale database, PDF layout. If the output is static and no browser API or user interaction is involved, the browser should receive the output rather than the machinery.

## Attributing a regression to a boundary decision

A procedure, in the order that costs least:

1. **Which metric moved?** INP without LCP points at a client-graph change. LCP without INP points at a rendering-strategy or resource change. Both moving usually means one release did two things.
2. **If LCP: which sub-part?** TTFB rising is a rendering-strategy change — something started reading request-time data. Render delay rising with flat TTFB means the LCP element became client-rendered.
3. **If INP: diff the module graph.** Run the analyzer before and after and compare the client environment. `--output` exists for exactly this.
4. **Find the import chain, not the module.** A newly-large client module is a symptom; the cause is the one file that imported it from inside a `'use client'` subtree. The analyzer's chain view is the answer.
5. **Check for a directive that moved.** `git log -S "'use client'"` over the release finds the case where nothing was added but a boundary was raised.
6. **Only then look at the library.** Replacing a dependency is the most expensive fix and the least often the right first one.

## Gotchas

**★ Symptom: a component is `'use client'` but appears tiny in the analyzer, and INP is still bad.** Cause: you are reading module size instead of the import chain. A 2 kB client component that imports a 400 kB charting library contributes 400 kB, and the chain is the only view that shows it. Fix: use the chain view — the Turbopack analyzer exists to *"inspect its full import chain and see exactly where it's used"*.

**★ Symptom: your own Web Vitals numbers look inflated or duplicated.** Cause: the callback passed to `useReportWebVitals` is a new function on every render, and the docs warn that new functions *"are called with the available metrics up to that point"*. Fix: hoist the callback to module scope, outside the component.

```jsx
// ❌ useReportWebVitals((metric) => post(metric))
// ✅ const report = (metric) => post(metric)   // module scope
//    useReportWebVitals(report)
```

**★ Symptom: adding Web Vitals reporting to the root layout made the layout a Client Component.** Cause: the hook requires `'use client'`, and the directive is viral downward through imports — putting it in `layout.tsx` puts everything the layout imports into the client bundle. Fix: the documented shape — a separate component that returns `null`, imported by the layout, *"confines the client boundary exclusively to the `WebVitals` component"*.

**★ Symptom: an icon library adds a large amount to every route.** Cause: a package with hundreds of exports, imported by name, resolving far more than you use. Fix: `experimental.optimizePackageImports` — but check the automatically-optimized list first, since some libraries are already covered and adding them again is noise.

**★ Symptom: a syntax highlighter, chart or markdown renderer is in the client bundle and nobody can say why.** Cause: it was imported into a file carrying `'use client'`, usually because one interactive control lives in the same component. Fix: do the transformation on the server and send markup, as the documentation's own prism-to-shiki example does; keep the interactive control as a separate leaf component.

**Symptom: a native or file-reading dependency breaks after a build that worked in dev.** Cause: *"Packages imported inside Server Components and Route Handlers are automatically bundled by Next.js"*, and bundling breaks packages that resolve paths or load native addons at runtime. Fix: `serverExternalPackages: ['package-name']`.

**Symptom: the analyzer output is different between two people on the team.** Cause: the Turbopack analyzer is documented as experimental and available only in v16.1 and later, and the two of you may be on different minors or different bundlers. Fix: pin the version used for measurement, write the artifact with `--output`, and compare files rather than screenshots.

**Symptom: a client component was made `dynamic` to fix the bundle and INP got worse.** Cause: lazy loading moves the cost rather than removing it, and if the chunk is fetched in response to an interaction the fetch is now inside the interaction. Fix: lazy-load things the user is unlikely to reach; for likely paths, prefer moving the work to the server or pre-rendering the boundary. Chapter 11 covers the loading strategies in full — see [11 · Performance optimization](../11-performance-optimization-turbopack/01-explanation.md).

**★ Symptom: the analyzer shows a heavy module and you cannot tell whether it is in the client bundle at all.** Cause: you are looking at an unfiltered view; the Turbopack analyzer filters by route, by environment (client or server) and by type. A server-only dependency is not a client bundle problem and needs no fix. Fix: filter to the client environment first, and only then read sizes — a large server module is usually fine.

**Symptom: two analyzer runs disagree and neither is wrong.** Cause: the analysis reflects a build, and builds differ by environment variables, by route set and by whether the run was a fresh build or a cached one. Fix: write both to disk with `--output` and diff the directories, rather than comparing an interactive view now against a memory of one last week.

```bash
npx next experimental-analyze --output
cp -r .next/diagnostics/analyze ./analyze-after
diff -rq ./analyze-before-refactor ./analyze-after
```

## Interview questions

**★ You have an INP regression. What is the first artifact you ask for?**
A module-graph diff of the client environment, with import chains — from `next experimental-analyze --output` on both commits, or the webpack analyzer. Not the total bundle size, because the number tells you nothing actionable: under the `'use client'` module-graph rule, the thing you need to know is which client file imported the new weight, and that is a chain rather than a size. A 2 kB component importing a 400 kB library looks small in every view except the chain view.

**★ What is the test for whether a library belongs on the client?**
Whether it needs a browser API or a user interaction. A library whose only job is turning data into markup — syntax highlighting, chart rendering, markdown parsing — produces static output, so the browser should receive the output and not the machinery. The Next.js documentation makes exactly this case with a prism-based highlighter in a Client Component, where the entire tokenizer ships to produce a `code` block, versus calling shiki in a Server Component and sending the rendered HTML. The generalisation is more useful than the example: ask what the client does with the library after the first render, and if the answer is nothing, it is server work.

**Why does instrumenting Web Vitals risk making the metrics worse?**
Because the hook requires `'use client'`, and the natural place to put it is the root layout, which is the single worst place to add a directive — everything the layout imports joins the client bundle. The documentation's recommended shape avoids it: a small component that calls the hook and returns `null`, imported by the layout, which confines the boundary to that component. The second hazard is subtler: passing a new callback function on each render causes duplicate reporting, because new functions are called with the metrics available so far, so the callback belongs at module scope.

**What does `optimizePackageImports` do, and when would you not reach for it?**
It changes how imports from packages with very large export surfaces are resolved so that only the modules you actually use are loaded, while you keep writing convenient named imports. It is aimed at icon and utility libraries, where a barrel import can drag in hundreds of modules. You would not reach for it first when the weight is a single heavy dependency rather than a wide one — a charting or highlighting library is not a barrel problem, it is a boundary problem, and the fix is to move the work to the server. It is also worth checking the automatically-optimized list before adding anything, since Next.js already covers some packages.

**★ What single artifact resolves most client-bundle arguments, and why is bundle size not it?**
The import chain. A size tells you that something is heavy; it does not tell you why it is in the client graph, and under the `'use client'` rule that is the only question with an action attached — some file inside a client subtree imported it, possibly several hops away. The Turbopack analyzer exists for this: clicking a module shows its full import chain and where it is used. In practice the fix is almost never "replace the library" and almost always "this one import should not be inside a client component", which only the chain view makes visible.

**How would you prove that a boundary change actually worked?**
By pairing a build-time artifact with a field measurement, because neither alone is sufficient. Write the analyzer output to disk before and after with `--output` and diff the client environment — that proves the module left the client graph, which is a claim about the build and is deterministic. Then compare INP at the 75th percentile from `useReportWebVitals` data over a comparable traffic window, which is the claim about users and is the one being graded. A local Lighthouse comparison proves neither: it is one sample from the fast end of the distribution, on hardware that hides exactly the hydration cost you were trying to remove.

---

← Prev [06 · Bundle size and Core Web Vitals](06-bundle-size-implications-and-core-web-vitals-impact.md) · [Index](01-explanation.md) · Next → [04 · Data fetching in the App Router](../04-data-fetching-in-the-app-router/01-explanation.md)
