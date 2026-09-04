---
title: "A decomposed article page is not free — it buys a cache entry per article, a hard dependency on cross-instance cache coordination and a p99 owned by cold long-tail reads — and one class of page does not decompose at all"
sidebar_label: "05c · Operating it at archive scale"
sidebar_position: 20
description: "The operational half of the content-platform walkthrough: partial enumeration with generateStaticParams, the costs the decomposed design actually incurs, its review triggers, and the test that identifies pages where full SSR is genuinely correct."
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-09-04 for **Next.js 16.3.4** against [`generateStaticParams`](https://nextjs.org/docs/app/api-reference/functions/generate-static-params) (docs `lastUpdated` 2026-08-25) and [Deploying to Platforms](https://nextjs.org/docs/app/guides/deploying-to-platforms) (`lastUpdated` 2026-03-30).
> Target: **Next.js 16.3.4**, App Router. Documentation-verified (T2); `next` is **not installed in this checkout**, so **no package probe and no sandbox run**. No latency, traffic or storage figures appear — none were measured.

**[05b](05b-content-platforms-and-the-ssr-reflex.md) argued the design: decompose the article page by element, keep the shell cached, put the per-visitor parts in Suspense boundaries. This chunk is the bill. Half a million articles cannot be enumerated at build time, so `generateStaticParams` becomes a head start rather than a registry — and one config value turns that into a product outage. Every article that gets a single visit acquires a cache entry that outlives the visit. Cross-instance cache coordination stops being a performance concern and becomes a correctness one the moment a correction has to reach every server. And a p99 measured across the archive is dominated by first-visitor cold renders, which is the expected shape and not a regression. Finally, the honest limit: some pages do not decompose, and there is a one-sentence test for which.**

## Why not enumerate every article?

Because `generateStaticParams` would return several hundred thousand entries and build duration
becomes a function of the archive. The head gets prerendered, the tail generates on first
request and is then cached exactly like a build-time page. Two documented facts make this work
and one of them bites:

> *"During revalidation (ISR), `generateStaticParams` will not be called again."*

So the enumeration is a build-time head start, not a registry — new articles published after
the build are served by the on-demand path, which is the behaviour you want. And:

> *"To prevent unspecified paths from being prerendered at runtime, add the `export const dynamicParams = false` option in a route segment. When this config option is used, only paths provided by `generateStaticParams` will be served, and unspecified routes will 404."*

🔴 **Do not set that here.** `dynamicParams = false` on a publishing platform means every article
published since the last deploy returns 404. See
[02](02-generatestaticparams-for-pre-rendering-dynamic-routes-at-sca.md) for the scaling
mechanics.

```tsx
// app/learn/[slug]/page.tsx — the enumeration, isolated
import { getTopArticleSlugs } from '@/lib/articles'

// Prerender the head only. Everything else generates on first request.
// 🔴 Do NOT add `export const dynamicParams = false` on this segment.
export async function generateStaticParams() {
  const slugs = await getTopArticleSlugs(2000)
  return slugs.map((slug) => ({ slug }))
}
```

The number `2000` deserves a comment in the codebase, not a constant with no explanation. It is
not a performance tuning parameter — it is the answer to "how many articles do we want warm on
the first request after a deploy", which is a traffic-distribution question the analytics team
can answer and an engineer cannot.

## What you gave up

**A cache entry per article, and storage that grows with the archive.** Every article that gets
one visit acquires a cache entry, and the entries outlive the visit. This is a real operational
cost that a fully-dynamic design does not have, and it is the honest counterweight.

**Cross-instance invalidation now matters.** With more than one instance and no shared cache,
`revalidateTag` reaches only the instance that handled the webhook — so a correction is applied
on one machine and not the others. On a page with an accuracy obligation that is not an
inconvenience. The documented behaviour:

> *"Without shared cache, each instance maintains its own cache independently — features still work correctly on each instance, but revalidation events don't propagate across instances."*

See [04c](04c-when-export-wins-and-what-a-server-buys.md) for the full matrix and
[ch16 · multi-region and data locality](../16-deployment-scaling-and-observability/03-multi-region-strategies-and-data-locality-patterns.md)
for the topology.

**The first visitor to a cold article pays the full render.** With hundreds of thousands of
articles in a long tail, that visitor is common, not rare. It is an acceptable cost — they were
going to pay it in a fully dynamic design on *every* view — but it means your p99 is dominated
by cold reads and you should not be surprised by that shape.

**Streaming is now a hard platform requirement.** The feature matrix marks it Required for PPR
and for Server Components. A buffering proxy in front of the app silently converts the design
back into "wait for the slowest hole", with no error and no log line.

## Review trigger

- **The paywall rules become per-request in a way the shell cannot ignore** — regional rights,
  for example, where the *free* portion differs by country. At that point the shell itself is
  per-visitor and the decomposition has to be redone from the element table.
- **Personalisation moves above the fold.** As long as the per-user parts are below it, they can
  stream; when the hero is personalised, the static shell stops being the thing the reader sees
  first and its value drops sharply.
- **The correction latency requirement becomes sub-second across regions**, which is a shared
  cache and propagation question rather than a rendering question.
- **Cache storage becomes a line item somebody asks about.** That is the moment to add an
  eviction policy rather than to reconsider the rendering strategy — but it should be a decision,
  not a surprise.

## The case where full SSR really is correct — name it, so the argument is honest

Not every page decomposes. A live scoreboard, an auction with active bidding, a trading
position, a queue depth: pages whose *entire value* is that the numbers are from this second.
There is no static shell worth serving, because a stale shell of a live page is not a partial
answer, it is a wrong one.

The test that separates them: **imagine the page served from a cache thirty seconds old. Is it
a slightly-late version of the truth, or a different claim?** An article thirty seconds old is
the same article. An auction thirty seconds old may show a price nobody can still buy at. The
first decomposes; the second is dynamic end to end, and `force-dynamic` on it is not a reflex,
it is the right call.

Two consequences of admitting that honestly. First, it gives you a defensible place to say no
to decomposition, which makes your yes credible everywhere else. Second, it changes the
infrastructure conversation: a genuinely dynamic page has no cache to coordinate, so the shared
cache requirement and the storage growth on this page both disappear — which is why a product
made *entirely* of live pages is a legitimately simpler deployment than a mixed one.

## Gotchas

**★ Symptom: new articles 404 until the next deploy.** Cause: `export const dynamicParams = false` inherited from a template or copied from a docs-site example, which the documentation states will 404 every unspecified path. Fix: delete it on any route whose set of valid paths grows without a deploy. It is the correct setting for a fixed set — a marketing site's five landing pages — and a product outage for a content archive.

**★ Symptom: a correction propagates on one server and not the others, and which one a reader hits is random.** Cause: no shared cache backend, so a revalidation event reaches only the instance that processed the webhook. Fix: configure `cacheHandlers` for `use cache` entries and `cacheHandler` for the ISR paths before running more than one instance. On a platform with an accuracy obligation this is not a performance concern, it is a correctness one.

**★ Symptom: p99 latency looks terrible even though most page views are fast.** Cause: the long tail — hundreds of thousands of archived articles, each of whose first visitor pays a full cold render. Fix: nothing, usually. Recognise the shape and measure cold and warm separately, because a single aggregate hides the fact that the warm path is exactly what you designed and the cold path is doing work a fully-dynamic design would have done on *every* request.

**★ Symptom: build time creeps up over quarters with no code change, and the cause is untraceable in the diff.** Cause: `getTopArticleSlugs(2000)` became `getTopArticleSlugs(50000)` in a well-meaning "warm more pages" change, or the underlying query stopped being bounded. Fix: make the enumeration count an explicit, commented constant sourced from traffic distribution, and assert on the returned length in CI so a query change that returns the whole archive fails loudly instead of doubling the build.

**★ Symptom: the dynamic holes never stream — the page arrives all at once and the Suspense fallbacks are never seen in production, only locally.** Cause: a buffering reverse proxy or ingress in front of the application. Streaming is documented as requiring chunked transfer encoding or HTTP/2 *and* not buffering. Fix: this is a platform configuration change, not an application one; no rearrangement of boundaries will fix it, and time spent tuning them is wasted until the proxy is corrected.

**★ Symptom: cache storage grows without bound and nobody owns it.** Cause: every visited article acquires a cache entry that outlives the visit, and the archive only grows. Fix: give the cache profile a finite life so unvisited entries age out — `cacheLife('days')` on the article function rather than an unbounded profile — and treat the storage line as an expected cost of the design rather than a leak to hunt.

**Symptom: a page that genuinely cannot decompose is nonetheless given a static shell "for consistency with the rest of the app".** Cause: applying the pattern rather than the reasoning. Fix: run the thirty-second test. If a cached version of the page is a different claim rather than a late one, the shell is a liability — it makes the wrong answer arrive faster, which is worse than making the right one arrive slowly.

## Interview questions

**★ A publishing platform has half a million articles. What does `generateStaticParams` return?**
The head — the few thousand that carry the traffic — and nothing else, with `dynamicParams` left at its default so the tail generates on first request and is then cached like a build-time page. Two documented behaviours make this correct: `generateStaticParams` is not called again during revalidation, so it is a build-time head start rather than a registry of valid paths; and `dynamicParams = false` would make every article published since the last deploy return 404, which on a publishing platform is a product outage rather than a configuration choice.

**★ When is `force-dynamic` on a whole route actually the right call?**
When the page served from a thirty-second-old cache would be a *different claim*, not a slightly-late one. A live auction, a scoreboard, a trading position, a queue depth: there is no static shell worth serving, because a stale shell of a live page is wrong rather than partial. The test is worth stating as a test, because it distinguishes the legitimate cases from the reflex — an article thirty seconds old is the same article, and that is why an article decomposes and an auction does not.

**★ What did the decomposed design cost, compared to going fully dynamic?**
A cache entry per article, with storage growing as the archive does. A hard dependency on shared cache coordination once you run more than one instance, because otherwise a correction lands on one machine. A p99 dominated by first-visitor cold renders across the long tail. And a hard platform requirement for streaming, since the dynamic holes are useless behind a buffering proxy. All four are real, and none is as expensive as a database query on the critical path of every anonymous article view — but a decision record that omits them is advocacy, not analysis.

**★ How do you choose the number of articles to prerender at build time?**
It is not an engineering constant, which is why it should never be an unexplained one in the code. It answers "how many articles do we want warm on the first request after a deploy", and the traffic distribution answers it: prerender down to the point where the marginal article's expected views before its first natural visit stop justifying the build seconds. That is a question the analytics team can settle. What an engineer contributes is the guard rail — an assertion in CI that the enumeration stayed bounded, so a query change cannot quietly turn a head start into a full archive walk.

**★ Why does a fully dynamic product have a simpler deployment than a mixed one?**
Because there is no cache to coordinate. The shared-cache requirement, the invalidation propagation, the cache storage growth and the HTML-versus-RSC-payload consistency question all exist because content is cached and can be invalidated. A product made entirely of live pages skips all of it and pays instead in origin compute on every request. That is worth saying out loud when someone frames caching as unambiguously the cheaper option: it moves cost from compute to coordination, and coordination is where the subtle correctness bugs live.

**★ Your p99 is bad and your median is excellent. Before changing anything, what do you check?**
Whether the two populations are cold and warm reads, because on an archive with a long tail they almost always are. A single aggregate over both hides the design working exactly as intended: the warm path serves from cache, the cold path does the render a fully-dynamic system would have done on every request. Split the metric first. If the cold path is genuinely too slow, the fix is in the data layer or in prerendering more of the head — not in the rendering strategy, which is doing what it was chosen to do.

---

← [05b · Content platforms, and the SSR reflex](05b-content-platforms-and-the-ssr-reflex.md) · [Chapter 6 overview](01-explanation.md) · Next → [05d · Authenticated dashboards](05d-authenticated-dashboards.md)
