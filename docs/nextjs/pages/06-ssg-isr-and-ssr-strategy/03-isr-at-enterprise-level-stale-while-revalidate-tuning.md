---
title: "A `revalidate` window is not a freshness guarantee — it is a floor under how often you *may* regenerate, and because regeneration is triggered by a request rather than by a clock, the staleness your users actually see is set by your traffic, not by your number"
sidebar_label: "03 · ISR tuning"
sidebar_position: 10
description: "Choosing the revalidate number: what the window buys in origin load, what it costs in worst-case staleness, why revalidate is a floor and not a ceiling, and how to derive the number from a product requirement instead of habit."
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-09-04 for **Next.js 16.3.4** against [How to implement Incremental Static Regeneration](https://nextjs.org/docs/app/guides/incremental-static-regeneration) (docs `lastUpdated` 2026-06-23), [How revalidation works in Next.js](https://nextjs.org/docs/app/guides/how-revalidation-works) (`lastUpdated` 2026-06-01) and [`cacheLife`](https://nextjs.org/docs/app/api-reference/functions/cacheLife) (`lastUpdated` 2026-08-25).
> Target: **Next.js 16.3.4**, React 19.2.8, Node >= 20.9. Documentation-verified; **no sandbox run** — `next` is not installed in this checkout. 🔴 **Every number on this page is either quoted from the documentation or is arithmetic on a documented rule. No cache-hit rates, latencies or load figures have been measured or invented.**

**The mechanics of ISR are already written: [ch5 · revalidation and lifetimes](../05-caching-ppr-and-cache-components/10-the-three-cache-directives/05-revalidation-and-lifetimes.md) owns `cacheLife` and how a lifetime is declared, [ch5 · `revalidateTag` and `updateTag`](../05-caching-ppr-and-cache-components/10-the-three-cache-directives/05b-revalidatetag-and-updatetag.md) owns the invalidation functions, and [ch4 · the segment config surface](../04-data-fetching-in-the-app-router/03b-the-segment-config-surface.md) owns the `revalidate` export itself. This page is about choosing the number, which is a different skill and a harder one. Almost every `revalidate` in production is 60 or 3600, and almost none of them was derived from anything. The reason it matters is that the number does not do what its name suggests. It does not bound staleness. Regeneration is triggered by an incoming request, so on a path that gets one visit a day, `revalidate = 60` produces content up to twenty-four hours old and the config file says sixty seconds. Meanwhile the number *does* bound your origin load, tightly and predictably, and that is the property worth tuning against.**

## What the window buys: an origin-load ceiling independent of traffic

Start from the documented behaviour, step by step:

> *"4. After 60 seconds has passed, the next request will still return the cached (now stale) page"*
> *"5. The cache is invalidated and a new version of the page begins generating in the background"*
> *"6. Once generated successfully, the next request will return the updated page and cache it for subsequent requests"*
> — [ISR guide](https://nextjs.org/docs/app/guides/incremental-static-regeneration)

The consequence is the one property of ISR that makes it worth having. For a single path with window `R`:

- Every request inside the window is served from cache. No render.
- The first request after the window is *also* served from cache, and additionally triggers one background regeneration.
- So the number of renders for that path is **at most one per `R` seconds, no matter how many requests arrive.**

That is a ceiling that does not move with traffic. A path receiving ten requests per second and a path receiving ten thousand cost the origin exactly the same: one render per window. Aggregate it and the shape of your origin load is

> renders per second ≤ (number of cached paths receiving traffic) ÷ R

with your request rate absent from the expression entirely. **This is the actual argument for ISR, and it is a capacity argument, not a latency argument.** It is also why doubling `R` halves the ceiling — the only knob in the expression you control at runtime.

⚠️ Read the inequality carefully. It is a **ceiling**, not a rate. A path with no traffic generates no renders at all, because nothing triggers them.

## What the window costs: staleness, and it is not `R`

Here is the sentence to take away: **`revalidate` sets the earliest moment regeneration may happen, not the latest moment stale content may be served.** Four things stack on top of `R` before a user sees fresh content.

**1 · The window itself.** `R` seconds during which the cached copy is served and no regeneration is attempted.

**2 · The wait for a triggering request.** Regeneration is request-driven. Nothing runs on a timer. The ch15 documentation bank records this for the tag path in the framework's own words — *"A revalidation is triggered by a request, not by the `revalidateTag` call, so pages using the tag revalidate as they are visited rather than all at once"* — and the ISR walkthrough describes the time path the same way: the *next request* after the window is what starts regeneration. On a path visited once an hour, `R = 60` yields regeneration once an hour.

**3 · The regeneration itself.** *"The stale content continues to be served until the fresh content is ready"* ([How revalidation works](https://nextjs.org/docs/app/guides/how-revalidation-works)). So the request that triggers the work does **not** benefit from it, and neither does any request that arrives while it is in flight. The number of users served stale content during this phase is the regeneration duration multiplied by the request rate — the only term in the whole model that gets *worse* as traffic increases.

**4 · The client router's own cache.** `stale` controls the client cache, sent via `x-nextjs-stale-time`, and a *"minimum of 30 seconds is enforced to ensure prefetched links remain usable"* ([`cacheLife`](https://nextjs.org/docs/app/api-reference/functions/cacheLife)). A user who navigated client-side can hold a payload for at least 30 seconds after the server has fresh content.

Put together, for a path with regular traffic the visible staleness is roughly `R` plus one inter-arrival gap plus one regeneration plus up to the client stale time; for a path with sparse traffic it is dominated entirely by term 2 and `R` is irrelevant. **Anyone who writes `revalidate = 60` on a low-traffic page and reports "content is at most one minute old" is wrong, and the config file will not tell them.**

## The framework's own recommendation, and why it is right

> *"We recommend setting a high revalidation time. For instance, 1 hour instead of 1 second. If you need more precision, consider using on-demand revalidation. If you need real-time data, consider switching to dynamic rendering."*
> — [ISR guide](https://nextjs.org/docs/app/guides/incremental-static-regeneration)

Three claims compressed into three sentences, and each is a consequence of the model above.

**"Set a high revalidation time."** Because a low `R` does not buy freshness — terms 2, 3 and 4 do not shrink with `R` — but it does raise the origin-load ceiling linearly. A small number costs you real capacity in exchange for a guarantee it cannot deliver.

**"If you need more precision, use on-demand revalidation."** Because precision means "fresh *when something changed*", and time cannot express that. Only the writer knows when the write happened. This is [03c](03c-revalidate-budgets-and-time-based-versus-on-demand.md).

**"If you need real-time data, switch to dynamic rendering."** Because there is no value of `R` that means "always current". `R = 1` still serves the stale copy to the triggering request. If a stale read is *incorrect* rather than merely old — a checkout total, a seat count, a permissions view — ISR is the wrong tool and no tuning fixes it.

## Deriving the number from a product requirement

The method is to refuse to write a number until someone has written a sentence. The sentence has a subject, a bound and a consequence:

> *"A price change made in the admin must be visible on the public product page within 15 minutes, because that is what the pricing policy promises to customers."*

> *"A published blog post should appear on the index within an hour. If it takes two, nobody notices."*

> *"The terms-of-service page must show the current version within 24 hours of a legal update, and legal updates are announced in advance."*

Now the number is a derivation rather than a preference, and the derivation runs backwards through the four terms:

1. **Write the bound** — 15 minutes, 1 hour, 24 hours.
2. **Subtract the client stale time.** At least 30 seconds, and 5 minutes on every preset profile. On a 15-minute bound this is already 33% of your budget.
3. **Subtract a regeneration.** However long the page takes to render against your slowest upstream, at its 99th percentile, not its median.
4. **Subtract the inter-arrival gap** for the *least*-visited path on the route. This is the term people omit, and on a long-tail route it is larger than everything else combined.
5. **What remains is `R`** — and if what remains is negative, the requirement cannot be met with time-based revalidation at all, which is a finding, not a failure. Go to on-demand.

| Product bound | Traffic shape | Sane starting point | Why |
|---|---|---|---|
| 24 hours | any | `revalidate = 3600` | An hour is comfortably inside the bound even with a sparse-traffic penalty |
| 1 hour | steady, many requests/min | `revalidate = 900` | Inter-arrival gap negligible; leaves room for client stale time and regeneration |
| 1 hour | long tail, hours between visits | 🔴 time-based cannot promise this | Term 2 dominates. Use on-demand invalidation on publish |
| 15 minutes | steady | `revalidate = 300` + on-demand | Time-based as the backstop; the write path provides the precision |
| "immediately" | any | not ISR | *"If you need real-time data, consider switching to dynamic rendering."* |

⚠️ These are **starting points derived from the terms above, not measurements.** The documentation publishes no guidance on specific values beyond "high rather than low", and this page publishes no measured figures because there was no sandbox to measure in.

## Why 60 and 3600 are habits

`revalidate = 60` appears in the docs' own minimal example — with the honest comment *"Next.js will invalidate the cache when a request comes in, at most once every 60 seconds"* — and gets copied. `3600` appears in the time-based example. Neither was chosen for your product.

The test for whether a number was chosen: **ask what would break if it were doubled.** If the answer is "nothing, I think", it was not chosen, and doubling it is free capacity. If the answer names a requirement and a consequence, it was chosen, and it should be in a comment next to the export:

```tsx
// app/products/[slug]/page.tsx
// 15 min: the pricing policy promises a price change is public within 30 minutes.
// Budget: 30m bound − 5m client stale − ~1m regeneration − ~9m worst inter-arrival
// on the tail of this route. On-demand revalidation on the write path is the
// precision mechanism; this window is the backstop for a missed webhook.
export const revalidate = 900

export async function generateStaticParams() {
  return (await hotProductSlugs()).map((slug) => ({ slug }))
}
```

That comment is worth more than the number. It survives the next person, it makes the number falsifiable, and it names the backstop relationship that [03c](03c-revalidate-budgets-and-time-based-versus-on-demand.md) develops.

## Under Cache Components the number becomes three numbers

🔴 `v16.0.0` removes `dynamic`, `dynamicParams`, `revalidate` and `fetchCache` under `cacheComponents`. The segment `revalidate` export this page has been tuning does not exist there. What replaces it is not a rename but a decomposition — `cacheLife` splits the single window into the three terms this page has been decomposing by hand:

> *"`stale`: How long the client can use cached data without checking the server"*
> *"`revalidate`: After this time, the next request will trigger a background refresh"*
> *"`expire`: After this time with no requests, the next one waits for fresh content"*

That is a genuine improvement for tuning, because term 4 (the client cache) and the sparse-traffic case (term 2) are now separately expressible instead of being hidden consequences of one number. `expire` in particular is the answer to "what happens on a path nobody visits": rather than serving arbitrarily old content forever, the next request after `expire` blocks and gets fresh content. The mechanics live in [ch5 · revalidation and lifetimes](../05-caching-ppr-and-cache-components/10-the-three-cache-directives/05-revalidation-and-lifetimes.md), whose own argument — set `cacheLife` explicitly in every cached scope, or the lifetime stops being visible at the call site — is the prerequisite for everything below; the tuning consequences are [03c](03c-revalidate-budgets-and-time-based-versus-on-demand.md) and [03d](03d-the-cache-is-not-one-thing.md), and the fact that `expire` introduces a *blocking* path is [03b](03b-the-stampede-and-what-the-framework-does-not-protect-you-from.md).

## Gotchas

**★ Symptom: `revalidate = 60` is set and users report content hours old.** Cause: regeneration is triggered by a request, not by a clock. A path visited once every three hours regenerates once every three hours; the window only says the framework *may* regenerate after 60 seconds, not that it will. Fix: stop treating `revalidate` as a staleness bound on low-traffic paths. Either invalidate on the write path with `revalidatePath`/`revalidateTag`, or move to `cacheLife` and set `expire`, which is the only documented mechanism that forces a fresh render on a cold path — *"After this period with no traffic, the server regenerates content synchronously on the next request."*

**★ Symptom: you reduced `revalidate` from 3600 to 60 and content is not measurably fresher, but origin load rose sharply.** Cause: exactly the model above. The origin-load ceiling is proportional to 1/R, so you multiplied it by sixty; the staleness a user sees is `R` plus three other terms that did not change. Fix: put it back and get the freshness from on-demand invalidation, which is what the docs recommend for precisely this — *"If you need more precision, consider using on-demand revalidation."*

**★ Symptom: the first visitor after every window still sees the old page, and it is always the same internal reviewer.** Cause: not a bug. *"the next request will still return the cached (now stale) page"* — the request that triggers regeneration is served stale by design; that is what makes stale-while-revalidate fast. Fix: nothing, if the requirement tolerates it. If it does not, the visitor needs a blocking read, which means `updateTag` on the write path or dynamic rendering, not a smaller window.

**★ Symptom: a page looks stale in the browser for another half-minute after you confirmed the server is serving fresh HTML.** Cause: the client router cache. `stale` controls it, it is communicated via `x-nextjs-stale-time`, and there is an enforced *"minimum of 30 seconds ... to ensure prefetched links remain usable"* that applies to time-based expiration. Fix: a full page reload bypasses the client router; and calling a revalidation function from a Server Action clears the client cache immediately, bypassing the stale time — which is why a mutation feels instant and a background time-based refresh does not.

**Symptom: the revalidate number in the config does not match the number in the runbook.** Cause: nobody wrote down why the number is what it is, so the runbook records an intention and the code records a habit. Fix: put the derivation in a comment at the export site — bound, minus client stale, minus regeneration, minus inter-arrival — so the next person can check the arithmetic instead of guessing.

**Symptom: a route you never configured is revalidating every 60 seconds.** Cause: under the previous model, the effective route window is the minimum across the route — *"If you have multiple `fetch` requests in a prerendered route, and each has a different `revalidate` frequency, the lowest time will be used for ISR"* — so one library or one helper with a short window pulls the whole route down. Fix: audit the fetches on the route rather than the segment export; this is [03c](03c-revalidate-budgets-and-time-based-versus-on-demand.md).

**Symptom: a route stopped being static entirely and nobody changed the segment config.** Cause: *"If any of the `fetch` requests used on a route have a `revalidate` time of `0`, or an explicit `no-store`, the route will be dynamically rendered."* One `no-store` anywhere on the route is enough. Fix: find it — [ch4 · diagnosing stale and unexpectedly dynamic routes](../04-data-fetching-in-the-app-router/03c-diagnosing-stale-and-unexpectedly-dynamic-routes.md) is the procedure. 🔴 And note the direction of the corpus's own correction here: `fetch`'s *default* leaves a route static and possibly stale; it is `no-store` and `revalidate: 0` that make it dynamic, not the absence of a cache option.

**Symptom: ISR appears to do nothing on one deployment target.** Cause: two documented exclusions — *"ISR is only supported when using the Node.js runtime (default)"* and *"ISR is not supported when creating a Static Export."* Fix: check the runtime and the output mode before tuning anything; a full static export has no origin to regenerate on, which is [04 · full static export vs serverful edge distribution](04-full-static-export-vs-serverful-edge-distribution.md).

## Interview questions

**★ What does `revalidate = 60` actually guarantee?**
That the framework will not regenerate that entry more often than once per sixty seconds. That is a ceiling on work, not a bound on staleness — and reading it the other way round is the most common mistake in ISR configuration. Regeneration is triggered by an incoming request; nothing runs on a timer. So on a path visited once a day, a sixty-second window produces content up to a day old. On top of the window you also pay the wait for a triggering request, the duration of the regeneration itself (during which stale content keeps being served, including to the request that triggered it), and the client router's stale time, which has an enforced 30-second minimum. If you need an actual staleness bound, the mechanism is on-demand invalidation on the write path, or `expire` under `cacheLife`, which is the only documented thing that forces a fresh render on a path with no traffic.

**★ Why is ISR's main benefit a capacity benefit rather than a latency benefit?**
Because the number of origin renders per path is at most one per window regardless of request rate. Your traffic term drops out of the expression entirely: renders per second is bounded by the number of trafficked cached paths divided by the window, and a path serving ten thousand requests per second costs exactly what a path serving ten does. That is a capacity property, and it is the reason a small team can serve a large catalogue. Latency is a side effect — cached responses are fast — but a CDN would give you that too. What a CDN would not give you is a bounded, predictable render rate against your own database.

**★ How do you choose the number?**
Backwards from a written product requirement, never forwards from a habit. Get the sentence first: "a price change must be visible within 15 minutes because the pricing policy says so." Then subtract, in order, the client stale time (at least 30 seconds, 5 minutes on every preset profile), the 99th-percentile regeneration duration, and the worst inter-arrival gap on the least-visited path of that route. What is left is the window. If what is left is negative, the requirement cannot be met by time-based revalidation and you have learned something useful — go to on-demand invalidation, or to dynamic rendering if a stale read would be incorrect rather than merely old. The test for whether an existing number was chosen at all is to ask what breaks if you double it; "nothing, I think" means it was copied.

**★ Why does the documentation recommend an hour instead of a second?**
Because a short window pays a real cost for a guarantee it cannot deliver. It multiplies the origin-load ceiling — that ceiling is proportional to one over the window — while leaving the three other terms of user-visible staleness untouched. And it does not even remove the first one cleanly, because the request that triggers regeneration is itself served stale. The full recommendation is a decision tree rather than a number: high window by default; on-demand revalidation when you need precision, because only the writer knows when the data changed; and dynamic rendering when a stale read is wrong rather than old.

**★ Under Cache Components, `revalidate` is gone. What replaces it and is the tuning easier or harder?**
Easier, because `cacheLife` decomposes the single number into the three quantities you were already reasoning about implicitly: `stale` for how long the client may use cached data without checking, `revalidate` for when the next request triggers a background refresh, and `expire` for the point at which a request must wait for fresh content. The old segment `revalidate` conflated all three, which is why the sparse-traffic case was invisible — there was no way to say "and if nobody visits for a day, make the next visitor wait". `expire` says exactly that. The cost is that there are now three numbers to justify per profile rather than one, and one of them, `expire`, introduces a blocking path that did not exist before, which has its own operational consequences.

**A stakeholder asks for "real-time" pricing on a cached page. What do you tell them?**
That "real-time" and "cached" are exclusive, and that the framework's own guidance says so: if you need real-time data, switch to dynamic rendering. Then I would separate the two questions they have merged. If a stale price is merely *old* — the customer sees yesterday's price on a listing and today's at checkout — then on-demand invalidation on the price-write path plus a modest time-based backstop is the right shape, and it will usually look instant. If a stale price is *incorrect* — it is the number the customer is charged — then no cache configuration is acceptable and that read must be dynamic and authoritative. Almost every "real-time" request is the first case described in the language of the second.

---

← [02d · What Cache Components changes](02d-when-the-path-set-changes-and-what-cache-components-changes.md) · [Chapter index](01-explanation.md) · Next → [03b · The stampede](03b-the-stampede-and-what-the-framework-does-not-protect-you-from.md)
