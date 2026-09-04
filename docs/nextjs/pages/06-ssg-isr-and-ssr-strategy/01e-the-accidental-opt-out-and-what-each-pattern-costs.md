---
title: "The rendering pattern you chose and the one you shipped diverge through a single request-time read in a file nobody opened — here is how the accidental opt-out happens, how to find it, and what each pattern actually costs once you do"
sidebar_label: "01e · The accidental opt-out"
sidebar_position: 5
description: "The failure that dominates real codebases: one cookies() call in a shared utility takes a whole route section off the static path. The eight shapes it takes, a detection procedure you can run today, the structural fix, and a cost table for every pattern."
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-09-04 for **Next.js 16.3.4** against [Caching](https://nextjs.org/docs/app/getting-started/caching) (docs `version: 16.3.4`, `lastUpdated: 2026-08-25`) and [How to implement Incremental Static Regeneration (ISR)](https://nextjs.org/docs/app/guides/incremental-static-regeneration) (`lastUpdated: 2026-06-23`). The `next-request-in-use-cache` error string and the route-table reading procedure are carried from research banked 2026-09-03 and from [ch4 · static vs dynamic rendering](../04-data-fetching-in-the-app-router/03-static-vs-dynamic-rendering-force-dynamic-force-static-reval.md).
> `next` is **not installed in this checkout** — no package probe was possible; `react` probes at **19.2.8**.
> Target: **Next.js 16.3.4 · React 19.2.8 · Node >= 20.9**. Documentation-verified; **no sandbox run**.

**Every decision in the preceding four chunks is an intention, and intentions are not what ships. The gap between them has one dominant cause: somebody added a legitimate request-time read to a module that a shared component imports, and under the previous rendering model that one line takes the entire route — sometimes the entire application — off the static path. Nothing errors. Nothing logs. The only evidence is a symbol in the build's route table that nobody reads, and by the time anyone notices, the read is four imports deep in a file whose name has nothing to do with rendering. This chunk is the eight shapes that read takes, a detection procedure you can run before lunch, the structural fix that stops it recurring, and — because every choice here is a purchase — what each pattern costs.**

## The shape of it, in code

Here is the whole failure. A perfectly reasonable experiment helper:

```ts
// lib/experiments.ts
import { cookies } from 'next/headers'

export async function getVariant(experiment: string): Promise<'a' | 'b'> {
  const assigned = (await cookies()).get(`exp_${experiment}`)?.value
  return assigned === 'b' ? 'b' : 'a'
}
```

used by a header that every page renders:

```tsx
// components/site-header.tsx
import { getVariant } from '@/lib/experiments'

export async function SiteHeader() {
  const variant = await getVariant('nav-2026')
  return <nav className={variant === 'b' ? 'nav-compact' : 'nav-wide'}>{/* links */}</nav>
}
```

mounted, as headers are, in the root layout:

```tsx
// app/layout.tsx
import { SiteHeader } from '@/components/site-header'

export default function RootLayout({ children }: LayoutProps<'/'>) {
  return (
    <html lang="en">
      <body>
        <SiteHeader />
        {children}
      </body>
    </html>
  )
}
```

Three files, all defensible, no flags, no `force-dynamic`. Under the previous model **every route in the application now renders per request**, and the pull request that did it changed a nav class name.

## The eight shapes it takes

1. **`cookies()` in a shared helper** — experiments, theme, locale, consent state. The example above.
2. **`headers()` in a telemetry or logging module** — reading `user-agent` or a trace id "for observability", imported by a base layout.
3. **An uncached `fetch` in a feature-flag module.** Under the previous model this does not make the route dynamic — it leaves it prerendered with the flags frozen at build, which is a *different* and arguably nastier bug. Under Cache Components it is a build failure unless cached or suspended.
4. **`searchParams` destructured in a page for an unrelated reason** — `?ref=` attribution, a `?debug=1` switch. Touching `searchParams` at the page level is a request read regardless of what you do with the value.
5. **`draftMode()` inside a CMS wrapper you did not write.** Preview support is often bundled into a vendor SDK's component, and it reads the request on every render, not only in preview.
6. **Non-determinism** — `Date.now()`, `new Date()`, `Math.random()`, `crypto.randomUUID()` in a component or a helper it calls. Under Cache Components these are explicitly guarded; the docs list the corresponding dev-overlay insights and exempt only `performance.now()`.
7. **`connection()` left behind after a debugging session.** It exists to force request-time rendering, it is one line, and it looks like an import nobody would question.
8. **A segment config export added in a parent layout** — `export const revalidate = 0` or `dynamic = 'force-dynamic'` in a layout, which applies to everything beneath it and appears in no child file.

🔴 **The reason these survive review is that every one of them is correct in isolation.** Reading a cookie to bucket an experiment is not a bug. The bug is the *reach* of the module that does it, and reach is invisible in a diff.

## Finding it

Start with the ground truth, not the code: build the route and read what it decided, per [ch4 · static vs dynamic rendering](../04-data-fetching-in-the-app-router/03-static-vs-dynamic-rendering-force-dynamic-force-static-reval.md). A theory formed before that step is a theory about the wrong route half the time.

Then enumerate every module that *can* read the request:

```bash
# Every request-time read in the tree, definition sites first.
grep -rn "from 'next/headers'" app components lib src
grep -rn "draftMode()\|connection()" app components lib src

# Segment config anywhere — including the layout nobody thinks to open.
grep -rEn "^export const (dynamic|revalidate|fetchCache|dynamicParams)" app

# Explicit uncached reads, which are the only fetch options that force dynamic.
grep -rn "cache: 'no-store'\|revalidate: 0" app components lib src
```

🔴 **Grep finds definitions; the bug is reachability.** `lib/experiments.ts` is harmless until something in a layout imports it. So the second half of the procedure is to walk *upward* from each hit — who imports this module, and does any layout or page sit above that importer? Two heuristics that pay for themselves:

- **Any request-time read reachable from a `layout.tsx` is a section-wide decision**, not a component-local one, and should be treated as an architectural change in review.
- **A route that flipped from prerendered to per-request between two builds is a regression** even when no page file changed. Capture the build's route table as an artefact on every CI run and diff it; a flip that nobody explained is a review comment, and this is the only check that catches the accidental opt-out at the time it happens rather than a quarter later.

Under Cache Components, most of this stops being detective work: the framework refuses to guess, and the dev overlay names the route.

> *"Next.js requires you to explicitly handle components that can't complete during prerendering. It surfaces a validation insight in the dev overlay and dev server console that names the route and points at fixes (cache the access, move it into a `<Suspense>` boundary, or opt the route out). This validation keeps every route producing a static shell, so direct navigations stay instant."*
> — [Caching](https://nextjs.org/docs/app/getting-started/caching)

**That is the strongest practical argument for enabling the flag**: it converts a silent, cumulative performance regression into a build-time conversation.

## The structural fix

Grep discipline decays. What does not decay is making request-time reads impossible to add by accident, by giving them one home:

```ts
// lib/request/session.ts — the ONLY place cookies() is called.
import 'server-only'
import { cookies } from 'next/headers'

export async function getSessionId(): Promise<string | undefined> {
  return (await cookies()).get('sid')?.value
}
```

Then the rule review can actually enforce: **nothing outside `lib/request/` imports `next/headers`, and every component that imports `lib/request/` is either a leaf inside a `<Suspense>` boundary or is knowingly making its route dynamic.** One directory to watch, one grep to run in CI, and a diff that shows the architectural change instead of hiding it.

For the experiment helper specifically, the fix is to hoist the read into a boundary-wrapped leaf and pass the value down as a prop:

```tsx
// components/site-header.tsx
import { Suspense } from 'react'
import { getVariant } from '@/lib/request/experiments'

export function SiteHeader() {
  return (
    <Suspense fallback={<nav className="nav-wide">{/* links */}</nav>}>
      <SiteHeaderVariant />
    </Suspense>
  )
}

async function SiteHeaderVariant() {
  const variant = await getVariant('nav-2026')
  return <nav className={variant === 'b' ? 'nav-compact' : 'nav-wide'}>{/* links */}</nav>
}
```

The layout is prerenderable again; the fallback ships in the shell; only the class name streams.

## What each pattern costs

The documentation gives **no numbers** — no cost per invocation, no build-minute guidance, no threshold for "too many params". What it does give is the unit each pattern is billed in, which is enough to reason with.

| Pattern | Paid at build | Paid per request | Storage | The surprise |
|---|---|---|---|---|
| Prerendered, no revalidation | One render per URL | Nothing — served from a CDN | One artefact per URL, per deploy | Content is frozen until the next deploy; a build-time timestamp is baked in |
| Prerendered + time-based revalidation | Same | A background regeneration on the triggering request | Same, plus data cache | *"On platforms with per-request billing, this background work counts as additional compute"* |
| Prerendered + on-demand invalidation | Same | Nothing until a write | Same | Invalidation reaches only the instance that receives it unless a shared cache handler is configured |
| App Shell + holes (PPR) | One shell render | Only the holes | Shell plus per-hole entries | Bots skip the shell and re-render the entire page at request time |
| Per-link prefetch of cached content | Nothing | *"It costs a server invocation per prefetchable link"* | Client-side, per link | A dense listing multiplies invocations by visible links |
| `use cache: remote` | Nothing | A network roundtrip per miss | Durable, shared | *"a network roundtrip that pays off only at a **high hit rate**"* |
| Fully request-time | Nothing | A full render, every time, including bots and prefetches | Nothing | The upstream's bad day is your bad day, immediately and for everyone |
| Client-side fetch after hydration | Nothing | An API call per client | Browser only | No content in the initial document, and a flash before hydration |

Two structural costs cut across the whole table. **Nothing survives a deploy** — *"All of these stores are scoped to a single deployment. A new deploy starts fresh"* — so every release resets you to the build column. And **a static export cannot revalidate at all**: *"ISR is not supported when creating a Static Export"*, which is the trade-off examined in [04 · full static export vs serverful distribution](04-full-static-export-vs-serverful-edge-distribution.md).

## Gotchas

**★ Symptom: a route section went per-request in a release that changed no page.** Cause: a request-time read entered a module reachable from a layout — the eight shapes above. Fix: find it by walking upward from every `next/headers` import to its consumers, then push the read into a boundary-wrapped leaf as shown; and add the route-table diff to CI so the next one is caught in the pull request.

**★ Symptom: feature flags in production are the values they had at build time.** Cause: shape 3 — an uncached `fetch` under the previous model does not force a dynamic route; it leaves the route prerendered with the response frozen. Fix: decide which you meant. If flags may be stale for an hour, cache them with a lifetime and a tag and invalidate on change; if they must be current, the read belongs in a boundary and the route pays for it.

**★ Symptom: `next build` fails with an uncached-data error naming a component nobody edited.** Cause: Cache Components validation reached a shared module through a new import path. This is the same defect as the silent one, surfaced loudly. Fix: apply one of the three documented remedies — cache the access, put it behind a `<Suspense>` boundary, or opt the route out deliberately — and prefer the first two, because opting out is how a codebase quietly returns to the previous model one route at a time.

**★ Symptom: a `use cache` function throws `next-request-in-use-cache` only in production.** Cause: the cached function, or a helper it calls, reads `cookies()`, `headers()` or `searchParams`; the restriction follows the call stack, and on a dynamically rendered route it surfaces when the route runs, so it can pass `next build` and fail under `next start`. Fix: read the request in the caller and pass the derived value in as an argument.

**★ Symptom: a vendor CMS component makes every content page dynamic.** Cause: shape 5 — preview support inside the SDK calls `draftMode()` on every render. Fix: wrap the vendor component in your own boundary rather than mounting it in a layout, and confirm the route symbol afterwards; if the SDK reads the request unconditionally, the boundary is the only lever you have.

**Symptom: a page is dynamic and the whole team has read every component in it.** Cause: shape 8 — the flag is in a parent layout, which is not "in the page" by any reading of the file tree. Fix: grep the segment config exports across the whole `app/` directory *before* reading component code; it takes seconds and it is the single highest-yield first step.

**Symptom: fixing the opt-out made the page flash unstyled navigation.** Cause: you moved a class-name decision into a streamed hole, so the fallback renders first. Fix: choose a fallback that is the majority variant rather than an empty node, so the streamed correction is invisible to most users — and accept that a personalization decision affecting layout is a real cost of not rendering per request.

**Symptom: CI shows no route flipped, and production is still slow.** Cause: the route table records the rendering decision, not the work. A prerendered route whose holes each make an uncached upstream call is static by symbol and slow by behaviour. Fix: measure the holes; the rendering pattern is only one of the inputs to a page's latency.

## Interview questions

**★ One `cookies()` call in a shared utility. Explain the blast radius.**
It depends on the model and on where the utility is imported, not on where it is defined. Under the previous model, any request-time read reachable from a route makes that whole route render per request, so a helper imported by a component mounted in the root layout takes the entire application off the static path. Under Cache Components the read only defers the subtree that performs it, provided it sits behind a `<Suspense>` boundary — and if it does not, the build refuses rather than silently downgrading. The dangerous case is the first one, because nothing in the diff, the logs or the tests reflects it.

**★ How would you find an accidental opt-out in a codebase you have never seen?**
Build first and read what the build decided, because half of these investigations are conducted against a route that was never static to begin with. Then grep for `next/headers`, `draftMode`, `connection`, the four segment config exports and explicit `no-store` reads — and, crucially, walk upward from each hit to find which layouts and pages can reach it, since the defect is reachability rather than the read itself. The permanent fix is structural: confine request reads to one directory marked `server-only`, and diff the route table in CI so a flip becomes a review comment instead of an archaeology project.

**★ Why is an uncached `fetch` in a shared module a worse bug than a `cookies()` call?**
Because it fails in the direction nobody checks. The `cookies()` call makes the route dynamic, which is visible as latency and cost. The uncached `fetch` under the previous model leaves the route prerendered and freezes the response at build time, so the page is fast, healthy, cached — and wrong, indefinitely, with no signal. Feature flags and configuration read this way are the classic case: the values are whatever they were when the release was built.

**★ What does enabling Cache Components buy you in terms of this specific failure?**
It converts it from silent to loud. The framework validates that every route can produce a static shell and surfaces an insight naming the route and the fix, so the accidental opt-out becomes a build-time conversation instead of a quarterly performance mystery. It also narrows the blast radius: a request read behind a boundary defers only its own subtree, so the worst case stops being "the entire application went dynamic".

**Which rendering pattern is cheapest, and is that the same as best?**
Prerendered with no revalidation is cheapest at request time — nothing runs, the CDN serves an artefact — and it is the best choice only when frozen content is acceptable until the next deploy. Every other pattern buys freshness or personalization with a unit of cost: a background regeneration that bills as compute on per-request platforms, a server invocation per prefetchable link, a network roundtrip per remote-cache miss, or a full render per request. The documentation supplies no prices, so the honest framing is which unit you are buying and how often, not which pattern is fastest in the abstract.

**What is the cost of caching that people forget to count?**
Invalidation correctness and the invisibility of failure. A cache adds a second source of truth that must be invalidated by every write path, including the ones added later by someone who never read this decision — and when refreshing breaks, the last good value keeps being served, so the site looks healthy while the data ages. Both costs are organisational rather than computational, which is exactly why they are missing from the estimate.

---

← [The decision procedure](01d-the-decision-procedure-and-when-ssr-is-right.md) · [Chapter index](01-explanation.md) · Next → [`generateStaticParams` at scale](02-generatestaticparams-for-pre-rendering-dynamic-routes-at-sca.md)
