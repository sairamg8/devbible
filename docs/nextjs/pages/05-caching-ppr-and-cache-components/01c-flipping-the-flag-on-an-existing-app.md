---
title: "Flipping `cacheComponents` on an app that already works: the exports that become build errors, the one opt-out that buys you time, and the two things it deliberately will not defer"
sidebar_label: "01c · Flipping the flag on an existing app"
sidebar_position: 3
description: "The order of operations for a real migration — every route segment config that is removed and what replaces it, the instant = false escape hatch and its two hard limits, the whole-app codemod, and why synchronous IO cannot be deferred."
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-09-04 for **Next.js 16.3.4** against [Migrating to Cache Components](https://nextjs.org/docs/app/guides/migrating-to-cache-components) (docs `lastUpdated` 2026-08-25), [`cacheComponents`](https://nextjs.org/docs/app/api-reference/config/next-config-js/cacheComponents) (`lastUpdated` 2026-06-22) and [Ensuring instant navigations](https://nextjs.org/docs/app/guides/instant-navigation) (`lastUpdated` 2026-08-25).
> Target: **Next.js 16.3.4**, App Router, Node.js runtime. Documentation-verified; **no sandbox run**.

**Turning the flag on in a greenfield app is a one-line change. Turning it on in an application that already serves traffic is a scheduling problem, because the flag is global, immediate, and converts three widely-used route segment exports into build errors the moment it flips. The migration guide's actual advice is not "fix everything" — it is "get the app building again first, with validation deferred, then convert one route at a time." That order matters, and there is exactly one class of problem the deferral does not cover. This page is the sequence, the complete removal table, and the two things `instant = false` will not save you from.**

## The order of operations

The guide is explicit that this is driven by tooling rather than by reading your own code:

> *"The migration is driven by **instant navigation validation**. With Cache Components enabled, Next.js validates in development whether navigating into each route renders instantly, and surfaces the code that would block it as an error or insight."*

Four steps, in this order:

1. **Enable the flag and delete the segment configs.** `dynamic`, `revalidate` and `fetchCache` become errors immediately — *"After enabling the flag, route segments that still export `dynamic`, `revalidate`, or `fetchCache` will error."* Routes that still render instantly need nothing further.
2. **Opt out everything that is not ready**, with the codemod below. The app builds and serves again, with validation deferred.
3. **Fix synchronous IO.** This step cannot be skipped or deferred, and it is the reason step 2 does not simply end the migration.
4. **Convert one route at a time**, removing its opt-out and resolving its insights.

The whole-app opt-out, verbatim:

```bash
npx @next/codemod@canary cache-components-instant-false ./app
```

> *"Pass `./src/app` in a `src/` project. A wrong path reports `0 ok` instead of failing, so check the file count."*

⚠️ **Read that second sentence as a bug report against the codemod.** Pointing it at a path that does not exist is not an error — it reports success having done nothing. If the file count looks low, you have run it against the wrong directory and are about to conclude the migration is easier than it is.

## The complete removal table

Every route segment config and caching API that changes, with the documentation's own verdict:

| Old surface | Verdict | What replaces it |
|---|---|---|
| `dynamic = 'force-dynamic'` | *"**Not needed.** All pages are dynamic by default."* | delete the export |
| `dynamic = 'force-static'` | *"Start by removing it."* | `use cache` + `cacheLife('max')`, as close to the data access as possible |
| `revalidate` | *"**Replace with `cacheLife`.**"* | `cacheLife('hours')` inside a `use cache` scope |
| `fetchCache` | *"**Not needed.** With `use cache`, all data fetching within a cached scope is automatically cached"* | `use cache` |
| `fetch` `cache` / `next` options | *"**Move `cache` and `next` options to `use cache`.**"* | `cacheLife` + `cacheTag` |
| `unstable_cache` | *"**Replace with `use cache`.**"* | the directive; arguments derive the key, so the key-parts array goes |
| `unstable_noStore()` | *"**Not needed.**"* | delete it; `connection()` + `<Suspense>` if it must run at request time |
| `dynamicParams` | 🔴 **not supported — build error** | `notFound()` in the page |
| `runtime = 'edge'` | *"**Not supported.** Cache Components requires the Node.js runtime."* | Node runtime; `proxy.ts` for edge behaviour |
| `experimental_ppr` | *"**Removed. Enable `cacheComponents` instead.**"* | nothing — PPR is the default |

Three of these are worth more than a table row.

### `dynamic = 'force-static'` is the one that can silently change behaviour

The other removals are mechanical. This one is not, because `force-static` did two things and only one of them has a replacement. It made the route prerender, and it **blanked** `cookies()` and `headers()` — a documented behaviour the corpus flags at [ch4 · 03b](../04-data-fetching-in-the-app-router/03b-the-segment-config-surface.md), where an auth check reading a blanked cookie silently takes the logged-out branch. The migration guidance says so directly:

> *"For runtime data access (`cookies()`, `headers()`, etc.), errors will direct you to wrap it with `<Suspense>`. Since you started by using `force-static`, you must remove the runtime data access to prevent any request time work."*

Read that as an instruction to **delete the read**, not to wrap it. If the page was `force-static`, whatever that `cookies()` call returned was empty anyway, so the branch it selected was the logged-out one. Wrapping it in `<Suspense>` does not preserve the old behaviour — it *changes* it, by making the read start working. That is usually the bug fix you wanted, but it is a behaviour change arriving in a migration commit, which is the worst place to discover one.

```tsx
// Before: force-static blanked this read, so `session` was always undefined
// and every visitor got the public nav. The code looked like it did more.
export const dynamic = 'force-static'

export default async function Layout({ children }) {
  const session = (await cookies()).get('session')?.value
  return <Nav session={session}>{children}</Nav>
}
```

```tsx
// After, honestly: the read never worked, so say so and keep the shell static.
export default function Layout({ children }) {
  return <Nav session={undefined}>{children}</Nav>
}
```

```tsx
// After, if the read was supposed to work: it now genuinely does — which is a
// behaviour change. Ship it deliberately, not as migration noise.
import { Suspense } from 'react'

export default function Layout({ children }) {
  return (
    <>
      <Suspense fallback={<PublicNav />}>
        <SessionNav />
      </Suspense>
      {children}
    </>
  )
}

async function SessionNav() {
  const session = (await cookies()).get('session')?.value
  return <Nav session={session} />
}
```

### `dynamicParams` does not have a replacement, it has a rewrite

It is not deprecated, it is rejected, and the build message is quotable:

> *"Route segment config \"dynamicParams\" is not compatible with `nextConfig.cacheComponents`."*

> *"Params not returned by `generateStaticParams` are rendered on request. If you used `dynamicParams: false` to reject them, call `notFound()` in the page when the param doesn't resolve to real data."*

The behaviour you had was *the framework* 404ing unknown params for you. The behaviour you now have is that unknown params render, and it is your job to decide they are invalid:

```tsx
// Before — the framework rejected anything not enumerated.
export const dynamicParams = false

export async function generateStaticParams() {
  const posts = await getPosts()
  return posts.map((post) => ({ slug: post.slug }))
}
```

```tsx
// After — you reject it, in the page, from real data.
import { notFound } from 'next/navigation'
import { Suspense } from 'react'

export async function generateStaticParams() {
  const posts = await getPosts()
  return posts.map((post) => ({ slug: post.slug }))
}

export default function Page({ params }: PageProps<'/blog/[slug]'>) {
  return (
    <Suspense fallback={<ArticleSkeleton />}>
      <Article params={params} />
    </Suspense>
  )
}

async function Article({ params }: Pick<PageProps<'/blog/[slug]'>, 'params'>) {
  const { slug } = await params
  const post = await getPost(slug)
  if (!post) notFound()
  return <article>{post.body}</article>
}
```

🔴 **This is a security-relevant change, not only an ergonomic one.** `dynamicParams = false` was a whitelist enforced by the framework. Its replacement is a `notFound()` call you have to remember to write, in every dynamic route that relied on it. A route where you delete the export and forget the check does not error — it starts serving whatever your data layer returns for an arbitrary attacker-supplied slug. Grep for the export before you delete it, and pair each deletion with the check in the same commit.

### `generateStaticParams` may no longer return an empty array

> *"Without Cache Components, returning `[]` defers every path to the first runtime visit. With Cache Components, `generateStaticParams` must return at least one param so Next.js can prerender the route and validate it produces a non-empty static shell. An empty array raises `empty-generate-static-params`."*

The documented pattern is to return a slice rather than everything — one param is enough to satisfy validation, and paths you leave out are still served:

> *"Paths you don't return are still served. Next.js prerenders a static shell for the unknown params and streams the rest at request time."*

⚠️ There is a documented placeholder escape hatch (`[{ slug: '__placeholder__' }]`), and the docs themselves warn it *"prevents build time validation from working effectively and may cause runtime errors."* Treat it as a last resort for a route whose params genuinely do not exist at build time, not as the default answer to the error. The scale version of this decision is [ch6 · 02d](../06-ssg-isr-and-ssr-strategy/02d-when-the-path-set-changes-and-what-cache-components-changes.md).

## `instant = false`, and the two things it will not do

```tsx
// app/dashboard/layout.tsx
export const instant = false
```

> *"`instant = false` marks a segment as *allowed to block*. It does not force the route to be dynamic, so a genuinely prerenderable route still ships a static shell."*

Its scope is narrower than people expect, and the guide states it precisely:

> *"With `false` on `/dashboard/layout.tsx`, validation no longer flags navigations into `/dashboard` from outside; navigations between `/dashboard/a` and `/dashboard/b` are still checked."*

So it silences *entry* into the segment, not everything beneath it. That is usually what you want during a migration and occasionally a surprise when insights keep appearing on a segment you thought you had switched off.

**The first thing it will not do: clear synchronous IO errors.**

> *"**Fix synchronous IO. It can't be deferred.** Calls like `new Date()`, `Date.now()`, `Math.random()`, and `crypto.randomUUID()` during prerender throw a build error that `instant = false` does not clear, so a route that uses them won't build until you address it, opt-out or not."*

This is the step that makes a "just run the codemod" migration stall, and the offending call is nearly always something innocuous — a copyright year, a cache-busting query string, a generated key.

```tsx
// ❌ Fails the prerender. `instant = false` does not help.
export default function Footer() {
  return <p>© {new Date().getFullYear()} SprintDesk</p>
}
```

```tsx
// ✅ Option 1 — it is a constant for a year at a time. Cache it.
import { cacheLife } from 'next/cache'

async function currentYear() {
  'use cache'
  cacheLife('days')
  return new Date().getFullYear()
}

export default async function Footer() {
  return <p>© {await currentYear()} SprintDesk</p>
}
```

```tsx
// ✅ Option 2 — it genuinely must be per-request. Defer and stream it.
import { connection } from 'next/server'
import { Suspense } from 'react'

async function RequestId() {
  await connection()
  return <span>{crypto.randomUUID()}</span>
}

export default function Footer() {
  return (
    <Suspense fallback={null}>
      <RequestId />
    </Suspense>
  )
}
```

**The second thing it will not do: make the navigation fast.**

> *"For opted-out segments, the navigation blocks on the server."*

The opt-out silences the *warning*, and the warning was true. A dashboard behind `instant = false` still blocks on every navigation into it; you have chosen not to be told. There is one documented way to keep a cookie-dependent segment fast without opting out at all:

> *"If the content depends on cookies or headers but has a known cache lifetime, caching it with `use cache: private` lets the App Shell carry it ahead of the click instead of opting out, as long as its `stale` time is at least 5 minutes."*

That five-minute threshold is a hard gate, not a suggestion — the full set of thresholds is at [10 · 04](10-the-three-cache-directives/04-use-cache-private.md).

## Gotchas

**★ Symptom: the codemod reports success and almost nothing changed.** Cause: it was pointed at a path that does not exist — a `src/` project needs `./src/app`, and a wrong path *"reports `0 ok` instead of failing"*. Fix: check the reported file count against the number of `page`/`layout`/`default` files you actually have before believing the migration is nearly done.

**★ Symptom: you opt a whole section out with `instant = false` and insights keep appearing inside it.** Cause: the opt-out silences validation for navigations *into* that segment from outside; navigations between siblings beneath it are still checked. Fix: this is working as designed — the remaining insights are about a different navigation than the one you silenced. Either fix them or opt out the specific inner segment.

**★ Symptom: the build fails on a footer copyright year, and `instant = false` does not help.** Cause: synchronous IO during prerender is an explicit exception to the opt-out — `new Date()`, `Date.now()`, `Math.random()` and `crypto.randomUUID()` all fail regardless. Fix: cache it if it is a shared value, or `connection()` plus `<Suspense>` if it must be per-request. Both forms are shown above.

**★ Symptom: after deleting `dynamicParams = false`, unknown slugs render a page instead of 404ing.** Cause: that is now the documented behaviour — params not returned by `generateStaticParams` are rendered on request, and rejecting them is your job. Fix: call `notFound()` in the page when the param does not resolve to real data, and treat the deletion and the check as one commit rather than two.

**★ Symptom: an auth-dependent nav starts showing logged-in content after the migration, on a page that was previously `force-static`.** Cause: `force-static` blanked `cookies()`, so the read silently returned nothing and the component took the logged-out branch. Removing the export makes the read work. Fix: decide which behaviour was intended. This is a real behaviour change and it belongs in its own commit with its own test, not buried in a migration diff.

**★ Symptom: dev shows insights, CI is green, and a blocking route ships.** Cause: *"Insights don't show up in the HTTP response. An offending route still returns `200` with rendered HTML in dev."* A pipeline that checks status codes cannot see them. Fix: gate on the `instant()` Playwright helper instead, which is the documented machine-checkable form — see **03c · instant-navigation validation** *(not written yet)*.

## Interview questions

**★ You enable `cacheComponents` on a 400-route application and get hundreds of build errors. What is the correct first move?**
Not fixing them. The documented sequence is to enable the flag, delete the three segment configs that now error, then run the `cache-components-instant-false` codemod so every page, layout and default that does not already declare `instant` gets the opt-out. That gets the application building and serving again with validation deferred, after which routes are converted one at a time. The one thing that sequence does not defer is synchronous IO during prerender, which fails the build whether the segment is opted out or not — so in practice you run the codemod and then immediately hunt down every `new Date()`, `Math.random()` and `crypto.randomUUID()` that executes during a prerender.

**★ Why is removing `dynamicParams = false` a security question rather than a cleanup?**
Because it was an enforced whitelist and its replacement is a convention. With the export, the framework rejected any param not returned by `generateStaticParams`. Without it, unknown params render on request, and the documented replacement is calling `notFound()` in the page when the param does not resolve to real data. A route where the export is deleted and the check is forgotten does not error or warn — it quietly starts serving whatever the data layer returns for an arbitrary supplied slug. The safe migration pairs each deletion with its `notFound()` in the same commit.

**★ What does `instant = false` actually do, and what are its limits?**
It marks a segment as allowed to block, which suppresses validation feedback for navigations into that segment from outside. It explicitly does *not* force the route to be dynamic — a genuinely prerenderable route still ships a static shell. It does not silence validation for navigations between sibling segments beneath it. And it does not clear synchronous IO build errors. The most important thing to understand about it is that it removes the warning rather than the problem: for an opted-out segment the navigation still blocks on the server, so it is a scheduling tool for a migration, not a fix.

**★ A page was `force-static` and read `cookies()`. What happens when you remove the export?**
The read starts working. Under `force-static` the cookie store was blanked, so the call returned nothing and the component took whatever branch corresponded to "no session" — usually the logged-out one. Removing the export means the read either has to be deleted, or wrapped in `<Suspense>` so it can run at request time; and if you wrap it, the branch selected changes. The documentation's guidance for a page that *was* `force-static` is to remove the runtime data access entirely, on the reasoning that it was not doing anything. Either way the important point is that this is a behaviour change, not a refactor, and discovering it in production after a large migration commit is the bad outcome.

**Both caching models can be active at once during a migration. When is leaving something on the old one the right call?**
When the value genuinely needs to survive deploys or serverless instance teardown, because that is the one axis where the old APIs are stronger. The `fetch` Data Cache and `unstable_cache` both persist across deployments and across instances; `use cache` does not, and neither does `use cache: remote`, because the build id is part of the cache key. The migration guide explicitly says the existing `fetch` and `unstable_cache` caching keeps working as a separate layer. So for an expensive call against a rate-limited third party, leaving it on `unstable_cache` while the rest of the app converts is a defensible, documented position rather than an unfinished migration — the alternative is a cold cache against that upstream at every release.

---

← [01b · What the model costs](01b-what-the-model-costs-persistence-storage-and-the-runtime-floor.md) · [Chapter index](01-explanation.md) · Next → [01d · What changes once the flag is on](01d-what-changes-once-the-flag-is-on.md)
