---
title: "You declared a lifetime — now here is every way it can end, including the four that discard your data without anyone calling an invalidation API"
sidebar_label: "04 · Revalidation: every way a lifetime ends"
sidebar_position: 10
description: "The complete inventory of things that stop a cached value being served: time, the four invalidation APIs, the two re-render calls that invalidate nothing, four environmental causes nobody calls, and the silent no-ops."
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-09-04 for **Next.js 16.3.4** against [How revalidation works](https://nextjs.org/docs/app/guides/how-revalidation-works) (docs `lastUpdated` 2026-06-01), [`cacheLife`](https://nextjs.org/docs/app/api-reference/functions/cacheLife) (`lastUpdated` 2026-08-25), [`revalidateTag`](https://nextjs.org/docs/app/api-reference/functions/revalidateTag), [`updateTag`](https://nextjs.org/docs/app/api-reference/functions/updateTag), [`refresh`](https://nextjs.org/docs/app/api-reference/functions/refresh) (`lastUpdated` 2026-06-25), [`useRouter`](https://nextjs.org/docs/app/api-reference/functions/use-router) and the [Server Actions guide](https://nextjs.org/docs/app/guides/server-actions).
> Target: **Next.js 16.3.4**, App Router, Cache Components. Documentation-verified; **no sandbox run**.
> Validated: 2026-09-05 · claims + version spine re-checked against the Next.js 16.3.4 docs · session d2e9b9fe

**Chapter 5 is about declaring that a value may be reused. This page is the other half of that contract: the complete list of events that end the reuse. It exists because the list is longer than almost anyone assumes — people know the four invalidation APIs and stop there, when in practice the four most common causes of "my cached data vanished" are environmental and nobody called anything at all. It also exists because two of the calls people reach for during a mutation, `refresh()` and `router.refresh()`, do not invalidate any cache — they re-render, which looks identical until the render reads the same cached value back and the bug survives the fix.**

⚠️ **Scope, so this page complements rather than repeats.** The *tuning* question — what number to pick, how a revalidation window becomes an origin-load ceiling, staleness budgets and the stampede — is chapter 6's, at [ch6 · 03](../06-ssg-isr-and-ssr-strategy/03-isr-at-enterprise-level-stale-while-revalidate-tuning.md) and its chunks. The *API surface* of `revalidateTag` and `updateTag` — signatures, the deprecated single-argument form, tag limits — is [10 · 05b](10-the-three-cache-directives/05b-revalidatetag-and-updatetag.md). The five-way *decision* between them for a given mutation is [ch8 · 10b](../08-state-management-in-an-rsc-world/10b-refresh-against-the-alternatives.md). What is here and nowhere else is the **inventory**: everything that ends a lifetime, in one list, so that "why did this change" and "why won't this change" both have somewhere to start.

## The inventory

| # | What ends the lifetime | Blocking? | Who triggers it |
|---|---|---|---|
| 1 | `revalidate` elapses | no — stale served | time |
| 2 | `expire` elapses with no traffic | 🔴 yes | time |
| 3 | `revalidateTag(tag, 'max')` | no — stale served | you |
| 4 | `revalidateTag(tag, { expire: 0 })` | 🔴 yes | you |
| 5 | `updateTag(tag)` | 🔴 yes | you, in a Server Action only |
| 6 | `revalidatePath(path, type)` | no — lazy | you |
| 7 | `refresh()` | n/a — **invalidates nothing** | you, in a Server Action only |
| 8 | `router.refresh()` | n/a — **client only** | you, on the client |
| 9 | A new deployment | 🔴 yes, everywhere | nobody |
| 10 | Serverless instance teardown | 🔴 yes | nobody |
| 11 | Draft Mode | n/a — nothing is stored | nobody |
| 12 | A cache write failing | no — silent | nobody |
| 13 | The client `stale` window elapsing | no | time, on the client |
| 14 | Any Server Action invalidation call | — clears the **whole** client cache | you, as a side effect |
| 15 | An oversized tag | 🔴 **nothing happens at all** | you, by accident |

Rows 9–12 are the ones that matter most in an incident, because nobody wrote a line of code that caused them.

## Time (1–2)

The two time-based endings are not variations of each other — one is invisible and one is a latency spike.

> *"`revalidate`: After this time, the next request will trigger a background refresh"*
> *"`expire`: After this time with no requests, the next one waits for fresh content"*

`revalidate` is stale-while-revalidate: the request that trips it is served the old value and a refresh happens behind it. Nobody waits.

🔴 **`expire` is the opposite, and it is traffic-shaped.** *"After this period with no traffic, the server regenerates content synchronously on the next request."* So `expire` only fires on entries nobody is asking for — which means the person who trips it is, by definition, the first visitor after a quiet period. On a low-traffic route, or any route overnight, that is a real user waiting for a full render. A long `expire` is not laziness; it is the difference between a background refresh and a blocking one for your least-frequent visitors.

The constraint the config validates: `expire` must be longer than `revalidate`, and Next.js errors on configurations where it is not.

## The four invalidation calls (3–6)

These are covered in depth at [10 · 05b](10-the-three-cache-directives/05b-revalidatetag-and-updatetag.md); what belongs here is only which of them makes someone wait.

**`revalidateTag(tag, profile)`** takes a required profile that decides the answer:

- `'max'` — *"A one year window, long enough that requests are always served stale content while the revalidation runs."* Nobody waits. This is the stampede-safe choice.
- `{ expire: 0 }` — *"Stale content is never served, so the next request is a blocking revalidate/cache miss."*

⚠️ The bare single-argument `revalidateTag(tag)` is **deprecated and behaves like `{ expire: 0 }`** — the blocking one. Code written before the second argument existed is therefore doing the expensive thing, silently, and will keep doing it until someone reads this sentence.

**`updateTag(tag)`** is the read-your-own-writes call, and it is deliberately blocking: *"`updateTag` immediately expires the cached data for the specified tag. The next request will wait to fetch fresh data rather than serving stale content from the cache."* It can **only** be called from a Server Action.

**`revalidatePath(path, type)`** rides the tag system through auto-generated soft tags prefixed `_N_T_`, and from a Route Handler it is lazy: *"Marks the path for revalidation. The revalidation is done on the next visit to the specified path."* From a Server Function the docs claim more — *"Updates the UI immediately (if viewing the affected path)"* — because that is one of the calls that ships a re-render with the action's response. Its blast radius is wider than it looks and is worked through at [ch6 · 03c](../06-ssg-isr-and-ssr-strategy/03c-revalidate-budgets-and-time-based-versus-on-demand.md).

## 🔴 The two that invalidate nothing (7–8)

This is the section that saves an afternoon.

> *"`refresh`: refetch the current route's RSC Payload without invalidating cached data. Use when the view depends on state outside the cache that the action just changed."*

> *"`router.refresh()`: … This clears the Client Cache for the current route, but does **not** invalidate the server-side cache."*

Both re-render. Neither expires anything on the server. So this is a bug that looks exactly like a fix:

```ts
// ❌ The action mutates, then re-renders — and the re-render reads the SAME
// cached value straight back. The UI is refreshed and still wrong.
'use server'
import { refresh } from 'next/cache'

export async function completeTask(taskId: string) {
  await db.tasks.complete(taskId)
  refresh()
}
```

```ts
// ✅ Expire the tag the cached read is filed under, THEN the re-render has
// something new to find. updateTag makes the next read wait for fresh data.
'use server'
import { updateTag } from 'next/cache'

export async function completeTask(taskId: string) {
  const task = await db.tasks.complete(taskId)
  updateTag(`team-${task.teamSlug}-tasks`)
}
```

The documentation is explicit that `refresh` has a legitimate and different purpose — *"when the view depends on state outside the cache that the action just changed"*. Cookie-derived state is the standard case: nothing cached changed, but the request now means something different.

⚠️ **The docs do not describe calling `refresh()` more than once in one action.** Treat repeated calls as unspecified rather than assuming they compose.

## The four nobody triggers (9–12)

**9 · A new deployment.** Every `use cache` entry is gone, including durable `remote` ones, because the build id is part of the cache key. This is the largest single invalidation event in most applications and it is on your release schedule, not your cache configuration. The full argument is [01b](01b-what-the-model-costs-persistence-storage-and-the-runtime-floor.md).

**10 · Serverless instance teardown.** The default store is per-instance and in-memory, and on serverless *"cache entries typically don't persist across requests"*. No event fires; the entry simply was never anywhere durable.

**11 · Draft Mode.** Every cached function re-executes per request and results are not saved. Correct for a preview, and a trap for anyone benchmarking with it on.

**12 · A cache write failing.** The most invisible of the four:

> *"Cache write failure: the response is still served to the user because writes are asynchronous. The cache entry is lost, and the next request triggers a fresh render."*

Nothing errors, the user sees a correct page, and your hit rate quietly drops. The companion rule matters if you write a handler: a cache **read** failure must return `undefined` to signal a miss, because *"a thrown error is not treated as a cache miss; it propagates as a render error."* The handler contract is [ch6 · 03d](../06-ssg-isr-and-ssr-strategy/03d-the-cache-is-not-one-thing.md).

The framework's own summary of this whole category is worth memorising, because it explains why all four are silent:

> *"Cache failures result in degraded performance (stale content, extra renders), not broken applications."*
> *"The revalidation system prioritizes availability over strict consistency."*

## The client (13–14)

**13 · The `stale` window elapses.** The browser's copy is governed by `stale` alone, with an enforced 30-second minimum ([02](02-the-use-cache-directive-and-custom-cachelife-profiles.md)).

**14 · A Server Action invalidation clears the *entire* client cache.** Calling `revalidateTag`, `revalidatePath`, `updateTag` or `refresh` from a Server Action immediately clears the whole client cache, bypassing stale time — not just the tag you named. That is why a small, targeted server-side invalidation can produce a broad client-side refetch, and why the client feels much more responsive to invalidation than the tag scope suggests.

There is a related asymmetry in what ships back with the action's response:

> *"When `updateTag`, `revalidatePath`, or `refresh` runs, Next.js re-renders the current route server-side and includes a newly rendered RSC Payload in the action's response, so the page reflects the change in the same roundtrip. `revalidateTag` with a stale-while-revalidate profile intentionally skips that immediate re-render."*

**So `revalidateTag` deliberately does not update the screen in the same round trip.** If you used it after a mutation and the user does not see their change, that is the documented behaviour, not a bug — `updateTag` is the call that waits.

## 15 · The one where nothing happens

> *"A tag that exceeds the limit is never assigned to cached data, so revalidating it does nothing."*

Tags are capped at 256 characters, and a single `cacheTag()` call accepts at most 128 of them; anything beyond either limit is dropped with a console warning. An over-long tag is therefore never attached in the first place, so the `revalidateTag` call that names it succeeds, returns nothing, and invalidates nothing — forever. Composed tags are where this happens:

```ts
// ❌ With a long tenant id and a long slug this can exceed 256 characters.
// It is dropped at write time; the invalidation is a permanent no-op.
cacheTag(`tenant-${tenantId}-workspace-${workspaceId}-board-${boardSlug}-tasks`)
```

```ts
// ✅ Hash the composite. Bounded length, same uniqueness.
import { createHash } from 'node:crypto'

function boardTag(tenantId: string, workspaceId: string, boardSlug: string) {
  const digest = createHash('sha256')
    .update(`${tenantId}:${workspaceId}:${boardSlug}`)
    .digest('hex')
    .slice(0, 32)
  return `board-${digest}`
}
```

The other silent no-ops — a case-mismatched tag, a path that went through a rewrite — are enumerated at [ch6 · 03c](../06-ssg-isr-and-ssr-strategy/03c-revalidate-budgets-and-time-based-versus-on-demand.md).

## Gotchas

**★ Symptom: a Server Action mutates, calls `refresh()`, and the UI still shows the old value.** Cause: `refresh` refetches the RSC payload *without invalidating cached data*, so the re-render reads the same cache entry back. The screen genuinely refreshed; the data behind it did not change. Fix: expire the tag first with `updateTag`, then the re-render has something new to read. Use `refresh` only when the changed state is outside the cache.

**★ Symptom: `router.refresh()` on the client does not pick up a server-side change.** Cause: it clears the Client Cache for the current route and explicitly does not invalidate the server-side cache — so the server answers from the same entry. Fix: invalidate on the server in the action; the client-side call is for discarding the browser's copy, not the server's.

**★ Symptom: a user does not see their own write after a `revalidateTag` call, though other users do a moment later.** Cause: `revalidateTag` with a stale-while-revalidate profile intentionally skips the immediate re-render, so the action's response does not carry fresh data. Fix: use `updateTag` for read-your-own-writes, which expires the tag and makes the next read — including the re-render shipped with the action's response — wait for fresh data.

**★ Symptom: a legacy `revalidateTag('posts')` call causes a latency spike under load.** Cause: the single-argument form is deprecated and behaves like `{ expire: 0 }` — stale is never served, so the next request blocks on a full regeneration. Fix: pass a profile. `'max'` serves stale while refreshing, which is the stampede-safe behaviour most callers wanted:

```ts
revalidateTag('posts', 'max')
```

**★ Symptom: a low-traffic route is fast all day and slow first thing every morning.** Cause: `expire` fires after a period with **no traffic**, and regenerates synchronously on the next request. The first visitor after the quiet period pays for a full render. Fix: lengthen `expire` so overnight quiet does not exceed it, or accept it and keep the route warm deliberately.

**★ Symptom: cache hit rate is poor and no error appears anywhere.** Cause: cache writes are asynchronous, so a write failure loses the entry while still serving the user a correct response. It degrades performance without breaking anything, which is the documented design. Fix: instrument the handler rather than looking for errors in the application — this class of failure is deliberately silent.

**★ Symptom: `revalidateTag` on a composed tenant tag has never worked, and no error was ever logged.** Cause: the tag exceeded 256 characters, so it was never assigned to the cached data at write time — the invalidation names a tag nothing carries. Fix: hash the composite to a bounded length, and check for the console warning at the `cacheTag` call rather than at the `revalidateTag` one.

**★ Symptom: a targeted `updateTag` on one tag appears to refetch half the application on the client.** Cause: calling any of the four invalidation APIs from a Server Action clears the entire client cache immediately, bypassing stale time — the tag scopes the *server* invalidation, not the client one. Fix: nothing to fix; this is documented behaviour. Expect broader client refetching than the tag name suggests, and do not conclude your tags are wrong.

**★ Symptom: you benchmark caching and every request is a miss.** Cause: Draft Mode re-executes cached functions per request and does not save results. Fix: benchmark with Draft Mode off; the preview path is supposed to be uncached.

## Interview questions

**★ A Server Action writes to the database and calls `refresh()`. The UI does not update. Why?**
Because `refresh` re-renders without invalidating anything. Its documented purpose is refetching the current route's RSC payload *without* invalidating cached data, for the case where the view depends on state outside the cache that the action just changed — a cookie, for instance. If the value on screen comes from a `use cache` function, the re-render reads the same entry back and produces identical output. The fix is to expire the tag the cached read is filed under, with `updateTag` for read-your-own-writes, and let the re-render that ships with the action's response find fresh data. The reason this is a hard bug is that the mechanism *did* work — the page really did re-render — so the symptom looks like a caching problem at a completely different layer.

**★ Which endings block a user, and which do not?**
Blocking: `expire` elapsing after a quiet period, since the server regenerates synchronously on the next request; `updateTag`, which is deliberately blocking so the user sees their own write; `revalidateTag` with `{ expire: 0 }` or with no second argument at all, since the deprecated single-argument form behaves the same way; a new deployment, which starts every entry cold; and an instance teardown on serverless. Non-blocking: `revalidate` elapsing, which serves stale while refreshing behind it; `revalidateTag` with a profile like `'max'`; `revalidatePath`, which marks entries and regenerates lazily on the next request; and a failed cache write, which is invisible. The practical upshot is that the two most common blocking events — a deploy and an `expire` after quiet traffic — are the two nobody configured.

**★ Why is `expire` more dangerous on a low-traffic route than a high-traffic one?**
Because it is defined in terms of the *absence* of requests: after that period with no traffic, the server regenerates content synchronously on the next request. On a busy route the entry is refreshed by `revalidate` long before `expire` is reachable, so it effectively never fires. On a quiet route — an internal admin page, a regional site overnight, anything with a diurnal pattern — the gap between visits routinely exceeds `expire`, and the person who trips it is the first visitor of the day, who waits for a full render. So the cost of a short `expire` lands entirely on the users who arrive after a lull, which is close to the worst possible distribution.

**★ Four things end a cached value's life without anyone calling an API. Name them.**
A new deployment, because the build id is part of the cache key, so every entry is unreachable after a release including durable remote ones. Serverless instance teardown, because the default store is per-instance and in-memory and does not persist across requests on serverless. Draft Mode, which re-executes every cached function per request and saves nothing. And a failed cache write, which loses the entry while still serving the user a correct response because writes are asynchronous. All four are silent, which follows from the documented design principle that cache failures should produce degraded performance rather than broken applications — the system prioritises availability over strict consistency.

**★ Why can a `revalidateTag` call be a permanent no-op with no error?**
Because tags are validated at *write* time, not at invalidation time. A single `cacheTag()` call accepts up to 128 tags of at most 256 characters each; anything over either limit is dropped with a console warning. So an over-long tag is never attached to the cached data at all, and the later `revalidateTag` naming it succeeds and invalidates nothing — permanently, and with no error at the call site you are debugging. The realistic way to produce one is a composed tag built from several identifiers, which is exactly the shape multi-tenant applications use. Hashing the composite to a fixed length keeps the uniqueness and removes the failure mode.

**Why does a targeted server-side invalidation clear the whole client cache?**
Because the two caches are invalidated by different mechanisms with different granularity. The tag scopes the server-side invalidation precisely. But calling any of `revalidateTag`, `revalidatePath`, `updateTag` or `refresh` from a Server Action immediately clears the client cache in its entirety, bypassing stale time — the client is not told which tag was involved. It is a blunt instrument by design: the client's copies are cheap to refetch and the alternative is showing a user data you have just declared stale. The practical consequence is that client-side refetching after a mutation is broader than the tag name implies, which people frequently misread as evidence that their tags are wrong.

**Why does `revalidateTag` not update the screen in the same round trip when `updateTag` does?**
Because they express different intentions and the framework acts on the difference. `updateTag`, `revalidatePath` and `refresh` all cause Next.js to re-render the current route server-side and include a fresh RSC payload in the action's response, so the change is visible in the same round trip. `revalidateTag` with a stale-while-revalidate profile intentionally skips that re-render — the whole point of the profile is that stale content continues to be served while a refresh happens in the background, so waiting for fresh data in the action's response would contradict it. That makes the choice a product decision rather than a technical one: `updateTag` when the user must see their own write, `revalidateTag` when a background refresh is enough and you would rather nobody waited.

---

← [03c · Validation, DevTools and CI](03c-instant-navigation-validation-devtools-and-proving-it-in-ci.md) · [Chapter index](01-explanation.md) · Next → [05 · Turbopack build caches](05-turbopack-build-caches-persistent-build-cache-and-memory-evi.md)
