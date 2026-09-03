---
sidebar_position: 2
title: "Partial Prefetching replaces per-link prefetching with one reusable App Shell per route, which means every existing prefetch={true} link in your codebase now delivers less than it used to"
sidebar_label: "2 · Partial Prefetching and the App Shell"
description: "What an App Shell is, how it is shared across every link to a route, what changes for each Link prop when partialPrefetching is on, and how to audit legacy prefetch={true} calls before flipping the flag."
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-09-03 against [Adopting Partial Prefetching](https://nextjs.org/docs/app/guides/adopting-partial-prefetching), [`partialPrefetching`](https://nextjs.org/docs/app/api-reference/config/next-config-js/partialPrefetching), [Optimizing prefetching](https://nextjs.org/docs/app/guides/optimizing-prefetching) and [`cacheLife`](https://nextjs.org/docs/app/api-reference/functions/cacheLife).
> Target: **Next.js 16.3.4** · `partialPrefetching` introduced in 16.3.0, requires `cacheComponents`.

**Before 16.3, a page with fifty links produced roughly fifty route prefetches, and `<Link prefetch={true}>` meant "fetch this destination's dynamic content too". Partial Prefetching inverts both. Next.js builds one App Shell per route and shares it across every link pointing there, so prefetch cost is bounded by route count rather than link count. The price of that is that `prefetch={true}` stops meaning "everything": flipping the flag makes some of your existing links deliver strictly less than they did. The migration is therefore an audit of every `prefetch={true}` in the codebase, not a config change.**

## What an App Shell is

With Partial Prefetching on, a `<Link>` prefetches the route's **App Shell**: its static
content plus the cached content that does not depend on the URL. Next.js builds **one App Shell
per route** and reuses it for every link pointing at that route, instead of prefetching each
link separately the way it used to.

The reference states the before-and-after in request terms:

Before Partial Prefetching, prefetching was **per visible link**: a page with N links to N
routes produced roughly N route prefetches as those links entered the viewport.

and gives the analogy that makes the model click:

The shape is the same as per-route code splitting in a single-page app — one artifact per
route, shared by every link that points to it.

A category grid with 200 cards pointing at `/store/[slug]` produces **one** App Shell, not 200 prefetches. App Shells are cached on the client, so every one of those cards reuses the same artifact.

## Session data lives in the shell; URL data cannot

The one thing people expect to be excluded but is not:

A route that reads `cookies()` or `headers()` produces an App Shell containing session data.
The framework detects that automatically and caches the shell **per session** on the client.

And the rule that follows from it:

The distinction that governs all of this: `cookies()` and `headers()` **do not tie a prefetch
to a URL**. They vary per *session*, not per link, so the App Shell can still carry session
content. Only `params` and `searchParams` are URL data — they vary per link, and therefore
cannot be part of a shared App Shell.

This is the test to run on every piece of content during the audit: **does it differ between two links pointing at the same route?** If yes, it is URL data and no shared artifact can carry it. If it only differs between two *users*, the shell carries it, cached per session on the client.

## What changes for every `<Link>`

This table is the migration in three rows, quoted from the adoption guide:

| `<Link>` prop | Before (Cache Components default) | After Partial Prefetching |
| --- | --- | --- |
| `<Link href="/x">` | Prefetched the cached page render. | Loads the shared App Shell for `/x`. |
| `<Link href="/x" prefetch>` | Prefetched the cached page render **and** any dynamic content. | Loads the App Shell, plus URL-specific content through per-link prefetching when `/x` reads it. |
| `<Link href="/x" prefetch={false}>` | Disabled prefetching for this link. | Unchanged. Still disabled. |

Read row two twice. `prefetch={true}` used to be the "give me everything" escape hatch; it is now a narrow, targeted instruction — resolve *this link's* `params`, `searchParams` and full URL ahead of the click, plus whatever cached content sits behind them. Anything that was dynamic and uncached is no longer included.

The docs state the consequence without softening it:

Once the flag is on, every `<Link>` prefetches its destination's App Shell and
`<Link prefetch={true}>` **no longer includes the route's dynamic content**. Existing
`prefetch={true}` links therefore need auditing to preserve what they used to deliver. A new
project has no legacy links and is finished at this step.

## The audit: five destinations, five answers

| Destination | Recommendation |
| --- | --- |
| Fully static, or content already cached | Remove the now-redundant `prefetch={true}`. |
| Delivered uncached content you want kept ahead of the click | Cache it with `use cache`, then remove `prefetch={true}`. |
| Delivered content that depends on `cookies()` or `headers()` | Cache the lookup behind the session value, then remove `prefetch={true}`. |
| Reads URL data, or has cached content that depends on it | Keep `prefetch={true}` to resolve the content ahead of the click. |
| Delivers real-time content that must stay fresh per request | Remove `prefetch={true}` and let the content stream in. |

### Static or already cached

The output is in the App Shell. The prop is noise:

```tsx title="app/nav.tsx"
// Before
<Link href="/about" prefetch={true}>About</Link>
// After
<Link href="/about">About</Link>
```

### Uncached content you wanted ahead of the click

Give it a cache lifetime so the shell can carry it, then drop the prop:

```tsx title="app/products/page.tsx"
// Before
export default async function Page() {
  const res = await fetch('https://api.example.com/products')
  return <ProductList products={await res.json()} />
}
```

```tsx title="app/products/page.tsx"
// After — cached, so the App Shell carries it
async function getProducts() {
  'use cache'
  const res = await fetch('https://api.example.com/products')
  return res.json()
}

export default async function Page() {
  return <ProductList products={await getProducts()} />
}
```

There is a threshold buried in this step that silently undoes the fix:

The App Shell carries cached content whose `stale` time is **at least 5 minutes** — true of the
`default` profile and of every preset except `seconds`. Anything shorter-lived streams in after
the navigation instead of riding along in the shell.

### Content behind `cookies()` or `headers()`

`'use cache'` cannot read `cookies()` inside the cached function. Read the runtime value *outside* and pass it in as an argument, so the entry is keyed on that value and every session sharing it shares the entry:

```tsx title="app/dashboard/page.tsx"
// Before
import { Suspense } from 'react'
import { cookies } from 'next/headers'

async function TeamTopics() {
  const team = (await cookies()).get('team')?.value
  const topics = await db.topics.forTeam(team)
  return <TopicList topics={topics} />
}

export default function Page() {
  return (
    <Suspense fallback={<Skeleton />}>
      <TeamTopics />
    </Suspense>
  )
}
```

```tsx title="app/dashboard/page.tsx"
// After — the lookup is cached behind the session value
import { Suspense } from 'react'
import { cookies } from 'next/headers'

async function getTopics(team: string | undefined) {
  'use cache'
  return db.topics.forTeam(team)
}

async function TeamTopics() {
  const team = (await cookies()).get('team')?.value
  return <TopicList topics={await getTopics(team)} />
}

export default function Page() {
  return (
    <Suspense fallback={<Skeleton />}>
      <TeamTopics />
    </Suspense>
  )
}
```

Traffic to the underlying data now scales with team count, not session count. Where the lookup is tied to a single session and the runtime read cannot be hoisted out — an auth helper that reads a cookie deep in its own code, or checks `Date.now()` against a token expiry — the alternative is `'use cache: private'`, which caches in the browser only and therefore helps the App Shell but never the static shell.

### Reads URL data

The one case where the prop stays. This is per-link prefetching, and it has its own cost model — see [3 · Per-link prefetching and incremental adoption](03-per-link-prefetching-and-incremental-adoption.md).

### Real-time content

Prefetching real-time content is pointless — it would be stale by the time the user clicked, so
there is nothing to preserve. Drop `prefetch={true}` and let the content stream in from behind
its `<Suspense>` boundary.

## Gotchas

**★ Flipping the flag makes some links deliver *less*, and nothing warns you at build time.**
`<Link prefetch={true}>` used to prefetch the cached page render *and* its dynamic content; it now loads the App Shell plus resolved URL data. Anything that was dynamic and uncached silently moves from "painted on click" to "streams in after the click". The insights that catch this are development-only and never block the build, so a team that flips the flag and ships without loading every route in `next dev` will not hear about it until users do. Audit every `prefetch={true}` *before* you flip, using the five-row table above.

**★ Caching something with a `stale` under five minutes does not put it in the shell.**
The App Shell carries cached content whose `stale` time is at least five minutes — every `cacheLife` preset qualifies except `seconds`. The symptom is maddening: you add `'use cache'`, the validation insight clears, and the content still streams in after every navigation. Either pick a profile with `stale` of five minutes or more, or accept that it streams and make the fallback good. The same five-minute floor governs whether `'use cache: private'` content can be carried ahead of a click for an opted-out segment.

**★ `'use cache'` cannot read `cookies()`, and wrapping the call site is the fix people miss.**
The directive requires a deterministic signature, so a `cookies()` call inside a `'use cache'` function is not allowed. The correct shape is to read the cookie in the calling component and pass the value as an argument — shown in full above — which has the additional benefit that sessions sharing the value share the cache entry. Only reach for `'use cache: private'` when the runtime read genuinely cannot be hoisted out.

**★ "It works for me" after the migration usually means you only tested the click path.**
The App Shell is what a *client navigation* receives. A direct visit gets the static shell, which is built by prerendering and cannot contain `'use cache: private'` results. A route can therefore look perfect while clicking around the app and block on every hard refresh or shared link. Test both paths — the two-test pattern in [ch. 13 · 10](../../13-testing-and-developer-experience/10-the-instant-playwright-helper.md) exists for this.

**★ Session content in the shell is a per-session client cache, not a shared server artifact.**
Because Next.js auto-detects `cookies()` / `headers()` reads and caches that route's shell per session on the client, the "one artifact per route" bound is really "one per route per session" for such routes. That is still bounded by route count for any one user, but it does mean a route that reads a cookie in a shared layout makes *every* route below it session-scoped — which is exactly the regression the `instant()` helper is designed to catch.

**★ Blanket `prefetch={false}` on a long list is now a pessimisation, not an optimisation.**
Under the old model, many links meant many prefetches, so disabling prefetch on lists was sound advice. It no longer is: *"The App Shell is shared across every link to a given route, regardless of dynamic params, so rendering many `<Link>`s to the same destination doesn't multiply the work."* A hundred cards pointing at `/store/[slug]` cost one App Shell. Turning prefetch off on all of them buys nothing and gives up the instant navigation. The cost you were worried about now attaches to `prefetch={true}`, not to the default.

**★ The audit is per destination, not per link.**
Four different components can link to `/dashboard`, and the fix for what its `prefetch={true}` used to deliver — caching the data, or caching the lookup behind a session value — lives in the destination's own files. Editing one link site and moving on leaves the other three links carrying a prop that no longer does what its author intended. Work through destinations, then sweep the links that point at each one.

**★ A new project has nothing to audit, and that is the only case where this is a one-line change.**
The adoption guide says so directly. If you are starting fresh, put both flags in `next.config.ts` on day one and let validation teach the structure as you write routes. Retrofitting is strictly harder than never having written `prefetch={true}` in the first place.

## Interview questions

**★ What replaced per-link prefetching, and why is that cheaper?**
One App Shell per route, shared by every link pointing at it. Before, a page with N links to N routes produced roughly N route prefetches as those links entered the viewport; now the number of prefetch artifacts is bounded by route count instead of link count, and App Shells are cached on the client so repeat links reuse them. The docs compare it to per-route code splitting in an SPA: one artifact per route.

**★ What does `<Link prefetch={true}>` mean now, and what did it mean before?**
Before, it prefetched the cached page render plus the destination's dynamic content. Now it loads the same App Shell every link gets, plus per-link prefetching: a fresh server render that resolves that link's `params`, `searchParams` and full URL, and the cached content behind them. It is narrower, more targeted, and costs a server invocation per prefetchable link.

**★ Why can session data live in a shared App Shell when `searchParams` cannot?**
Because the shell is shared across links to a route, not across users. `cookies()` and `headers()` vary per session, so Next.js detects them, includes the session-specific UI, and caches that shell per session on the client. `params` and `searchParams` vary between two links pointing at the same route, so no single shared artifact can contain them.

**★ Walk through auditing a `<Link href="/dashboard" prefetch={true}>` where the dashboard renders a team-specific topic list read from a cookie.**
That content is session data, not URL data, so the shared App Shell can carry it and the prop is no longer what delivers it. The work is to give the lookup a cache lifetime: read `cookies()` in the component, pass the team value into a `'use cache'` function, and remove `prefetch={true}` from every link to the route. The cache entry is keyed on the team value, so traffic to the database scales with team count rather than session count.

**★ You cached a fetch with `'use cache'` and the content still streams in after navigation. Give two plausible causes.**
Either the cache profile's `stale` time is under five minutes — the App Shell only carries cached content with `stale` of at least five minutes, which excludes the `seconds` preset — or the content depends on URL data, in which case no amount of caching puts it in the *shared* shell and you need `prefetch={true}` on the links to resolve it per link.

**★ A colleague proposes `prefetch={false}` on every card in a 100-item grid to cut prefetch traffic. Is that right?**
Not under Partial Prefetching. All hundred cards point at one route and therefore share a single App Shell — the docs note that rendering many links to the same destination does not multiply the work. Disabling prefetch on them gives up instant navigation for no saving. The cost worth managing is `prefetch={true}`, which is per visible link; the default `<Link>` is already cheap.

**★ Why is "remove `prefetch={true}`" the correct answer for a real-time widget?**
Because a prefetch of content that must be fresh per request is stale by the time of the click, so the prefetch buys nothing and costs a server invocation per visible link. The content should sit behind a `<Suspense>` boundary and stream in after navigation; the shell shows its fallback, which is the same UI the user would have seen either way.

---

← [1 · What \"instant\" means](01-what-instant-means.md) · [Topic index](README.md) · Next → [3 · Per-link prefetching and adoption](03-per-link-prefetching-and-incremental-adoption.md)
