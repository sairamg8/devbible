---
title: "Eight ordered questions that produce a rendering decision you can defend in review — and the positive case for request-time rendering, which is a correct answer far more often than the cargo-cult version of this advice admits"
sidebar_label: "01d · The decision procedure"
sidebar_position: 4
description: "A runnable decision procedure for choosing a rendering pattern, with concrete if-yes/if-no branches, three worked examples run end to end, and the list of situations where rendering the whole document per request is simply right."
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-09-04 for **Next.js 16.3.4** against [Caching](https://nextjs.org/docs/app/getting-started/caching) (docs `version: 16.3.4`, `lastUpdated: 2026-08-25`), [How to implement Incremental Static Regeneration (ISR)](https://nextjs.org/docs/app/guides/incremental-static-regeneration) (`lastUpdated: 2026-06-23`) and [`generateStaticParams`](https://nextjs.org/docs/app/api-reference/functions/generate-static-params) (quoted from research banked 2026-09-03). The `v16.0.0` removal of `dynamic`, `dynamicParams`, `revalidate` and `fetchCache` under Cache Components is carried from [ch4 · the segment config surface](../04-data-fetching-in-the-app-router/03b-the-segment-config-surface.md).
> `next` is **not installed in this checkout** — no package probe was possible; `react` probes at **19.2.8**.
> Target: **Next.js 16.3.4 · React 19.2.8 · Node >= 20.9**. Documentation-verified; **no sandbox run**.

**A decision procedure earns its place only if it is ordered by something real. This one is ordered by elimination: each question either removes options from the table or is a fact about the product that you are not entitled to invent. Questions 1 through 4 are product facts and you may have to go and ask someone; 5 through 8 are engineering facts you can establish yourself. Run them in order and the output is not a mode — it is a description of which components are in the shell, which are cached and for how long, and which are holes. Then the second half of this page argues the case that the "static by default" framing tends to bury: request-time rendering is the right answer for a whole class of routes, and choosing it deliberately is not a failure.**

## Question 0 — which rendering model is this codebase in?

Not part of the ordering, because it changes what the other answers *mean*. Check `next.config.ts` for `cacheComponents: true`.

- **If on:** the unit of the decision is the component. `cookies()` in a boundary is a hole, not a route-wide verdict, and `dynamic`, `dynamicParams`, `revalidate` and `fetchCache` **do not exist** — `v16.0.0` removes them when the flag is enabled. Any answer below phrased as a segment config value has to be re-expressed as `use cache`, `cacheLife`, `cacheTag` and boundary placement.
- **If off:** the unit is the route, the segment config surface is exactly the API you have, and every "hole" below is really "an all-or-nothing route decision, or a Client Component".

🔴 **This is why a rendering strategy written as a list of segment config exports ages badly.** You are writing down an API the flag deletes. Write the strategy as *"the product grid is cached for an hour and tagged `catalog`; the cart badge is a hole"* — sentences that survive the migration — and let the flags be an implementation detail of the model you happen to be in. [ch5 · the explicit caching model](../05-caching-ppr-and-cache-components/01-the-explicit-caching-model-cachecomponents-build-flag-and-th.md) is the migration surface.

## The eight questions

**1 · Does this route decide access to anything?**
*Yes* → the check runs at request time, always, in the component or the data access layer, and it may never live inside a shared cache entry or behind `force-static`. That constraint is independent of everything below it; do not trade it away later for a cache-hit rate. *No* → continue.

**2 · Is the rendered document identical for every reader?**
*Yes* → no personalization axis; skip to 4. *No* → find the smallest subtree that actually differs and mark it as a hole ([01c](01c-personalization-without-going-dynamic.md)). If the whole document differs — inbox, dashboard, admin — stop here and go to the positive SSR case below.

**3 · Is there a value on this page that must be true at the instant of reading?**
*Yes* → that value, and only it, is an uncached read behind its own `<Suspense>` boundary. Price at checkout, remaining seats, current entitlement. *No* → everything on the page is cacheable at some lifetime, which means the only remaining question about freshness is who invalidates it.

**4 · Who can tell you the data changed?**
*A system you control* (CMS webhook, your own Server Action, an admin write) → on-demand invalidation with `cacheTag` plus `updateTag`/`revalidateTag`, and a deliberately long lifetime as a backstop. *Nobody* (third-party feed, computed aggregate) → time-based revalidation, with the interval justified by the staleness budget from [01b](01b-data-velocity-and-the-staleness-budget.md), not by how nervous you feel.

**5 · Do you know the URL set at build time?**
*Yes and it is small* → enumerate it in `generateStaticParams`. *Yes but it is huge* → enumerate the traffic head only and let the rest generate on first request. *No* (search results, arbitrary filters, per-user URLs) → there is nothing to prerender per URL; the shell is the App Shell and the URL-specific parts are holes.

**6 · Does a crawler need this URL?**
*Yes* → verify the shell's data is reachable at request time, because the bot path re-renders the whole page rather than reusing the shell, and check that metadata does not read runtime data on an otherwise-prerenderable page ([01](01-choosing-a-rendering-pattern-seo-build-time-data-velocity-pe.md)). *No* (anything behind auth) → the SEO axis is void; do not let it into the discussion.

**7 · Does the resulting build fit your deploy cadence?**
Multiply the enumerated URL count by roughly what one render costs and compare it against how quickly you must be able to ship a fix. *Fits* → keep it. *Does not* → cut the enumerated set, not the caching. And remember that whatever you did not prerender is cold after every deploy, because cache keys include the build id.

**8 · What happens on the unhappy path?**
If the upstream is down, a prerendered page keeps serving the last good render, and a request-time page serves an error. That asymmetry is often the strongest argument for caching a route that looked like it needed to be live — and its price is that a broken upstream becomes invisible, so the monitoring has to move inside the cached function ([01b](01b-data-velocity-and-the-staleness-budget.md)).

## Three worked examples, run end to end

### `/` — the marketing home page

1 no · 2 identical for everyone · 3 nothing must be instantaneous · 4 marketing edits in a CMS, which fires a webhook · 5 one URL · 6 yes, this is the page search actually cares about · 7 trivial · 8 must never be down.

**Result:** fully prerendered, `use cache` around the CMS read tagged `home`, invalidated from the publish webhook, with a long lifetime as a backstop. No boundaries needed. If a "signed in" avatar appears in the header later, it is a hole and this decision does not change.

### `/teams/[slug]` — a public team page with a live member count

1 no (public by definition) · 2 identical for everyone · 3 the member count should be current-ish but nothing breaks at ten minutes old · 4 team edits happen in the app, so a Server Action can invalidate · 5 the slug set is known but grows daily · 6 yes · 7 thousands of teams, so enumerate the active head · 8 a stale team page is harmless.

**Result:** `generateStaticParams` over recently-active teams, everything else generated on first request, page content cached and tagged `team-${slug}`, invalidated by the team-settings action. The member count sits in the same cached section — question 3 said it does not need to be instantaneous — and the honest interval comes from the budget table, not from a reflex.

🔴 Note what this decision does *not* survive: a new team's page is created on first visit, but if anyone sets `dynamicParams = false` for tidiness, every new team 404s until the next deploy, and `generateStaticParams` is not re-run during revalidation to save you.

### `/app/board` — the authenticated project board

1 **yes** — it decides access · 2 wholly different per user · 3 task state must be current at read · 4 the user themselves, constantly · 5 per-user URLs · 6 no crawler · 7 nothing to prerender · 8 an error is preferable to a stale board.

**Result:** request-time rendering, with the chrome — nav, empty states, skeletons — still prerendered as the App Shell so navigation is instant. Mutations invalidate and re-render in the same action response so the user sees their own write immediately. This is not a compromise; every question pointed the same way.

## When request-time rendering is genuinely right

State this positively, because a team that has internalised "static by default" will otherwise contort a route that should simply render per request.

- **The document is a function of identity.** Inbox, dashboard, order history, admin console. There is no shared entry worth caching, so caching machinery is pure overhead and one more thing to get wrong.
- **The URL space is unbounded and unenumerable.** Search results, arbitrary filter combinations, report builders. There is nothing to prerender; every entry would be created once and read once.
- **Correctness at read time is the product.** Availability, pricing at the point of sale, balances, permissions. The ISR guide's own escalation ends here: *"If you need real-time data, consider switching to dynamic rendering."*
- **The read:write ratio is inverted.** An order confirmation page is read approximately once per write. A cache entry that is populated and read once has a hit rate of zero and costs strictly more than not caching.
- **Access decisions must be evaluated per request.** Geo restriction, licence gating, feature entitlement, anything a regulator will ask about. A prerendered artefact cannot make a decision about a request it never saw.
- **The response depends on the request in a way that is not a value you can pass as a prop** — content negotiation, a signed URL derived from headers, a per-request nonce for CSP.
- **The page is diagnostic.** Health endpoints, build-info pages, anything whose whole purpose is to tell you about *this* server at *this* moment. Caching one is a joke that stops being funny during an incident.

**None of these is a defeat.** The failure mode this chapter warns about is not "chose request-time rendering"; it is "chose it for the whole route because one element needed it, and never wrote down which element that was".

## Gotchas

**★ Symptom: the strategy document says `export const revalidate = 3600` and the codebase has Cache Components on.** Cause: the strategy was written against the previous model, and `v16.0.0` removes `dynamic`, `dynamicParams`, `revalidate` and `fetchCache` when the flag is enabled — so the export is not merely discouraged, it is gone. Fix: express the decision as lifetimes and tags on the functions that read data, which are portable across both models:

```tsx
import { cacheLife, cacheTag } from 'next/cache'

export async function getTeam(slug: string) {
  'use cache'
  cacheLife('hours')
  cacheTag(`team-${slug}`)
  return db.team.findUnique({ where: { slug } })
}
```

**★ Symptom: a review argument about SSG vs SSR that nobody can settle.** Cause: the participants are answering different questions — one is talking about personalization, another about freshness, a third about SEO — and no one has separated them. Fix: run questions 1 to 8 out loud in order. Disagreements collapse almost immediately, because most of them turn out to be disagreements about a product fact that neither engineer is entitled to decide.

**★ Symptom: the team keeps re-litigating a route's rendering every few months.** Cause: the decision was recorded as a flag rather than as a reason. `force-dynamic` with no comment carries no information about which of the eight questions produced it. Fix: record the answer next to the code — one line naming the forcing constraint, so the next person can check whether it still holds:

```tsx
// Rendering: request-time. Q1 — this route gates access to billing data,
// and Q3 — the invoice total must be correct at the moment it is displayed.
```

**★ Symptom: a page was made fully dynamic to fix one stale number.** Cause: question 3 was answered for the route instead of for the value. Fix: put the value in its own boundary and return the rest of the page to the shell. Almost every over-dynamic route in a real codebase is this mistake, made once, a year ago.

**Symptom: everyone agrees the page is "mostly static" and it renders per request anyway.** Cause: the decision procedure describes intent, and something in the code disagrees with it — see [01e](01e-the-accidental-opt-out-and-what-each-pattern-costs.md). Fix: never conclude a rendering discussion without checking what the build actually decided; the procedure for that is [ch4 · diagnosing stale and unexpectedly dynamic routes](../04-data-fetching-in-the-app-router/03c-diagnosing-stale-and-unexpectedly-dynamic-routes.md).

**Symptom: question 5 was answered "we'll enumerate everything" and the page set grows without bound.** Cause: an enumeration that was correct at launch is a build-time liability by the second year, and nothing warns you as it grows. Fix: make `generateStaticParams` return a bounded slice by construction — an explicit `take`, ordered by traffic — so growth in the underlying table cannot silently become growth in build time.

## Interview questions

**★ Walk me through how you decide the rendering strategy for a new page.**
I start with the constraints I am not allowed to trade away: does the route decide access, and is there a value that must be true at the instant of reading. Then the product facts: does the document differ per reader, and who is able to tell me the data changed. Those four answers usually determine everything. After that I ask engineering questions — do I know the URL set, does a crawler need it, does the build fit my deploy cadence, and what happens when the upstream is down. The output is not "SSG" or "SSR"; it is a sentence per region of the page saying what is in the shell, what is cached and at what lifetime, and what is a hole.

**★ Give me a case where rendering per request is clearly the right choice.**
An order confirmation page. It is read roughly once per write, so a cache entry would be created and read once for a hit rate of zero; its content is entirely a function of one customer's identity, so there is no shared entry to serve anyone else; it must be correct at read time because it is a financial record; and no crawler will ever see it. Every one of the eight questions points the same way, which is what a genuinely dynamic route looks like — as opposed to a static route with one dynamic element in it.

**★ Why is writing a rendering strategy as a list of segment config exports a mistake in 16.3.4?**
Because those exports are being removed. With `cacheComponents` enabled, `v16.0.0` drops `dynamic`, `dynamicParams`, `revalidate` and `fetchCache` entirely, so a document written in that vocabulary describes an API the codebase loses the day someone flips the flag. The decisions themselves — this data is cached for an hour, this tag is invalidated by that write, this element is per-user — survive the migration; only their spelling changes. Write down the decision, not the syntax.

**★ A teammate says "make it static, it's just a marketing page", but the header shows the signed-in user's name. Who is right?**
Both, and the disagreement is about the unit. The document is public and belongs in the shell; the name is per-user and belongs in a hole behind a `<Suspense>` boundary. Under Cache Components that is exactly what happens, and reading `cookies()` in the hole does not make the route dynamic. Under the previous model there is no hole, so you either accept a per-request route or render the name client-side after hydration — and that is a real trade-off with a visible cost, namely a flash of the signed-out header.

**What does the unhappy path have to do with a rendering decision?**
It often decides it. A prerendered route with a cached read keeps serving the last good render when the upstream dies; a request-time route serves an error to everybody in the same instant. For anything customer-facing that is a strong argument for caching a route that superficially looked like it needed to be live. The price is that failure becomes invisible — the site looks fine while the data ages — so the monitoring has to move inside the cached function, and "time since last successful refresh" becomes the metric that matters.

**Your build takes 45 minutes and the business wants same-day content fixes. What changes?**
The enumerated URL set, not the caching model. I would cut `generateStaticParams` to the traffic head so the tail is generated on first request, and move content updates off the deploy path entirely by invalidating tags from the CMS webhook — publishing then costs one invalidation instead of one build. The rendering pattern for any individual page barely changes; what changes is that shipping content stops requiring a build, which was the actual complaint.

---

← [Personalization](01c-personalization-without-going-dynamic.md) · [Chapter index](01-explanation.md) · Next → [The accidental opt-out](01e-the-accidental-opt-out-and-what-each-pattern-costs.md)
