---
title: "Partial Prerendering is not a feature you switch on — it is what one render now produces: a static shell served from a CDN with holes that fill in at request time"
sidebar_label: "03 · Partial Prerendering (PPR)"
sidebar_position: 6
description: "What PPR actually is, the four rules that decide what lands in the static shell, why reading cookies() no longer makes a whole route dynamic, and the counter-intuitive fact that a Suspense boundary does not make anything dynamic."
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-09-04 for **Next.js 16.3.4** against [Caching](https://nextjs.org/docs/app/getting-started/caching) (docs `lastUpdated` 2026-08-25) — the *Prerendering* section, which is the **only** PPR reference that exists in 16.3.4 — and [`cacheComponents`](https://nextjs.org/docs/app/api-reference/config/next-config-js/cacheComponents) (`lastUpdated` 2026-06-22).
> Target: **Next.js 16.3.4**, App Router, Cache Components. Documentation-verified; **no sandbox run**.

**Every previous rendering model made staticness a property of the whole route: one runtime API call anywhere in the tree and the entire page rendered per request. Partial Prerendering ends that. A single render now produces two artefacts — a static shell that can sit on a CDN, and a set of holes that fill in at request time — and the unit of the decision moves from the route to the component. The practical consequence is the one that changes how you write pages: reading `cookies()` no longer costs you the page. It costs you the subtree you put behind a boundary. And the second consequence, which reads backwards until you understand the mechanism, is that a `<Suspense>` boundary does not make anything dynamic; it only says where a hole is *allowed* to be.**

⚠️ **A note on sourcing, because it affects what you can look up.** There is no standalone Partial Prerendering page in the 16.3.4 documentation — `/docs/app/getting-started/partial-prerendering` returns *"The URL … does not exist"*. PPR is documented inside the *Prerendering* section of the [Caching](https://nextjs.org/docs/app/getting-started/caching) page, with a one-line entry in the glossary. If you go looking for a PPR guide and find only blog posts from the 15-era experimental flag, that is why.

## What it produces

> *"This generates a static shell consisting of HTML for initial page loads and a serialized RSC Payload for client-side navigation, ensuring the browser receives fully rendered content instantly whether users navigate directly to the URL or transition from another page. This rendering approach is called **Partial Prerendering (PPR)**, the default behavior with Cache Components."*

Two artefacts from one render, for the two ways a user can arrive:

- **HTML**, for someone who typed the URL or followed a link from outside your app.
- **An RSC payload**, for someone already in your app clicking a `<Link>`.

Both are the *same shell*. That is the point — a route no longer has a fast path and a slow path depending on how it was reached.

> *"Every produced static shell can be served directly from a CDN, without going through to the upstream server. This makes direct navigations instant."*

🔴 **"Without going through to the upstream server" is the whole performance argument.** The shell is a static file. It does not wait for your database, your API, or a cold serverless instance. Whatever else is slow about your page, the first paint is not, because the first paint never touched your infrastructure.

## The four rules that decide what lands in the shell

At build time Next.js renders the tree and sorts every component by which APIs it touched. There are exactly four outcomes, and they are worth learning as a list because between them they cover everything you can write:

| What the component does | Where it ends up |
|---|---|
| `use cache` | *"the result is cached and included in the static shell, as long as its lifetime isn't too short"* |
| `<Suspense>` around uncached work | *"fallback UI is included in the static shell while the content streams at request time"* |
| Predictable values only | *"module imports, `fs.readFileSync`, and pure computations complete during prerender and are included in the static shell automatically"* |
| Random values and timestamps | `connection()` + `<Suspense>` for per-request, or `use cache` to share one value across users |

The first row's qualifier — *"as long as its lifetime isn't too short"* — is the threshold table in [02](02-the-use-cache-directive-and-custom-cachelife-profiles.md), and it is the most common reason cached content is missing from a shell that should contain it.

## One page, all three behaviours

This is what the model is for: static chrome, cached shared data and per-user content coexisting in a single route, none of them contaminating the others.

```tsx
// app/teams/[team]/board/page.tsx
import { Suspense } from 'react'
import { cookies } from 'next/headers'
import { cacheLife, cacheTag } from 'next/cache'

export default function BoardPage({ params }: PageProps<'/teams/[team]/board'>) {
  return (
    <main>
      {/* 1. Static. No I/O at all — this is in the shell. */}
      <header>
        <h1>Sprint board</h1>
        <BoardLegend />
      </header>

      {/* 2. Cached. Everyone on this team sees the same columns. In the shell. */}
      <Suspense fallback={<ColumnsSkeleton />}>
        <BoardColumns params={params} />
      </Suspense>

      {/* 3. Per-request. This user's unread count. A hole in the shell. */}
      <Suspense fallback={<NotificationsSkeleton />}>
        <NotificationBell />
      </Suspense>
    </main>
  )
}

async function BoardColumns({ params }: Pick<PageProps<'/teams/[team]/board'>, 'params'>) {
  const { team } = await params
  return <Columns columns={await getColumns(team)} />
}

async function getColumns(teamSlug: string) {
  'use cache'
  cacheLife('hours')
  cacheTag(`team-${teamSlug}-columns`)
  return db.columns.findByTeam(teamSlug)
}

async function NotificationBell() {
  const userId = (await cookies()).get('session')?.value
  const count = await db.notifications.countUnread(userId)
  return <Bell count={count} />
}
```

The shell that ships to the CDN contains the header, the legend, the board columns, and *both skeletons*. The notification count is a hole. Under the previous model that single `cookies()` read in `NotificationBell` would have made the entire route dynamic — header, legend, columns and all — and the page would have waited on the database before rendering a single byte.

## 🔴 The inversion: `cookies()` no longer costs you the route

This is the sentence to internalise, because it invalidates most Next.js advice written before 16:

> *"Reading `cookies()` here doesn't opt-in the whole route into dynamic rendering, the way the previous rendering model did. The Suspense boundary provides fallback UI where the runtime access streams, while static and cached content still ship in the initial HTML."*

The old advice — *"keep `cookies()` out of layouts"*, *"push auth checks to the client to preserve staticness"*, *"split the personalised part into a separate route"* — was correct for a model where dynamism was contagious across the whole route. It is now wasted effort at best. The correct move is smaller and local: put the read behind a boundary and leave everything else alone.

The runtime APIs this applies to are enumerated: `cookies` (*"User's cookie data"*), `headers` (*"Request headers"*), `searchParams` (*"URL query parameters"*), and `params` (*"Dynamic route parameters"*).

There is one shape where the escape does not exist, and it is worth knowing before you meet it:

> *"When a cookie or header value drives an attribute on the `<html>` element in the root layout (`lang`, `dir`, `data-theme`, etc.), reading it on the server makes the whole subtree request-bound, so there's no child to wrap in `<Suspense>`."*

You cannot put a boundary around an attribute of `<html>`, because the boundary would have to be its own parent. The documented answer is to set the attribute from an inline `<script>` in `<head>` before paint — which is the same technique used to avoid a theme flash, and now has a second reason to exist.

## 🔴 A `<Suspense>` boundary does not make anything dynamic

This one reads backwards, and getting it wrong produces a page full of boundaries that does not stream:

> *"`<Suspense>` provides a fallback UI while async work completes, but it does not itself opt a component into dynamic rendering. If a component only performs synchronous work, it will complete during prerendering regardless of whether it is wrapped in `<Suspense>`."*

A boundary is a **permission**, not an instruction. It says "if the thing inside me cannot finish at build time, that is allowed, and here is what to show meanwhile." If the thing inside *can* finish at build time, it does, and the fallback is never used.

```tsx
// This does NOT create a dynamic hole. `formatSprintDates` is pure, so it
// completes during the prerender and ships in the shell. The boundary is inert.
<Suspense fallback={<DatesSkeleton />}>
  <SprintDates dates={formatSprintDates(sprint)} />
</Suspense>
```

```tsx
// This creates a hole, because connection() explicitly defers to request time.
import { connection } from 'next/server'

async function LiveClock() {
  await connection()
  return <time>{new Date().toISOString()}</time>
}

<Suspense fallback={<ClockSkeleton />}>
  <LiveClock />
</Suspense>
```

The practical corollary: **wrapping something in `<Suspense>` is never a performance fix on its own.** If a component is slow because it is doing synchronous work, a boundary changes nothing — it still runs during the prerender, and the build still waits for it.

## Predictable and unpredictable values

Because a prerender must produce one answer that is correct for everybody, the framework has to be strict about anything that would differ between runs.

**Unpredictable.** `Math.random()`, `Date.now()`, `new Date()`, `crypto.randomUUID()`. Each has its own dev-overlay insight — `blocking-prerender-random`, `blocking-prerender-current-time`, `blocking-prerender-crypto` — and each has exactly two documented resolutions: call `connection()` first and put it behind a boundary, so it is genuinely per-request; or wrap it in `use cache`, so every user shares one value until revalidation.

```tsx
// Share one value across users — correct for a build id or a daily seed.
export default async function Page() {
  'use cache'
  const seed = crypto.randomUUID()
  return <FeaturedShuffle seed={seed} />
}
```

⚠️ One documented exception: *"`performance.now()` is meant for telemetry, so Next.js doesn't treat it as a value to guard."* You can call it during a prerender. Pass the result to a logger rather than rendering it.

**Predictable.** Module imports, `fs.readFileSync`, pure computation — all complete during prerender and land in the shell automatically. The category is broader than it looks:

> *"This includes queries to embedded databases with synchronous APIs, such as `better-sqlite3` or Node.js's built-in `node:sqlite`. If you need per-request data from a synchronous source, call `connection()` before the query."*

So a synchronous SQLite read is *baked into the shell at build time*, which is superb for a content site shipping its data alongside its code and completely wrong for a database that changes. The framework cannot tell which you have — it only knows the call was synchronous — so the burden is yours.

There is also a documented preference for where a request-independent read belongs:

```tsx
// Read once at module scope. It is the same for every request.
import { readFile } from 'node:fs/promises'

const content = await readFile('./config.json', 'utf-8')
const items = JSON.parse(content).items ?? []

export default function Page() {
  return <ItemList items={items} />
}
```

> *"Calling `await readFile()` inside the component would be treated as uncached data that must be either accessed within `use cache` or behind a `<Suspense>` boundary."*

Module scope, `use cache` and `<Suspense>` are three answers to the same question, and the choice is about *when the value can change*: never during the process's life → module scope; periodically → `use cache`; per request → a boundary.

## Gotchas

**★ Symptom: you wrap a slow component in `<Suspense>` and the build is still slow, with no streaming at runtime.** Cause: the component's work is synchronous, and a boundary does not opt anything into dynamic rendering — synchronous work completes during the prerender regardless of what surrounds it. Fix: if it must be deferred to request time, say so explicitly with `connection()`; if it is merely slow and shared, cache it so the cost is paid once.

**★ Symptom: a page reads one cookie and you assume the whole route is now dynamic, so you stop bothering with `use cache` elsewhere on it.** Cause: that was the previous model's behaviour and it no longer holds — the cookie read costs you the subtree behind its boundary, not the route. Fix: keep caching everything else; the header, nav and shared data still reach the shell.

**★ Symptom: a component that renders a timestamp fails the build even though it is inside `<Suspense>`.** Cause: the boundary permits a hole, it does not create one — `new Date()` during a prerender is still a prerender-time call and still fails. Fix: `await connection()` before the call, inside the boundary, which is what actually defers it:

```tsx
import { connection } from 'next/server'

async function RenderedAt() {
  await connection()          // ← this is the line that defers, not the boundary
  return <time>{new Date().toISOString()}</time>
}
```

**★ Symptom: a synchronous `better-sqlite3` or `node:sqlite` query returns data frozen at build time.** Cause: synchronous reads are classified as predictable and are completed during the prerender, so the rows are baked into the shell. Fix: if the data changes, call `connection()` before the query to force it to request time, or wrap it in `use cache` with a lifetime if a periodic refresh is enough.

**★ Symptom: you cannot find a way to put a `<Suspense>` boundary around a cookie-driven `lang` or `data-theme` on `<html>`.** Cause: there is no child to wrap — the value is an attribute of the element the boundary would have to live inside. Reading it on the server makes the whole subtree request-bound. Fix: set the attribute from an inline `<script>` in `<head>` before paint, which keeps the shell static.

**★ Symptom: you search the documentation for a Partial Prerendering page and find nothing, so you follow a 15-era tutorial about `experimental.ppr`.** Cause: there is no standalone PPR page in 16.3.4 — the URL 404s and the content lives inside the Caching page. The flag that tutorial tells you to set was removed in 16. Fix: `cacheComponents: true` is the whole configuration; see [01](01-the-explicit-caching-model-cachecomponents-build-flag-and-th.md).

**★ Symptom: a cached component is missing from the shell even though it has `use cache`.** Cause: the inclusion rule is conditional — *"as long as its lifetime isn't too short"* — and a profile with `expire` under five minutes or `stale` under thirty seconds is excluded from prerenders entirely. Fix: check the profile against the threshold table in [02](02-the-use-cache-directive-and-custom-cachelife-profiles.md); this is the single most common cause and it produces no error.

**★ Symptom: a boundary wrapped around a whole page satisfies the build, and every navigation flashes a full-page skeleton.** Cause: a boundary works wherever you put it, but everything inside it leaves the shell. Placing it at the top is the least useful position that still passes. Fix: push boundaries down to the smallest subtree that actually does the deferred work — the technique is **03b · maximizing the shell** *(not written yet)*.

## Interview questions

**★ What does Partial Prerendering actually produce, and why does that make a page fast?**
One render produces two artefacts: HTML for direct visits and a serialized RSC payload for client navigations, both representing the same static shell, plus a set of holes that resolve at request time. It is fast for a structural reason rather than an optimisation reason — the shell is a static file that can be served straight from a CDN without reaching the upstream server at all. So the first paint never waits on a database, an API or a cold serverless instance. Everything that is genuinely per-request still costs what it costs, but it costs it *after* the user is already looking at a rendered page rather than before.

**★ Why is "wrap it in `<Suspense>` to make it dynamic" wrong?**
Because a boundary is a permission, not an instruction. The documentation is explicit that `<Suspense>` does not itself opt a component into dynamic rendering, and that a component doing only synchronous work completes during prerendering whether or not it is wrapped. What the boundary does is declare that if the subtree inside it cannot finish at build time, that is acceptable, and here is the fallback to ship in the shell meanwhile. The thing that actually defers work to request time is the work itself being request-dependent — a runtime API, an uncached fetch, or an explicit `connection()` call. This matters practically because it means adding boundaries is never a performance fix by itself.

**★ How did the cost of reading `cookies()` change, and what advice does that invalidate?**
It went from route-scoped to subtree-scoped. Under the previous model a single `cookies()` call anywhere in the tree opted the whole route into dynamic rendering, so the entire page — header, nav, shared data — rendered per request. Under Cache Components the read costs only the subtree behind its `<Suspense>` boundary; static and cached content still ship in the initial HTML. That invalidates a whole generation of advice about keeping runtime APIs out of layouts, splitting personalised content into separate routes, or moving auth checks to the client to preserve staticness. The correct move now is local: wrap the read, leave the rest alone. The one shape with no escape is a cookie driving an attribute on `<html>` in the root layout, because there is no child to wrap.

**★ Why does the framework treat `Math.random()` as an error during prerendering but `performance.now()` as fine?**
Because a prerender has to produce one output that is correct for every future visitor, and anything that differs between executions cannot satisfy that. `Math.random()`, `Date.now()` and `crypto.randomUUID()` would each bake one arbitrary value into a document served to everyone, so the framework surfaces a specific insight for each and requires you to choose: `connection()` plus a boundary if the value must be per-request, or `use cache` if one shared value is actually what you want. `performance.now()` is exempted on the documented reasoning that it is a telemetry API — you are expected to pass its result to a logger, not render it — so guarding it would flag correct code.

**A synchronous SQLite query is treated as predictable and included in the shell. When is that great and when is it a bug?**
It is great when the data ships with the code — a documentation site, a marketing site with a content database, anything where a rebuild is the mechanism for a content change. The query runs once at build and the rows land in static HTML, which is the best possible outcome. It is a bug when the database is live, because the classification is based on the call being synchronous, not on whether the data changes: the framework has no way to tell an embedded content file from an embedded operational store. The result is a page frozen at build time with nothing to indicate it. The fix, documented explicitly, is to call `connection()` before the query when you need per-request data from a synchronous source.

**Where should a request-independent file read go, and why are there three possible answers?**
Module scope, `use cache`, or behind a `<Suspense>` boundary — and the choice is determined by when the value is allowed to change. If it never changes during the process's life, module scope is simplest and the documentation recommends it explicitly; the read happens once and the component stays synchronous. If it should be recomputed periodically and shared, `use cache` with a lifetime is right. If it depends on the request, it belongs behind a boundary. The trap is doing none of the three: an `await readFile()` inside a component body is treated as uncached data and must be handled one of those ways or the route will not build.

**Why is there no standalone PPR documentation page, and what does that tell you?**
Because PPR stopped being a feature. In 15 it was `experimental.ppr`, a flag with its own guide, something you opted into per route. In 16 it is what rendering does when `cacheComponents` is on — the flag and the `experimental_ppr` segment config were both removed rather than deprecated. So it is documented where it now belongs, inside the Caching page's *Prerendering* section, with a glossary entry. The practical consequence is that searching for a PPR guide surfaces mostly 15-era material describing an experimental flag that no longer exists, which is a real hazard when the tutorial's first instruction is to add configuration that will now do nothing.

---

← [10 · The three cache directives](10-the-three-cache-directives/README.md) · [Chapter index](01-explanation.md) · Next → **03b · Maximizing the shell** *(not written yet)*
