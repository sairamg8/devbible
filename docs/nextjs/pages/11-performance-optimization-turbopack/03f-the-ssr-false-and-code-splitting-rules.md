---
title: "The four documented rules about `ssr: false` and dynamic imports are the same rule stated four ways — the unit of client-side code splitting is a Client Component, because that is the only thing that ships JavaScript to a browser"
sidebar_label: "03f · The ssr: false rules"
sidebar_position: 16
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-09-04 against the Next.js [lazy loading guide](https://nextjs.org/docs/app/guides/lazy-loading)
> (docs build `version: 16.3.4`, `lastUpdated: 2026-03-10`).
> Documentation-verified; **no sandbox run**.
> Target: **Next.js 16.3.4 · App Router**.

**Three of these four rules are avoided by one move — put the `dynamic()` call inside a Client Component — and
the fourth is the one that makes people file bugs.** Dynamically importing a Server Component lazy-loads only
its Client Component *children*, never the Server Component itself, because a Server Component has no client
chunk to defer; its output is markup in the RSC payload. `ssr: false` fails for the mirror-image reason: it
asks a Server Component not to render on the server, which is contradictory rather than merely redundant, so
Next.js errors instead of ignoring it. This page quotes all four verbatim, shows the single refactor that fixes
three of them, and is explicit about the one mechanism the documentation does not explain. The API itself is
[03e](03e-next-dynamic-and-lazy-loading.md).

## 🔴 The four `ssr: false` and code-splitting rules, verbatim

These are the documented constraints, and they are quoted rather than paraphrased because three of them are
about the *same* underlying restriction and the fourth is a genuine surprise.

**1 — Automatic code splitting does not happen when a Server Component imports a Client Component
dynamically:**

> *"When a Server Component dynamically imports a Client Component, automatic code splitting is currently
> **not** supported."*

**2 — `ssr: false` is a Client Component option:**

> *"`ssr: false` option will only work for Client Components, move it into Client Components ensure the client
> code-splitting working properly."*

**3 — using it in a Server Component is an error, not a no-op:**

> *"`ssr: false` option is not supported in Server Components. You will see an error if you try to use it in
> Server Components."*
> *"`ssr: false` is not allowed with `next/dynamic` in Server Components. Please move it into a Client
> Component."*

**4 — dynamically importing a Server Component does not defer the Server Component:**

> *"If you dynamically import a Server Component, only the Client Components that are children of the Server
> Component will be lazy-loaded - not the Server Component itself."*

**What all four are really saying.** The unit of client-side code splitting is a Client Component, because that
is the only thing that ships JavaScript to the browser. A Server Component has no client chunk of its own to
defer — its output is markup in the RSC payload — so "lazily importing" one can only affect the client
components inside it. And `ssr: false` is a statement about *client-side rendering only*, which is a concept
that does not exist on the server; hence the error rather than a silent no-op.

**The fix for rules 1 to 3 is the same move**: put the `dynamic()` call inside a Client Component, and have the
Server Component render that.

```tsx
// ❌ app/dashboard/page.tsx — a Server Component
import dynamic from 'next/dynamic'

const Chart = dynamic(() => import('@/components/chart'), { ssr: false })
//                                                          ^ errors: not supported here

export default function Page() {
  return <Chart />
}
```

```tsx
// ✅ components/chart-loader.tsx — a Client Component owns the dynamic import
'use client'

import dynamic from 'next/dynamic'

const Chart = dynamic(() => import('@/components/chart'), {
  ssr: false,
  loading: () => <div className="h-80 animate-pulse rounded bg-slate-100" />,
})

export function ChartLoader({ series }: { series: Series }) {
  return <Chart series={series} />
}
```

```tsx
// ✅ app/dashboard/page.tsx — the Server Component just renders it
import { ChartLoader } from '@/components/chart-loader'

export default async function Page() {
  const series = await getSeries()
  return <ChartLoader series={series} />
}
```

And the default, when you do not pass `ssr: false`:

> *"When using `React.lazy()` and Suspense, Client Components will be prerendered (SSR) by default."*

So `ssr: false` is opt-out, not opt-in — reach for it only when the component genuinely cannot render on the
server: it touches `window` at module scope, measures the DOM on first render, or wraps a library that assumes
a browser.

## Gotchas

**★ Symptom: `ssr: false` in a page or layout throws — *"`ssr: false` is not allowed with `next/dynamic` in
Server Components."*** Cause: the option is Client-Component-only and the docs are explicit that it *errors*
rather than being ignored. Fix: move the `dynamic()` call into a Client Component and render that from the
server file.

```tsx
// components/chart-loader.tsx
'use client'
import dynamic from 'next/dynamic'
const Chart = dynamic(() => import('@/components/chart'), { ssr: false })
export function ChartLoader(props: ChartProps) { return <Chart {...props} /> }
```

**★ Symptom: a Server Component was changed to import a heavy component with `next/dynamic` and the client
bundle did not shrink.** Cause: *"When a Server Component dynamically imports a Client Component, automatic
code splitting is currently **not** supported."* The import is dynamic in source and not split in output. Fix:
same move — the `dynamic()` call belongs in a Client Component.

**★ Symptom: a Server Component was dynamically imported to defer it, and nothing was deferred.** Cause: *"If
you dynamically import a Server Component, only the Client Components that are children of the Server Component
will be lazy-loaded - not the Server Component itself."* A Server Component has no client chunk to defer. Fix:
stop trying to defer it — use `<Suspense>` and streaming for server work, and `next/dynamic` only for the
client components inside it.

```tsx
// app/reports/page.tsx — the server-side tool is Suspense, not next/dynamic
import { Suspense } from 'react'
import { SlowReport } from '@/components/slow-report' // async Server Component

export default function Page() {
  return (
    <Suspense fallback={<ReportSkeleton />}>
      <SlowReport />
    </Suspense>
  )
}
```

**★ Symptom: `ssr: false` was applied broadly "to be safe" and the page now flashes empty content on load.**
Cause: the default is the opposite — *"Client Components will be prerendered (SSR) by default"* — so switching
it off removes the server-rendered markup and leaves the browser to paint after the chunk arrives. Fix: only
use `ssr: false` for components that genuinely cannot render on the server, and let everything else prerender.

**Symptom: a dynamic import of a component that reads `window` still crashes during the server render.**
Cause: `ssr: false` was not set, so the component was prerendered on the server, where `window` does not exist.
Fix: either set `ssr: false` on the dynamic import, or move the browser access into an effect so it only runs
after mount — the second is usually the better component.

```tsx
const Map = dynamic(() => import('@/components/map'), { ssr: false })
```

**Symptom: content behind an `ssr: false` component is missing from view-source, and search engines do not
index it.** Cause: that is the definition of the option — no server-rendered markup is produced for it at all,
so the first HTML response contains only the fallback. Fix: never put content behind `ssr: false`. It is for
chrome and widgets that genuinely cannot render on a server; anything a crawler or a reader needs must
prerender.

```tsx
// ❌ the article body will not exist in the initial HTML
const ArticleBody = dynamic(() => import('@/components/article-body'), { ssr: false })

// ✅ ssr: false is for the widget that cannot render server-side
const LiveMap = dynamic(() => import('@/components/live-map'), { ssr: false })
```

**Symptom: removing `ssr: false` from a component produces a hydration mismatch.** Cause: the option was
masking a component that renders differently on the server and the client — a timestamp, a random value, a
`typeof window` branch. With prerendering off, only one of the two renders ever happened, so the mismatch could
not be observed. Fix: make the first client render match the server render and move the browser-dependent part
into an effect.

```tsx
'use client'
import { useEffect, useState } from 'react'

export function LocalTime({ iso }: { iso: string }) {
  // Server and first client render agree; the locale-formatted value arrives after mount.
  const [local, setLocal] = useState<string | null>(null)
  useEffect(() => setLocal(new Date(iso).toLocaleString()), [iso])
  return <time dateTime={iso}>{local ?? iso}</time>
}
```

## Interview questions

**★ Why does `ssr: false` error in a Server Component instead of being ignored?**
Because it asks for something that has no meaning there. `ssr: false` says "do not render this on the server,
render it only in the browser" — but a Server Component *is* the server render, so the option is not merely
unnecessary, it is contradictory. Next.js chose to make that a hard error rather than a silent no-op, and the
message says what to do: *"`ssr: false` is not allowed with `next/dynamic` in Server Components. Please move it
into a Client Component."* The general shape of the fix is the same one that fixes the code-splitting rule: the
`dynamic()` call lives in a Client Component and the Server Component renders that component.

**★ You dynamically import a Server Component to defer it. What actually happens?**
Only its Client Component children get lazy-loaded — *"not the Server Component itself."* This surprises people
because the code looks like a deferral, but a Server Component does not ship a JavaScript chunk to the browser;
its output is markup in the RSC payload. There is nothing client-side to defer. If the goal is to stop a slow
server-side component blocking the rest of the page, the tool is `<Suspense>` and streaming, not `next/dynamic`.

**Why does the Server-Component-imports-Client-Component case not code split?**
The documentation states the limitation — *"automatic code splitting is currently not supported"* — without
giving the reason, and I could not confirm the underlying mechanism from these sources, so I will not invent
one. What matters practically is the word *currently* and the workaround, which is the same as for `ssr:
false`: perform the dynamic import inside a Client Component. That boundary is where client-side code splitting
happens at all.

**★ Three of the four rules are fixed by the same refactor. What is it, and why does it work?**
Move the `dynamic()` call out of the server file and into a Client Component, then have the Server Component
render that Client Component. It works because client-side code splitting is a client-side concept: the chunk
boundary exists in the browser bundle, and only a Client Component contributes to that bundle. Once the call
site is inside the client graph, `ssr: false` is meaningful, the code split actually happens, and there is no
error to hit. The usual shape is a small `*-loader.tsx` marked `'use client'` whose only job is to own the
dynamic import and forward props.

**When should `ssr: false` never be used, regardless of bundle size?**
For anything that is content. `ssr: false` means no server-rendered markup exists for that subtree, so the
initial HTML contains the fallback and nothing else — which is a problem for search indexing, for link
previews, for readers on slow connections, and for Largest Contentful Paint if the deferred thing is the main
element. The legitimate uses are components that genuinely cannot execute on a server: something touching
`window` at module scope, a mapping or charting library that assumes a DOM, an editor that measures layout on
mount. Everything else should prerender and hydrate.

---

← [03e · `next/dynamic` and lazy loading](03e-next-dynamic-and-lazy-loading.md) · [Chapter index](01-explanation.md) · Next → [03g · Magic comments](03g-magic-comments-and-optional-imports.md)
