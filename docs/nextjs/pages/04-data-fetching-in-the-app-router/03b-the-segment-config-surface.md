---
title: "The four values of `dynamic`, the three of segment `revalidate` and the seven of `fetchCache`, read as what they actually do — and why `force-static` is the one that will hurt you, because it does not error, it lies"
sidebar_label: "03b · The segment config surface"
sidebar_position: 12
description: "Route segment config in Next.js 16, value by value: dynamic, revalidate, fetchCache, dynamicParams, generateStaticParams and the newer instant/prefetch options — with the cross-segment rules that decide which one wins."
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-09-03 for **Next.js 16.3.4** against [Caching and Revalidating (Previous Model)](https://nextjs.org/docs/app/guides/caching-without-cache-components) (docs `lastUpdated` 2026-08-25), [Route Segment Config](https://nextjs.org/docs/app/api-reference/file-conventions/route-segment-config) (`lastUpdated` 2026-04-30) and [`generateStaticParams`](https://nextjs.org/docs/app/api-reference/functions/generate-static-params) (`lastUpdated` 2026-08-25).
> Target: **Next.js 16.3.4**, App Router, Node >= 20.9. Documentation-verified; **no sandbox run**.

**These are the overrides. [03](03-static-vs-dynamic-rendering-force-dynamic-force-static-reval.md) covered the mechanism they override; this page is every value each one takes and what it costs. Read one thing first: in 16.3.4 the Route Segment Config reference no longer documents `dynamic`, `revalidate` or `fetchCache` at all. They moved to a guide titled *Caching and Revalidating (Previous Model)*, because `v16.0.0` removes them when `cacheComponents` is enabled. They are not deprecated for everyone — if the flag is off, they are exactly the API you have — but you are working in a model the framework has already labelled as the previous one. And the most quietly destructive value on this page is `force-static`, because it does not fail when you are wrong about it; it hands your code empty cookies and lets the render continue.**

## `dynamic` — four values, and only two of them are honest about failing

```tsx
// layout.tsx | page.tsx | route.ts
export const dynamic = 'auto'
// 'auto' | 'force-dynamic' | 'error' | 'force-static'
```

**`'auto'` (the default).** Cache as much as possible without preventing any component from opting into dynamic behaviour. This is the inference described in [03](03-static-vs-dynamic-rendering-force-dynamic-force-static-reval.md), and it is almost always what you want.

**`'force-dynamic'`.** Force dynamic rendering — the route is rendered for each user at request time. The documentation defines it by equivalence rather than by prose, which is more useful: it is the same as setting every `fetch()` in the layout or page to `{ cache: 'no-store', next: { revalidate: 0 } }` *and* setting `fetchCache = 'force-no-store'`. So it is not a hint. It reaches into every fetch in the segment and overrides the options you wrote, including a deliberate `force-cache`.

**`'error'`.** Force prerendering and cache the data, **causing an error if any component uses Request-time APIs or uncached data**. Equivalent to `getStaticProps()` in the Pages Router, to `{ cache: 'force-cache' }` on every fetch, and to `fetchCache = 'only-cache'`. This is the value almost nobody uses and most people should: it turns "this route must stay static" from a hope into a build failure.

**🔴 `'force-static'`.** Force prerendering and cache the data **by forcing `cookies`, `headers()` and `useSearchParams()` to return empty values.**

> *"forcing `cookies`, `headers()` and `useSearchParams()` to return empty values"*

That is the whole trap in one clause. `force-static` does not stop you reading the request; it makes the request appear to be empty. Code that does `(await cookies()).get('sd_session')` gets `undefined` and takes whichever branch it takes for a logged-out visitor — silently, at build time, and then serves that HTML to everyone.

```tsx
// app/(app)/board/page.tsx — 🔴 the bug that ships a logged-out page to logged-in users
export const dynamic = 'force-static'

import { cookies } from 'next/headers'

export default async function Board() {
  const session = (await cookies()).get('sd_session')?.value // always undefined here
  if (!session) return <SignInPrompt />                       // ...so this always renders
  return <BoardView session={session} />
}
```

The fix is not to remove the flag and hope. It is to say which guarantee you actually wanted:

```tsx
// You wanted "this route must stay prerenderable" — make it a build error, not a lie.
export const dynamic = 'error'

// Or you wanted a prerendered shell with a request-time slice. Delete the flag,
// keep the cookie read inside a boundary, and let the default inference work.
```

One thing `force-static` does keep: the documentation states it is still possible to use `revalidate`, `revalidatePath` or `revalidateTag` in pages and layouts rendered with it. So a `force-static` page is not frozen — it is ISR with the request blanked out.

## Segment `revalidate` — a default, not an override

```tsx
export const revalidate = false
// false | 0 | number
```

The sentence that settles every argument about precedence sits directly under that snippet: **this option does not override the `revalidate` value set by individual `fetch` requests.** The segment value is a floor-setting default; a `fetch` that states its own value keeps it.

- **`false`** (the default) — the heuristic described in [03](03-static-vs-dynamic-rendering-force-dynamic-force-static-reval.md): cache any `fetch` that sets `cache: 'force-cache'` or is discovered before a Request-time API. Semantically `Infinity`. Individual fetches can still use `no-store` or `revalidate: 0` to opt out and make the route dynamic.
- **`0`** — the layout or page is **always dynamically rendered**, even when no Request-time API and no uncached fetch is discovered. It changes the default of fetches with no `cache` option to `'no-store'`, but leaves fetches that opted into `'force-cache'` or a positive `revalidate` alone.
- **`number`** — seconds; the default revalidation frequency of the layout or page.

### Which value wins, precisely

Two rules, and they compose in a way that surprises people:

1. **The lowest `revalidate` across every layout and page of a single route determines the frequency of the entire route.** This exists so a child is revalidated at least as often as its parent layout.
2. **An individual `fetch` may set a lower value than the route default, and that raises the frequency of the entire route.** This is documented as a feature — a way to opt a route into more frequent revalidation based on some criterion.

So a 10-second ticker fetch buried in a shared header turns an hourly route into a 10-second route, for everything.

```tsx
// app/(marketing)/layout.tsx
export const revalidate = 3600 // the intent

// app/(marketing)/_components/status-banner.tsx
const status = await fetch(`${API}/status`, { next: { revalidate: 10 } }) // 🔴 the whole route is now 10s
```

The fix is to stop the short-lived read from participating in the route's static render at all:

```tsx
// app/(marketing)/layout.tsx
import { Suspense } from 'react'
import { StatusBanner } from './_components/status-banner'

export const revalidate = 3600

export default function MarketingLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <Suspense fallback={<div className="banner-skeleton" />}>
        <StatusBanner />
      </Suspense>
      {children}
    </>
  )
}
```

Three constraints on the value itself, all documented and all easy to trip:

- **It must be statically analyzable.** `revalidate = 600` is valid; `revalidate = 60 * 10` is **not**. There is no arithmetic and no imported constant.
- It is **not available** when using the deprecated `runtime = 'edge'`.
- **In development, pages are always rendered on demand and never cached**, so a revalidation window is unobservable in `next dev` by design.

## `fetchCache` — the advanced override, and the reason a parent can break a child

The documentation gates this one behind a collapsed block and an explicit warning that it should only be used if you specifically need to override the default behaviour. Seven values:

| Value | What it does to fetches with **no** `cache` option | What it does to fetches that **set** one |
|---|---|---|
| `'auto'` (default) | cached before Request-time APIs, not cached after | honoured |
| `'default-cache'` | defaults them to `'force-cache'` — even after a Request-time API | honoured |
| `'only-cache'` | defaults them to `'force-cache'` | **errors** on any `cache: 'no-store'` |
| `'force-cache'` | sets them to `'force-cache'` | **overridden** to `'force-cache'` |
| `'default-no-store'` | defaults them to `'no-store'` — even before a Request-time API | honoured |
| `'only-no-store'` | defaults them to `'no-store'` | **errors** on any `cache: 'force-cache'` |
| `'force-no-store'` | sets them to `'no-store'` | **overridden**, even an explicit `'force-cache'` |

The `only-*` values are assertions (they fail the build when violated); the `force-*` values are rewrites (they silently win). That distinction is the entire reason to prefer `only-cache` over `force-cache` when you are trying to guarantee something.

**Cross-segment rules**, which is where a change in a layout breaks a page three levels down:

- If both `'only-cache'` and `'force-cache'` appear in one route, `'force-cache'` wins. Same for `'only-no-store'` versus `'force-no-store'`. A single `force-*` segment suppresses the errors an `only-*` segment was there to raise.
- `'only-cache'` together with `'only-no-store'` in one route is **not allowed**. Neither is `'force-cache'` together with `'force-no-store'`.
- A parent may **not** provide `'default-no-store'` if a child provides `'auto'` or a `*-cache` value, because the same fetch would then behave differently depending on where it was reached from.
- The documentation's own recommendation: leave shared parent layouts on `'auto'` and customise where child segments diverge.

## `dynamicParams` — what happens to a path you did not enumerate

```tsx
export const dynamicParams = false // default is true
```

`true` (the default) generates unlisted paths on first request and caches the result. `false` serves **only** the paths `generateStaticParams` returned; anything else 404s — or, for a [catch-all segment](https://nextjs.org/docs/app/api-reference/file-conventions/dynamic-routes), matches the catch-all instead.

That makes `dynamicParams = false` a real security-adjacent tool, not just a performance one: it is how you guarantee a route cannot be probed with arbitrary slugs. It is also how a CMS launch goes wrong, because a post published after the last build is a 404 until you rebuild.

## `generateStaticParams` — the timing rules that decide whether it helps

The API shape is covered in the [chapter 4 overview](01-explanation.md) and at scale in [chapter 6](../06-ssg-isr-and-ssr-strategy/02-generatestaticparams-for-pre-rendering-dynamic-routes-at-sca.md). What belongs here is *when it runs*, because that is what makes it behave unexpectedly:

- During `next dev`, it is called **when you navigate to a route** — not once at startup.
- During `next build`, it runs **before** the corresponding layouts or pages are generated.
- 🔴 **During revalidation (ISR), it is not called again.** A new row in your database does not get prerendered by the next revalidation cycle. Only a new build enumerates new params.
- `fetch` requests are memoized across all `generate`-prefixed functions, layouts, pages and Server Components — so listing params and then fetching each one does not double the requests, provided the calls are identical.
- Params may be generated for segments **above** the current one, never below. `app/products/[category]/[product]/page.js` can generate both; `app/products/[category]/layout.js` can only generate `[category]`.

Two return-value rules that contradict each other across the two models, which is exactly the kind of thing that breaks an upgrade:

```tsx
// Cache Components OFF: an empty array is legal and means
// "prerender nothing at build; generate every path on first visit".
export async function generateStaticParams() {
  return []
}
```

> **You must always return an array**, even an empty one. Return nothing and the route is dynamically rendered instead.

```tsx
// Cache Components ON: an empty array is a BUILD ERROR — `empty-generate-static-params`.
// At least one param is required, so the framework can validate that the route does not
// illegally reach for cookies(), headers() or searchParams at runtime.
export async function generateStaticParams() {
  return [{ id: '1' }, { id: '2' }, { id: '3' }]
}
```

The documented escape hatch when you genuinely do not know any param at build time is a placeholder such as `[{ slug: '__placeholder__' }]` handled with `notFound()` in the page — and the docs attach their own warning to it: it prevents build-time validation from working effectively and may cause runtime errors. Use it knowing that, not instead of knowing it.

`generateStaticParams` also works in Route Handlers, which is how you statically generate API responses at build time — see [01d](01d-route-handlers-and-their-caching-model.md) for the handler caching model it plugs into.

## The rest of the surface

The current Route Segment Config table lists four options, plus two that have their own reference pages:

| Option | Type | Default |
|---|---|---|
| `dynamicParams` | `boolean` | `true` |
| `runtime` | `'nodejs'` \| `'edge'` **(deprecated)** | `'nodejs'` |
| `preferredRegion` | **deprecated** | `'auto'` |
| `maxDuration` | `number` | set by the deployment platform |
| `instant` | see [03](03-static-vs-dynamic-rendering-force-dynamic-force-static-reval.md) | — |
| `prefetch` | prefetch behaviour for the segment | — |

`export const experimental_ppr = true` was **removed in `v16.0.0`** and has a codemod; `runtime = "experimental-edge"` was deprecated back in `v15.0.0-RC`, also with a codemod.

## Gotchas

**★ Symptom: an authenticated page renders its logged-out state for everybody, and no error is logged anywhere.** Cause: `export const dynamic = 'force-static'` forces `cookies`, `headers()` and `useSearchParams()` to return empty values. Every auth check takes the anonymous branch during prerendering and that HTML is what ships. Fix: use `'error'` if the guarantee you wanted was "this must stay prerenderable", so a request-time read fails the build instead of returning nothing.

```tsx
export const dynamic = 'error' // build fails on cookies()/headers()/uncached data
```

**★ Symptom: you set `export const revalidate = 3600` and the route revalidates every ten seconds.** Cause: the segment value does not override per-`fetch` values, and the lowest `revalidate` in the route — across every layout, page and individual fetch — wins for the whole route. Fix: find the low value. If it is legitimate, isolate it behind a `<Suspense>` boundary so it does not participate in the route's static render.

**★ Symptom: `export const revalidate = 60 * 60` silently does nothing.** Cause: the value must be statically analyzable; `600` is valid, `60 * 10` is not. Fix: write the literal, and put the arithmetic in a comment.

```tsx
export const revalidate = 3600 // 1 hour — must be a literal, not 60 * 60
```

**★ Symptom: adding `force-dynamic` to fix a stale page made an unrelated cached API call start hammering the origin.** Cause: `force-dynamic` is equivalent to setting *every* fetch in the layout or page to `{ cache: 'no-store', next: { revalidate: 0 } }` plus `fetchCache = 'force-no-store'`. Your deliberate `force-cache` on a shared catalogue call was overridden with it. Fix: annotate the one call that needed freshness instead of the whole segment.

```typescript
const catalogue = await fetch(`${API}/plans`, { next: { revalidate: 600 } })
const live = await fetch(`${API}/board/${id}`, { cache: 'no-store' }) // just this one
```

**★ Symptom: a build that was supposed to fail on an uncached fetch passes.** Cause: someone put `fetchCache = 'force-cache'` in a parent layout. When `'only-cache'` and `'force-cache'` are both present in a route, `force-cache` wins — the `only-*` assertion stops raising. Fix: remove the `force-*` from the shared layout; the documentation's own advice is to leave shared parent layouts on `'auto'` and diverge in children.

**Symptom: a build errors on a combination of segment configs that each look reasonable.** Cause: `'only-cache'` with `'only-no-store'`, or `'force-cache'` with `'force-no-store'`, in a single route is not allowed — the `only-*`/`force-*` options exist to guarantee a route is *entirely* static or *entirely* dynamic. Fix: decide which the route is, and express the exception per-fetch.

**Symptom: a fetch behaves differently depending on which page reached the layout.** Cause: a parent providing `'default-no-store'` while a child provides `'auto'` or a `*-cache` value. The docs disallow exactly this because it makes one fetch's behaviour depend on its caller. Fix: move the `default-no-store` down to the segment that needs it.

**★ Symptom: a CMS post published this morning 404s, and republishing does not help.** Cause: `dynamicParams = false`. Only paths returned by `generateStaticParams` are served; everything else 404s. Fix: either remove the flag so unlisted paths are generated on first visit, or trigger a rebuild from the CMS webhook — a revalidation is not enough, because `generateStaticParams` is not called again during ISR.

```tsx
// Remove the guard so new slugs generate on demand and are cached afterwards.
export const dynamicParams = true // the default; delete the line entirely
```

**★ Symptom: rows added after the last deploy never get prerendered, however long you wait.** Cause: `generateStaticParams` is not re-executed during revalidation. ISR refreshes the *content* of known paths; it never discovers new ones. Fix: rebuild on publish, or accept on-demand generation for unlisted params by keeping `dynamicParams` at its default.

**Symptom: `generateStaticParams` returns nothing on an error path and the whole route quietly becomes dynamic.** Cause: the documented rule is that you must always return an array, even an empty one; returning nothing makes the route dynamically rendered. A `try`/`catch` that falls through without a `return` does exactly this. Fix: return `[]` explicitly on the failure path — and be aware `[]` becomes a build error under Cache Components.

```tsx
export async function generateStaticParams() {
  try {
    const teams = await fetch(`${API}/teams`).then((r) => r.json())
    return teams.map((t: { slug: string }) => ({ team: t.slug }))
  } catch {
    return [] // explicit: prerender nothing, generate on first visit
  }
}
```

**Symptom: an upgrade to Cache Components fails the build with `empty-generate-static-params`.** Cause: the empty-array idiom that was correct in the previous model is now an error; at least one param is required so the framework can validate the route's runtime data access. Fix: enumerate real params, or use the documented placeholder and handle it — knowing the docs warn that this defeats build-time validation.

**Symptom: `export const experimental_ppr = true` is not doing anything.** Cause: it was removed in `v16.0.0`. Fix: run the codemod and enable `cacheComponents` in `next.config.ts`; Partial Prerendering is the default rendering model there, not a per-route opt-in.

**Symptom: you cannot set `revalidate` on an Edge route.** Cause: the value is documented as unavailable with the deprecated `runtime = 'edge'`. Fix: move the route to the Node runtime — `runtime = 'edge'` is itself deprecated in this version, so this is a migration, not a workaround.

## Interview questions

**★ `export const revalidate = 3600` and a `fetch` in the same page with `next: { revalidate: 10 }`. Which wins?**
Ten seconds, for the whole route. The segment option is documented as not overriding the value set by individual fetch requests, and separately, the lowest `revalidate` across every layout, page and fetch in a route determines the revalidation frequency of the entire route. The framework treats a lower per-fetch value as a deliberate opt-in to more frequent revalidation. The practical consequence is that revalidation intervals are a minimum computed over a subtree, not a setting you own at one place.

**★ Why is `dynamic = 'error'` a better tool than `dynamic = 'force-static'` for "this page must stay static"?**
Because they fail in opposite directions. `'error'` causes an error if any component uses a Request-time API or uncached data, so a mistake stops the build. `'force-static'` prerenders anyway by forcing `cookies`, `headers()` and `useSearchParams()` to return empty values — so the same mistake produces plausible, wrong HTML that gets cached and served. One of those you find in CI; the other you find in a support ticket about users seeing each other's blank dashboards.

**★ What exactly does `force-dynamic` do to a `fetch` that already says `cache: 'force-cache'`?**
Overrides it. `force-dynamic` is documented as equivalent to setting every fetch in the layout or page to `{ cache: 'no-store', next: { revalidate: 0 } }` and setting `fetchCache = 'force-no-store'`, and `force-no-store` is explicitly described as forcing re-fetching on every request even for calls that provided `force-cache`. That is why reaching for `force-dynamic` to fix one stale widget is usually a mistake: it converts every read in the segment into an origin hit.

**What is the difference between the `only-*` and `force-*` values of `fetchCache`?**
`only-*` asserts, `force-*` rewrites. `'only-cache'` changes the default to `force-cache` and **errors** if any fetch uses `no-store`; `'force-cache'` simply sets every fetch to `force-cache` and says nothing. So `only-*` gives you a build-time guarantee and `force-*` gives you a silent behaviour change — and when both are present in one route, `force-*` wins and the assertion stops firing. If you want a rule the team cannot accidentally break, `only-*` is the one that tells you.

**★ A post published after the last deploy 404s. What are the two possible causes, and how do you tell them apart?**
Either `dynamicParams = false` — in which case only enumerated paths are served and everything else 404s by design — or the path is being generated on demand and the 404 comes from your own data layer, because the record is not visible to the build-time API user. Look at the route table first: with `dynamicParams = false`, the route has rows only for the enumerated params and no fallback row for the pattern. The fix differs completely: one is a config decision plus a rebuild-on-publish webhook, the other is a data or permissions bug.

**Why does adding rows to the database never expand the set of prerendered pages, even with ISR configured?**
Because `generateStaticParams` is not called again during revalidation. ISR is a mechanism for refreshing the content of paths the build already knows about. Discovering paths is a build-time activity. Anyone who expects a nightly revalidation to pick up new slugs has conflated the two — the options are to rebuild on publish, or to leave `dynamicParams` at `true` and let the first visitor pay for generation.

**Under Cache Components, why is an empty `generateStaticParams` a build error when it used to be an idiom?**
Because the return value now feeds validation, not just enumeration. With at least one param, the framework can prerender the route and check that it does not illegally reach for `cookies()`, `headers()` or `searchParams` at runtime. An empty array leaves nothing to validate against, so the build stops rather than shipping an unvalidated route. The documented placeholder workaround exists but explicitly weakens that validation, which is the trade-off you are accepting when you use it.

**Someone puts `fetchCache = 'default-no-store'` in a root layout to "make sure nothing is stale". What breaks?**
Two things. Structurally, it is disallowed in combination with a child that provides `'auto'` or a `*-cache` value, because the same fetch would behave differently depending on the route that reached it. Behaviourally, it converts every unannotated fetch in the whole application — including ones reached before any Request-time API, which would otherwise be fetched once at build — into a per-request origin call. It is the highest-blast-radius line in the segment config surface, and the documentation's advice is the opposite: leave shared parent layouts on `'auto'`.

---

← [03 · Static vs dynamic rendering](03-static-vs-dynamic-rendering-force-dynamic-force-static-reval.md) · [Chapter 4 overview](01-explanation.md) · Next → [03c · Diagnosing stale and unexpectedly dynamic routes](03c-diagnosing-stale-and-unexpectedly-dynamic-routes.md)
