---
title: "Stale-while-revalidate structurally prevents the classic cache stampede on the stale path, because nobody blocks — but the documentation never says whether concurrent requests coalesce into one background regeneration, and the paths that *do* block are named, documented, and the ones you reach for during an incident"
sidebar_label: "03b · The stampede"
sidebar_position: 11
description: "What happens when many requests hit one stale path: what SWR guarantees, the deduplication question the docs do not settle, and the four documented blocking paths where a thundering herd is genuinely possible."
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-09-04 for **Next.js 16.3.4** against [How revalidation works in Next.js](https://nextjs.org/docs/app/guides/how-revalidation-works) (docs `lastUpdated` 2026-06-01), [How to implement Incremental Static Regeneration](https://nextjs.org/docs/app/guides/incremental-static-regeneration) (`lastUpdated` 2026-06-23), [`cacheLife`](https://nextjs.org/docs/app/api-reference/functions/cacheLife) (`lastUpdated` 2026-08-25) and the banked quotes for [`revalidateTag`](https://nextjs.org/docs/app/api-reference/functions/revalidateTag) and [`updateTag`](https://nextjs.org/docs/app/api-reference/functions/updateTag).
> Target: **Next.js 16.3.4**, React 19.2.8, Node >= 20.9. Documentation-verified; **no sandbox run**. 🔴 **One claim on this page is explicitly unresolved and is marked as such rather than answered.**

**A cache stampede — thundering herd, dogpile, whichever name your last incident used — is what happens when a popular cache entry becomes invalid and every concurrent request for it independently starts the expensive work the entry existed to avoid. It is the classic way a cache turns into an outage, because load is highest exactly when the protection disappears. Stale-while-revalidate is the structural answer to it, and Next.js's time-based ISR is stale-while-revalidate: the cached copy keeps being served the entire time regeneration is running, so on the stale path no request blocks and there is no herd to speak of. That is the good news, and it is documented in one sentence. The bad news comes in two parts. First, the documentation does not say whether N concurrent requests to one stale entry trigger one background regeneration or N — and this page will not invent an answer. Second, the framework has four documented paths where requests genuinely do block on a render, one of them is what you reach for during an incident, and another one happens on every deploy.**

## What the stale path guarantees

> *"Time-based revalidation uses a stale-while-revalidate pattern. The cached content is served immediately, and a background regeneration is triggered when the content's age exceeds the `cacheLife` or `revalidate` duration. **The stale content continues to be served until the fresh content is ready.**"*
> — [How revalidation works](https://nextjs.org/docs/app/guides/how-revalidation-works)

The bolded clause is the guarantee. It says that during regeneration the cache still answers, which means:

- **No request waits.** Not the one that triggered the regeneration, not the thousand that arrive while it runs.
- **No request renders.** They are all served from the existing entry.
- Therefore the classic stampede shape — N concurrent *blocking* renders competing for the same database connections — **cannot occur while a stale copy exists**, by construction rather than by a lock.

The ISR guide says the same thing from the user's side: *"the next visitor will still receive the cached (stale) version of the page immediately for a fast response. Simultaneously, Next.js triggers regeneration of a fresh version in the background."*

This is why "should I worry about a stampede on my ISR pages" is usually answered "not on the stale path". The interesting question is what remains.

## 🔴 The question the documentation does not settle

**Do N concurrent requests to one stale entry cause one background regeneration, or N?**

Three primary sources were read for this: the ISR guide, `cacheLife`, and *How revalidation works*, the last of which is explicitly written *"for platform engineers and advanced users who need to understand the system to implement custom cache handlers or debug revalidation behavior"* — precisely the audience that would need this answered. **None of the three mentions a lock, single-flight, request coalescing, in-flight deduplication, or a thundering herd at all.** I could not confirm either behaviour, and I am not going to assert one.

What is documented, and constrains the answer:

- Nobody blocks either way, so even under the pessimistic reading (N regenerations) the user-visible symptom is not latency. It is **duplicated origin work**: N renders hitting your database, and on per-request billing, N units of compute.
- The cache handler API is documented as `get()` / `set()` / `getExpiration()` / `updateTags()` / `refreshTags()`. **No in-flight or lock primitive appears in that surface**, which means if coalescing exists it is above the handler, not something a custom handler is expected to implement. That is an observation about the documented API, not a proof.
- Regeneration is per-instance regardless: *"Background regeneration (stale-while-revalidate) runs on the instance that receives the triggering request."* So even a perfect in-process single-flight would still allow one regeneration per instance, and a fleet of twenty instances is at least twenty renders.

**How to engineer without the answer.** Assume the pessimistic case and make it not matter, which costs nothing if the optimistic case is true:

1. **Cache the expensive part below the page.** Put `use cache` (or a `cache`-wrapped data accessor) around the query, so duplicate regenerations of the same route converge on one cached data read instead of N database round trips. This is the fix that works under either answer.
2. **Do not let regeneration be expensive.** A regeneration that is one indexed read is not worth deduplicating; one that is a fan-out across four services is worth restructuring.
3. **Measure it rather than reason about it.** `x-nextjs-cache: STALE` marks responses *"served from cache, revalidating in background"*, and your database's own connection and query metrics will show duplicate work directly. That is a per-deployment observation, which is the right kind of answer to a question the docs leave open. [03d](03d-the-cache-is-not-one-thing.md) is where the observability sits.

⚠️ **If you find a definitive statement in the Next.js source or a release note, it supersedes this section.** Absence of documentation is not evidence of absence of a lock.

## The four paths that genuinely block

A herd needs requests that *wait*. Here is every documented way to get one, and each is a normal thing to do.

### 1 · `expire` has elapsed — the cold-path blocker

> *"`expire`: After this time with no requests, the next one waits for fresh content"*
> *"After this period with no traffic, the server regenerates content synchronously on the next request"*
> — [`cacheLife`](https://nextjs.org/docs/app/api-reference/functions/cacheLife)

**Synchronously** is the word. Past `expire` there is no stale copy considered servable, so SWR's protection is gone and the requests wait. Under the previous model the segment `revalidate` export had no `expire` sibling and this path did not exist; under Cache Components you are choosing it every time you pick a profile.

Note the preset shapes: `default` has `expire: never`, `max` expires at a year, `days` at a week. Only `seconds` (`expire` of one minute) is short enough to be a routine concern, and it is excluded from prerenders for exactly that reason.

### 2 · `updateTag` — blocking by design

> *"`updateTag` immediately expires the cached data for the specified tag. The next request will wait to fetch fresh data rather than serving stale content from the cache."*
> — banked from [`updateTag`](https://nextjs.org/docs/app/api-reference/functions/updateTag)

This is the correct primitive for "the user just saved something and must see it", and it is Server-Action-only for that reason. It is the wrong primitive for a broad tag. `updateTag('products')` on a catalogue of ten thousand pages turns every subsequent first request into a blocking render, all at once, which is the textbook stampede with your own hand on the lever.

### 3 · `revalidateTag(tag, { expire: 0 })` — the same thing, and the deprecated default

The banked `revalidateTag` documentation lists the profiles:

- `profile="max"` (recommended): a one-year window, *"requests always served stale while revalidating"*.
- `{ expire: 0 }`: stale never served; the next request is a blocking revalidate / cache miss.
- **No second argument (deprecated)**: behaves like `{ expire: 0 }`.

🔴 **That last line is a trap with an ergonomic shape.** `revalidateTag('products')` — the short form everyone has typed for years, the form that appears in older tutorials — is the *blocking* one. The single-argument form is deprecated and *"currently works if TypeScript errors are suppressed, but this behavior may be removed in a future version."* The two-argument form with `'max'` is the stampede-safe one:

```ts
// app/actions/publish.ts
'use server'

import { revalidateTag, updateTag } from 'next/cache'

export async function publishPost(id: string) {
  await savePost(id)

  // Narrow and user-facing: the author must see their own post immediately.
  // Blocking is correct here — it affects one entry and one person is waiting.
  updateTag(`post-${id}`)

  // Broad and background: the index, the sitemap, the category pages.
  // 'max' keeps every reader on stale content while these regenerate,
  // so publishing does not produce a wave of blocking renders.
  revalidateTag('posts', 'max')
}
```

**The rule that falls out: narrow and interactive → `updateTag`; broad and ambient → `revalidateTag(tag, 'max')`.** The width of the tag is what decides, not how fresh you would like the data to be. The two functions themselves — signatures, call-site restrictions, and why `updateTag` is the one that lets a user see their own write — are [ch5 · `revalidateTag` and `updateTag`](../05-caching-ppr-and-cache-components/10-the-three-cache-directives/05b-revalidatetag-and-updatetag.md); what this page adds is what each does to concurrency.

### 4 · A deploy — the cold cache nobody schedules as an incident

> *"Neither caching directive carries over to a new deploy, because the cache key includes the build (or `deploymentId`) ID."*
> — banked from [`use cache`](https://nextjs.org/docs/app/api-reference/directives/use-cache)

Every deploy is a total cold start for `use cache` entries. There is no stale copy to serve, so the first request for each path is a miss and renders. On a site with a large prerendered set this is absorbed — those entries came out of the build. On a site that leans on runtime caching with a small enumerated head, **a deploy is the largest concurrent render event your origin ever sees, and it happens on purpose, several times a week, usually during business hours.**

This is the single most under-appreciated item on the page, because nothing calls it a stampede. It shows up as "the deploy was slow" or "p99 spikes after every release".

## The multi-instance multiplier

Everything above is per-instance:

> *"When running multiple instances, the default file-system cache is per-instance."*
> *"Background regeneration (stale-while-revalidate) runs on the instance that receives the triggering request. On platforms with per-request billing, this background work counts as additional compute."*
> — [ISR guide](https://nextjs.org/docs/app/guides/incremental-static-regeneration)

So a twenty-instance fleet has twenty independent caches, twenty independent staleness clocks and, on a blocking path, twenty simultaneous cold misses for the same URL. **A shared cache handler collapses that back to something closer to one**, which is the strongest argument for one and is developed in [03d](03d-the-cache-is-not-one-thing.md).

## What you actually do about it

**Prefer stale-serving invalidation for anything wide.** `revalidateTag(tag, 'max')` over `updateTag` unless one user is waiting on one entry.

**Keep `expire` comfortably above `revalidate`.** The framework enforces that `expire` be longer — *"Next.js validates this and raises an error for invalid configurations"* — but that is a validity check, not a safety margin. The gap between them is the buffer in which a low-traffic path can still be served stale rather than blocking.

**Make regeneration cheap, not rare.** Cache below the page so that whatever the concurrency of regeneration turns out to be, the marginal cost of one more is a cached data read.

**Do not stagger windows by hand for its own sake.** ⚠️ It is sometimes claimed that a site-wide identical `revalidate` makes every entry expire at the same instant and produces a synchronised wave. Reasoning from the documented mechanism: entries become *eligible* at the same moment if they were all written by the same build, but regeneration is triggered by requests, so the actual regenerations are spread out by the traffic distribution. **The documentation makes no claim about alignment either way**, and this page will not assert a synchronised thundering herd it cannot source. If your own metrics show a wave, varying windows per content class — which [03c](03c-revalidate-budgets-and-time-based-versus-on-demand.md) recommends for entirely different reasons — will spread it.

**Treat deploys as the cold-cache event they are.** If post-deploy latency is a real problem, the lever is enumerating more of the head at build time ([02](02-generatestaticparams-for-pre-rendering-dynamic-routes-at-sca.md)) so the cache ships warm, or a shared cache handler keyed in a way you control — not a smaller `revalidate`.

## Gotchas

**★ Symptom: publishing one item produces a burst of origin load and slow responses across the whole site.** Cause: `updateTag` on a broad tag, or the deprecated single-argument `revalidateTag(tag)`, both of which stop stale content being served — so every first request per affected entry blocks on a render. Fix: use the width of the tag to choose the primitive. `updateTag` only for the narrow entry the acting user is waiting on; `revalidateTag(tag, 'max')` for everything wide, which keeps readers on stale content while the background work proceeds.

**★ Symptom: `revalidateTag('posts')` behaves differently than the tutorial you copied it from.** Cause: the single-argument form is deprecated and behaves like `{ expire: 0 }` — the blocking form. It *"currently works if TypeScript errors are suppressed, but this behavior may be removed in a future version."* Fix: always pass the second argument, and default to `'max'`:

```ts
revalidateTag('posts', 'max')   // stale served while revalidating
revalidateTag('posts', { expire: 0 })   // deliberate blocking; say why in a comment
```

**★ Symptom: p99 latency spikes after every deploy and settles within minutes.** Cause: the cache key includes the build ID, so a deploy is a total cold start for runtime cache entries and the first request per path is a miss that renders. Fix: it is not a `revalidate` problem and shrinking the window makes it worse. Prerender more of the head at build time so the deploy ships with those entries populated, and if the tail is the problem, enable Cache Components so unlisted URLs get an App Shell rather than a blocking render.

**★ Symptom: a page that gets almost no traffic occasionally takes seconds to load.** Cause: `expire` elapsed. Past `expire` there is no servable stale copy, so *"the server regenerates content synchronously on the next request"* and that visitor pays for the whole render. Fix: this is the correct behaviour and the alternative is serving arbitrarily old content. If the latency is unacceptable, raise `expire` (accepting older content on cold paths) or keep the path warm deliberately, e.g. with a scheduled request. Do not lower `revalidate`; on a path with no traffic it changes nothing.

**★ Symptom: the same page regenerates on every instance at roughly the same time.** Cause: the default file-system cache is per-instance, each instance has its own staleness clock, and background regeneration runs on whichever instance received the triggering request. Twenty instances is up to twenty regenerations of the same URL. Fix: a shared custom cache handler, which is what the docs point at — *"Use a shared custom cache handler to coordinate across instances."*

**Symptom: you cannot find out whether concurrent stale requests cause one regeneration or many.** Cause: the documentation does not say, including the page written specifically for people implementing cache handlers. Fix: do not design around an assumption. Cache the expensive work below the page so that duplicate regenerations converge on a cached read, and then measure duplicate origin queries directly against your database. Engineering around the pessimistic case costs nothing if the optimistic case is true.

**Symptom: a regeneration fails and you expect the page to break.** Cause: it does not. *"If an error is thrown while attempting to revalidate data, the last successfully generated data will continue to be served from the cache. On the next subsequent request, Next.js will retry revalidating the data."* Fix: none needed for availability — but this is why a broken upstream can leave a page serving correct-looking, indefinitely old content with no error anywhere. Alert on regeneration failures explicitly; the cache is designed to hide them, and *"The revalidation system prioritizes availability over strict consistency."*

**Symptom: `expire` shorter than `revalidate` was rejected at startup.** Cause: *"When you set both `revalidate` and `expire`, `expire` must be longer than `revalidate`. Next.js validates this and raises an error for invalid configurations."* Fix: it is a real constraint, not a lint — an entry that expires before it is eligible for background refresh could only ever block. Set `expire` to a genuine multiple of `revalidate`, not one second more.

## Interview questions

**★ What is a cache stampede, and does Next.js's ISR have one?**
A stampede is what happens when a hot cache entry becomes invalid and every concurrent request for it independently performs the expensive work the cache existed to avoid — load is highest at exactly the moment the protection disappears. On the time-based stale path, Next.js structurally does not have one, because stale-while-revalidate keeps serving the cached copy the whole time regeneration runs: *"The stale content continues to be served until the fresh content is ready."* Nobody blocks, so there is no herd of waiting requests. The stampede risk moves entirely to the paths where no stale copy is served — past `expire`, after `updateTag`, after `revalidateTag` with `expire: 0` or its deprecated single-argument form, and on a cold cache after a deploy.

**★ Do N concurrent requests to one stale entry trigger one regeneration or N?**
I do not know, and neither the ISR guide, nor `cacheLife`, nor the "How revalidation works" page — which is written specifically for people implementing custom cache handlers — states it. There is no mention of a lock, single-flight or coalescing anywhere in the three. So I would not claim either. What I can say is that the user-visible consequence is bounded regardless, because nobody blocks on the stale path: the worst case is duplicated origin work, not latency. And I would engineer for the pessimistic case anyway, by caching the expensive data access below the page so duplicate regenerations converge on one cached read, and then measure duplicate queries against the database directly. That is cheap insurance and it is the same answer whichever way the framework behaves.

**★ Why is `revalidateTag(tag, 'max')` safer than `updateTag(tag)`?**
Because they make opposite trades and the safe default is the one nobody types. `updateTag` immediately expires the tag and *"The next request will wait to fetch fresh data rather than serving stale content"* — so every affected entry's next visitor blocks on a render. `revalidateTag` with the `'max'` profile keeps serving stale while revalidating, so nobody waits. On a narrow tag with one user watching for their own write, blocking is right and `updateTag` is the correct tool; on a broad tag covering thousands of pages, blocking is a self-inflicted stampede. And the trap is that the ergonomic short form, `revalidateTag(tag)` with no second argument, is deprecated and behaves like the blocking version.

**★ What is the largest concurrent render event in a typical Next.js production system?**
A deploy, and almost nobody classifies it as one. The `use cache` cache key includes the build or `deploymentId`, so nothing carries over — every runtime cache entry is cold the instant the new version is live, and there is no stale copy to serve. If your site relies on runtime caching with a small prerendered head, the first request for each popular path after a release is a miss that renders. It presents as "p99 spikes after releases", which sounds like a deployment problem rather than a caching one. The levers are prerendering more of the head so the cache ships warm, or Cache Components so unlisted URLs return an App Shell instead of blocking — not a shorter revalidate window, which makes it worse.

**How does running twenty instances change the analysis?**
It multiplies everything that is per-instance, and by default the cache is entirely per-instance. Twenty caches, twenty independent staleness clocks, twenty independent cold starts after a deploy, and background regeneration running on whichever instance received the triggering request — so even if the framework does perfectly deduplicate in-process, twenty instances still means up to twenty regenerations of the same URL. It also means on-demand invalidation is wrong by default, because *"Calling `revalidateTag()` on instance A only invalidates the cache on that instance"*, so users get different content depending on routing. The fix for both is a shared cache handler using `updateTags` to publish invalidations and `refreshTags` to consume them.

**A regeneration keeps failing against a broken upstream. What does a user see?**
The last successfully generated page, indefinitely, with no error. The documented behaviour is that a thrown error during revalidation leaves the previous data being served and the framework retries on the next request. That is the right availability trade and the page states the principle plainly — the system prioritises availability over strict consistency — but it means a total upstream outage can be invisible from the front end while your content silently ages past every bound you configured. So regeneration failures need their own alert. "The site looks fine" is exactly what this design is supposed to produce, and it is why nobody notices for a week.

---

← [03 · ISR tuning](03-isr-at-enterprise-level-stale-while-revalidate-tuning.md) · [Chapter index](01-explanation.md) · Next → [03c · Revalidate budgets and on-demand](03c-revalidate-budgets-and-time-based-versus-on-demand.md)
