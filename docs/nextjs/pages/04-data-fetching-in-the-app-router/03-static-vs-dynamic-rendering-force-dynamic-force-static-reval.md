---
title: "A route is prerendered until something in it reads the request — `force-dynamic` and `force-static` are overrides on a legacy model, not the mechanism, and turning on Cache Components removes them from the framework entirely"
sidebar_label: "03 · Static vs dynamic rendering"
sidebar_position: 11
description: "What actually decides whether a route renders at build time or per request in Next.js 16: Request-time APIs, the positional rule that splits one page into a static half and a dynamic half, Suspense as the shell boundary, and how to read what the build decided."
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-09-03 for **Next.js 16.3.4** against [Glossary](https://nextjs.org/docs/app/glossary) (docs `lastUpdated` 2026-08-25), [Building your application](https://nextjs.org/docs/app/guides/building) (`lastUpdated` 2026-07-21), [Caching and Revalidating (Previous Model)](https://nextjs.org/docs/app/guides/caching-without-cache-components) (`lastUpdated` 2026-08-25) and [next CLI](https://nextjs.org/docs/app/api-reference/cli/next) (`lastUpdated` 2026-08-25).
> Target: **Next.js 16.3.4**, App Router, Node >= 20.9. Documentation-verified; **no sandbox run**.

**Almost everyone carries the wrong causal arrow here. They believe a route is dynamic because they exported `force-dynamic`, and static because they did not. The arrow runs the other way: every route starts out prerendered, and it becomes dynamic the moment something inside it reads request-specific data. The segment config flags are a way to *override* that inference, and in 16.3.4 they belong to a model the documentation now labels "Previous" — `dynamic`, `revalidate` and `fetchCache` are removed outright when `cacheComponents` is enabled. This page is the mechanism: what counts as reading the request, why the same unannotated `fetch` is static in one place in a file and dynamic four lines lower, and how to make the build tell you what it actually decided. [03b](03b-the-segment-config-surface.md) is the flag surface, value by value. [03c](03c-diagnosing-stale-and-unexpectedly-dynamic-routes.md) is the two questions you came here with at 2am.**

## The default is prerendering; dynamic is something that happens to it

Two glossary definitions do most of the work, and they are worth reading as a pair rather than as separate entries.

**Prerendering** is rendering a component at build time — or in the background during revalidation — producing HTML and an RSC payload that can be cached and served from a CDN.

> *"Prerendering is the default for components that don't use Request-time APIs."*

**Dynamic rendering** is rendering at request time instead, and the documentation states the trigger in one clause: a component becomes dynamic when it uses Request-time APIs.

So there is no "make this static" switch to remember, because static is where you already are. There is only a set of reads that take it away from you, and a set of flags that argue with the inference afterwards. This matters practically because it inverts the debugging question. When a route surprises you, the useful question is never *"which config did I forget?"* — it is **"what in this subtree touched the request?"**

## The exact list of things that read the request

The glossary's `Request-time APIs` entry names four:

| API | What it reads |
|---|---|
| [`cookies()`](https://nextjs.org/docs/app/api-reference/functions/cookies) | request cookies |
| [`headers()`](https://nextjs.org/docs/app/api-reference/functions/headers) | request headers |
| [`searchParams`](https://nextjs.org/docs/app/api-reference/file-conventions/page) | URL query parameters |
| [`draftMode()`](https://nextjs.org/docs/app/api-reference/functions/draft-mode) | whether Draft Mode is on — see [10 · Draft Mode](10-draft-mode-cms-preview-that-bypasses-every-cache-layer.md) |

Two more things behave the same way even though the glossary files them elsewhere, and both catch people out.

**`params` for a value the build does not know about.** The Building guide groups `params` with `searchParams`, `cookies()` and `headers()` as *runtime data* that is not available during the prerender pass. A `params` value produced by `generateStaticParams` is known at build; every other value is not. That is why one route can be half prerendered and half not — see [03b](03b-the-segment-config-surface.md).

**`connection()`.** The prerender-blocking error that Next.js prints during `next build` names `connection()` alongside `cookies()`, `headers()`, `params` and `searchParams` as an access that prevents prerendering. It does not appear in the glossary's four-item Request-time APIs list. Treat the discrepancy as a documentation gap rather than a behaviour difference: `connection()` exists precisely to say *"do not prerender past this point"*, and the same error tells you it is the one item on the list that `use cache` cannot fix. Its relationship to memoization is covered in [01g](01g-react-cache-connection-and-non-fetch-memoization.md).

And a third category that is not an API at all: **uncached data**. Under Cache Components, an uncached `fetch()` or database call is itself enough to stop the prerender — the framework refuses to guess whether that value may be baked into build output. Non-deterministic operations (`Math.random()`, `new Date()`) are called out separately as things that can also fail the build.

## 🔴 The positional rule: the same `fetch` is static or dynamic depending on what ran before it

This is the single most useful sentence in the caching documentation and it is buried inside a collapsed `<details>` block on the `fetchCache` option:

A `fetch` request that sets no `cache` option is fetched **once during `next build`** if it is reachable *before* any Request-time API is used — because the route is prerendered up to that point. Requests discovered *after* a Request-time API run on **every request**. Both halves of that rule come from the `fetchCache` section of the Previous Model guide.

Read it again with a real file in mind. Prerendering is not a property of the route that gets decided once; it is a **prefix** of the render. Everything up to the first request-time read can be computed at build. Everything after it cannot be, because the render is now producing a per-request result.

```tsx
// app/dashboard/page.tsx — one file, two different caching behaviours
import { cookies } from 'next/headers'

export default async function Dashboard() {
  // Reachable BEFORE any request-time read ⇒ fetched once during `next build`.
  const plans = await fetch('https://api.sprintdesk.dev/plans').then((r) => r.json())

  const store = await cookies() // 🔴 the prefix ends here
  const sessionId = store.get('sd_session')?.value ?? ''

  // Discovered AFTER a request-time read ⇒ runs on every request.
  const me = await fetch(`https://api.sprintdesk.dev/me?session=${sessionId}`).then((r) => r.json())

  return <DashboardView plans={plans} me={me} />
}
```

Neither `fetch` says anything about caching. They behave differently anyway, and moving the `cookies()` call three lines up would silently change the first one from a build-time snapshot to a per-request call. Nothing in your diff would look like a caching change.

The corollary is the one people get bitten by in the other direction: **a read in a layout ends the prefix for every page underneath it.** An analytics helper that calls `headers()` in `app/(app)/layout.tsx` moves the boundary to the very top of the tree, and every unannotated `fetch` in every child page becomes a per-request call at once.

## `<Suspense>` is where you declare the shell to stop

The glossary is explicit that a Suspense boundary is not a spinner convention here:

Suspense boundaries define where the static shell ends and streaming begins, which is what makes Partial Prerendering possible. Under Cache Components that stops being an optimisation and becomes the contract: request-time reads and uncached data must sit **inside** a boundary, or the build fails with `blocking-prerender-runtime` / `blocking-prerender-dynamic` — error identifiers quoted from the Building guide.

```tsx
// app/dashboard/page.tsx — the same page, restructured so the shell survives
import { Suspense } from 'react'
import { cookies } from 'next/headers'

async function Greeting() {
  const store = await cookies()
  const sessionId = store.get('sd_session')?.value ?? ''
  const me = await fetch(`https://api.sprintdesk.dev/me?session=${sessionId}`).then((r) => r.json())
  return <p>Signed in as {me.name}</p>
}

export default async function Dashboard() {
  const plans = await fetch('https://api.sprintdesk.dev/plans').then((r) => r.json())
  return (
    <>
      <PlanTable plans={plans} />
      <Suspense fallback={<p>Signed in as …</p>}>
        <Greeting />
      </Suspense>
    </>
  )
}
```

`PlanTable` and the fallback text are now in the prerendered HTML. Only `Greeting` waits for the request. `loading.js` does the same thing for a whole segment — the Building guide's own worked fix for a prerender-blocking error is to add a `loading.tsx`, which wraps the segment in a boundary and prerenders the fallback as the route's shell.

## Two rendering models ship in the same release

`cacheComponents` is opt-in in `next.config.ts`, and the choice is not a tuning knob — it changes which vocabulary exists.

| | Cache Components **off** | Cache Components **on** |
|---|---|---|
| Default per route | prerender until a Request-time API appears | Partial Prerendering: static shell + streamed dynamic parts |
| `export const dynamic` | available, four values ([03b](03b-the-segment-config-surface.md)) | 🔴 **removed in v16.0.0** |
| `export const revalidate` | available | 🔴 **removed in v16.0.0** |
| `export const fetchCache` | available | 🔴 **removed in v16.0.0** |
| `export const dynamicParams` | available | 🔴 **removed in v16.0.0** per the version history |
| Caching a value | `fetch` options, `unstable_cache` | `use cache` + `cacheLife` / `cacheTag` |
| Uncached read with no boundary | route silently goes dynamic | **build fails** |

The version-history row on the Route Segment Config reference is the load-bearing one: `dynamic`, `dynamicParams`, `revalidate` and `fetchCache` were *removed* in `v16.0.0` when Cache Components is enabled, and the documentation moved their reference material into a guide it titles **Caching and Revalidating (Previous Model)**. If your team turned the flag on, every blog post about `export const dynamic = 'force-dynamic'` is describing an API your build no longer has.

⚠️ One inconsistency worth naming rather than smoothing over: `dynamicParams` still appears in the current Route Segment Config option table (type `boolean`, default `true`) while the version history says it is removed under Cache Components. I could not confirm from the documentation which of the two statements is authoritative for 16.3.4. If you are on Cache Components and depend on `dynamicParams = false`, verify it against your own build rather than trusting either sentence.

## Reading what the build actually decided

Stop guessing from source. `next build` prints a route table with one symbol per route, and the four symbols are documented:

| Symbol | Name | Behaviour |
|---|---|---|
| `○` | Static | fully prerendered at build time; served without server rendering |
| `◐` | Partial Prerender | static shell served immediately, dynamic content streams in at request time |
| `●` | SSG | prerendered static HTML from `generateStaticParams` (or `getStaticProps` on the Pages Router) |
| `ƒ` | Dynamic | server-rendered on demand for each request |

`○`, `●` and `ƒ` are the classic three. `◐` only exists with Cache Components, and with it on, `ƒ` stops meaning "this page is dynamic" and starts meaning something much narrower: **the route has nothing at all to prerender** — a Route Handler that depends on the request, Proxy (the file formerly called Middleware), or dynamic metadata such as `icon` or `opengraph-image`.

Three more things the table tells you, all easy to misread:

- **A dynamic segment prints a fallback row for the pattern itself** (`/products/[id]`) plus one indented row per param returned by `generateStaticParams`. Those per-param rows can be `◐` rather than `○`: the *params* are known, but if the page's data lookup is still uncached, only the shell prerenders.
- **Routes containing cached functions gain `Revalidate` and `Expire` columns**, and a route reports the **shortest** revalidate and expire across every cache inside it. The table does not say which cache produced the number, so with several `cacheLife` calls in a route you have to go and look.
- **Long param lists are truncated** with a trailing `[+N more paths]` row, so "my page is missing from the build output" is sometimes just truncation.

⚠️ `next build` no longer prints JS bundle-size metrics — they were removed in `v16.0.0`. If a checklist of yours reads bundle sizes out of build output, it has been silently reading nothing.

### When the build fails and the stack trace is useless

Production builds minify server code and ship no server source maps, so a prerender error can point at `body (<anonymous>)`. The documented remedy:

```bash
next build --debug-prerender
```

That flag sets `experimental.serverMinification = false`, `experimental.turbopackMinify = false`, `experimental.serverSourceMaps = true` and `experimental.prerenderEarlyExit = false` — so you get readable frames *and* the build continues past the first failure instead of stopping, surfacing every blocked access in one run. 🔴 The documentation attaches an explicit warning: do not deploy a build produced with `--debug-prerender`; it skips optimisations you need in production.

In a large app, scope the rebuild to the route you are fighting:

```bash
next build --debug-build-paths="app/products/[id]/page.tsx"
next build --debug-build-paths="app/**/page.tsx,!app/admin/**"
```

Comma-separated paths, globs, `!` to exclude, and it combines with `--debug-prerender`. Routes under `src/` resolve with or without the prefix.

And the cheapest diagnostic of all: open the route in `next dev`. The Building guide notes that running it in development shows the full error immediately, with the component and line already resolved.

## Gotchas

**★ Symptom: one page shows fresh data at the top and build-time data at the bottom, or the reverse.** Cause: the positional rule. An unannotated `fetch` reachable before the first Request-time API is fetched once during `next build`; one discovered after it runs per request. Nothing in the call sites differs. Fix: never let position decide — state the intent on every call whose freshness matters.

```typescript
const plans = await fetch(`${API}/plans`, { next: { revalidate: 3600 } }) // cached on purpose
const me = await fetch(`${API}/me`, { cache: 'no-store' })                // fresh on purpose
```

**★ Symptom: an entire section of the app went dynamic in one deploy and no page in it changed.** Cause: a shared layout started reading the request — an A/B helper calling `headers()`, a theme cookie, a locale lookup. That read ends the prerender prefix at the top of the tree, so every unannotated fetch beneath it is now per-request. Fix: push the read into a leaf and put a boundary above it, so the layout itself stays prerenderable.

```tsx
// app/(app)/layout.tsx — the layout no longer reads the request
import { Suspense } from 'react'
import { ThemeBanner } from './theme-banner'

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="app">
      <Suspense fallback={null}>
        <ThemeBanner />
      </Suspense>
      {children}
    </div>
  )
}

// app/(app)/theme-banner.tsx — the cookie read lives here, behind the boundary
import { cookies } from 'next/headers'

export async function ThemeBanner() {
  const theme = (await cookies()).get('sd_theme')?.value ?? 'system'
  return <div data-theme={theme} />
}
```

**★ Symptom: "it renders on every request in dev, so it must be dynamic in production."** Cause: development never prerenders. The docs state it plainly for segment `revalidate` — in development, pages are *always* rendered on demand and are never cached, so changes show immediately. Dev tells you nothing about your rendering mode. Fix: read the route table from a production build, or scope one with `--debug-build-paths`.

**★ Symptom: a timestamp in the footer is stuck at the moment of the last deploy.** Cause: `new Date()` evaluated during prerendering is baked into the HTML. It is not a caching bug; the page is doing exactly what a prerendered page does. Fix: render the time on the client, or put it behind a boundary and force the request-time read explicitly.

```tsx
import { Suspense } from 'react'
import { connection } from 'next/server'

async function RenderedAt() {
  await connection() // this subtree is request-time, deliberately
  return <time dateTime={new Date().toISOString()}>{new Date().toLocaleString()}</time>
}

export default function Footer() {
  return (
    <Suspense fallback={<time>—</time>}>
      <RenderedAt />
    </Suspense>
  )
}
```

**Symptom: a `Math.random()`-based sample rate produces the same value for every visitor forever.** Cause: same mechanism as the timestamp — it ran once, during the build. Under Cache Components it can fail the build outright rather than silently freezing. Fix: move the randomness to the client, or gate it behind `await connection()` inside a boundary as above.

**★ Symptom: the build fails with `Next.js encountered uncached or runtime data during prerendering` and a stack that points at `body (<anonymous>)`.** Cause: Cache Components validation caught an uncached or request-time read outside a boundary, and production minification erased the frame. That error string and the `blocking-prerender-dynamic` identifier are quoted from the Building guide. Fix: rerun with source maps and no early exit, then apply one of the three documented remedies — stream it, cache it, or opt the route out of validation.

```bash
next build --debug-prerender --debug-build-paths="app/products/[id]/page.tsx"
```

**Symptom: you fixed the prerender error by adding `export const instant = false` and nothing got faster.** Cause: `instant = false` does not change how the route renders. Per the Building guide it only opts the route out of validation to *purposely allow a blocking route* — and unlike the streaming fix there is no fallback UI, so users see nothing until the lookup completes. Fix: use it only when blocking is the decision you meant; otherwise add the boundary.

```tsx
// app/products/[id]/loading.tsx — the fix that actually changes what users see
export default function Loading() {
  return <div>Loading…</div>
}
```

**Symptom: a param you listed in `generateStaticParams` shows `◐` instead of `○` and you assume the list did not take.** Cause: it did. The params are known; the page's data lookup is still uncached, so only the shell prerenders and the content streams. Fix: cache the lookup so it can run during prerendering.

```tsx
async function getProduct(id: string) {
  'use cache'
  const res = await fetch(`https://api.example.com/products/${id}`)
  return res.json()
}
```

**Symptom: a route shows `ƒ` under Cache Components and you go looking for the dynamic API.** Cause: with Cache Components on, `ƒ` means the route had **nothing** to prerender — Route Handlers that depend on the request, Proxy, and dynamic metadata files like `opengraph-image`. It is a category, not a diagnosis. Fix: check what kind of route it is before debugging it as a page.

**Symptom: two routes both revalidate far more often than their `cacheLife` says.** Cause: the `Revalidate` column reports the shortest revalidate across *every* cache in the route, and the table does not name which one. Fix: grep the route's `cacheLife` calls; the offender is whichever one you forgot about.

**Symptom: a deployed build behaves oddly and someone shipped it from a debugging session.** Cause: `--debug-prerender` disables minification and enables server source maps. The docs warn against deploying such a build. Fix: never let that flag reach CI — it belongs in a local reproduction, alongside `--debug-build-paths`.

**Symptom: you cannot find `dynamic` or `revalidate` in the Route Segment Config reference and conclude the docs are broken.** Cause: they are not there. In 16.x the reference table lists only `dynamicParams`, `runtime`, `preferredRegion` and `maxDuration` (plus `instant` and `prefetch` as their own pages); `dynamic`, `revalidate` and `fetchCache` moved into the *Previous Model* guide because Cache Components removes them. Fix: read [Caching and Revalidating (Previous Model)](https://nextjs.org/docs/app/guides/caching-without-cache-components) — and see [03b](03b-the-segment-config-surface.md), which is written against it.

## Interview questions

**★ What makes a route dynamic in the App Router?**
Reading request-specific data does. The glossary defines dynamic rendering as rendering at request time and states that a component becomes dynamic when it uses Request-time APIs — `cookies()`, `headers()`, `searchParams`, `draftMode()` — with `params` for an unlisted value and `connection()` behaving the same way. Prerendering is the default for everything else. The config flags do not cause dynamic rendering; they override the inference after the fact, and under Cache Components most of them do not exist.

**★ The same unannotated `fetch()` call appears twice in one component and behaves differently. How?**
Position. A fetch with no `cache` option is fetched once during `next build` if it is reachable before any Request-time API is used, because the route prerenders up to that point; a fetch discovered after such a read runs on every request. So a `cookies()` call between the two lines is the whole difference — and moving that call is a caching change that does not look like one in a diff. This is why the honest style is to annotate every fetch whose freshness matters instead of relying on where it sits.

**★ Why is `<Suspense>` a rendering-strategy concern rather than a loading-spinner concern?**
Because it is the declaration of where the static shell ends. The glossary says Suspense boundaries define where the shell stops and streaming begins, which is what makes Partial Prerendering possible. Under Cache Components it is load-bearing rather than optional: a request-time or uncached read with no boundary above it is a build failure, not a silently dynamic route. `loading.js` is the same mechanism with a file convention wrapped around a whole segment.

**★ Your route table shows `◐` for a page you expected to be `○`. What does that tell you, and what does it not?**
It tells you the shell prerendered and something in the page streams at request time — the route is partially prerendered, not dynamic. It does not tell you *what* streams. Usually it is either an uncached data access or a `cookies()`/`headers()`/`searchParams` read; the Building guide notes explicitly that pages reading those stay `◐`, streaming those parts into the shell on each visit. To find the cause you run the route in `next dev` or rebuild it with `--debug-prerender`.

**A colleague says "we upgraded to 16 and enabled Cache Components, so I removed all our `export const revalidate` lines." Was that right?**
Right for the wrong reason, and worth checking. Those exports are removed under Cache Components as of `v16.0.0`, so leaving them in place would be dead code at best. But deleting them without replacing the intent loses the cache lifetime entirely: under Cache Components the lifetime lives on `cacheLife` next to a `use cache` directive. A migration that deletes the flags and adds no `use cache` has converted a set of ISR routes into a set of routes that stream everything on every request.

**Why does `next dev` tell you nothing about whether your route is static?**
Because development never prerenders. The documentation states that in development pages are always rendered on demand and are never cached, so that you see changes immediately. Every route is effectively dynamic in dev. The only authoritative signal is the production route table, which is why `--debug-build-paths` exists — it makes getting that signal for one route cheap.

**What is the difference between `○ Static` and `● SSG` in the route table?**
`○` is a route fully prerendered at build time and served without server rendering. `●` is prerendered static HTML produced from `generateStaticParams` (or `getStaticProps` on the Pages Router) — the same output, but for a dynamic segment whose param values were enumerated. Practically, `●` is your evidence that `generateStaticParams` ran and produced paths; `○` on a dynamic segment's rows means the params were known *and* the data was cached.

**When would you deliberately choose a blocking route over streaming?**
When there is no useful shell. `export const instant = false` opts a route out of prerender validation and lets it block on its lookup; the trade-off documented is stark — there is no fallback UI, so users see nothing until the data arrives. That is occasionally the right call for a redirect-like route, a short-lived internal tool, or a page whose partial state would be actively misleading. It is the wrong call whenever a skeleton would have been honest, because a `loading.tsx` costs one file and turns a blank wait into an instant paint.

**How do you find out which of a route's caches is driving its `Revalidate` column?**
You cannot, from the table. A route reports the shortest `revalidate` and `expire` across every cache it contains, and the output does not name the source. With multiple `cacheLife` calls in a route you inspect them yourself. This is also why an accidental short profile deep in a shared component silently drags a whole route's revalidation frequency down — the same shape as the per-fetch `revalidate` rule in the previous model, where the lowest value in a route wins.

---

← [02c · Streaming after the shell](02c-streaming-after-the-shell-status-codes-errors-and-infrastructure.md) · [Chapter 4 overview](01-explanation.md) · Next → [03b · The segment config surface](03b-the-segment-config-surface.md)
