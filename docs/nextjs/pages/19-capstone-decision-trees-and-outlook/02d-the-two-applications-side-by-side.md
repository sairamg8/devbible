---
title: "Put the SaaS and the storefront in one table and the useful part is not the differences — it is the three decisions that look identical in both and are not, the two that look different and are the same decision twice, and the single shared layout read that collapses the boundary when an application is honestly both"
sidebar_label: "02d · The two side by side"
sidebar_position: 23
description: "The payoff comparison across traffic shape, rendering strategy, cache placement, state ownership, authorization, outage cost, deploy pipeline, the business metric and the worst failure — then the decisions that are deceptively the same or deceptively different, and how to run both shapes in one codebase without losing either."
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-09-05 — this page composes material already verified across chapters 5, 6, 8, 10 and 15 of this book against the Next.js 16.3.4 documentation. It introduces no new framework claims of its own; the storefront is a worked contrast case, not a product.
> Documentation-verified; **no sandbox run, no timings**.
> Target: **Next.js 16.3.4** · React canary bundled by the App Router · Node.js **24.20.0**.

**A comparison table is where a contrast case usually stops, and stopping there is why most of them teach nothing. The table below is the easy half: two columns that disagree on almost every row, which anyone who read [02](02-case-study-2-contrast-a-ppr-driven-e-commerce-storefront.md) could have predicted. The half that is worth your time is what follows it. Three decisions produce the same line of code in both applications and mean completely different things — copy the code and you inherit a reason that does not apply. Two decisions look like separate disciplines and are one problem wearing two costumes. And most readers are not building either application: they are building something that is honestly both, and the answer the book has given repeatedly is that the boundary between the halves is a layout boundary, held open by discipline about exactly one thing.**

## The table

| | **SprintDesk** (multi-tenant SaaS) | **Storefront** (PPR e-commerce) |
|---|---|---|
| **Traffic shape** | Low volume, high value per request, concentrated in working hours per tenant | High volume, low value per request, spiky, plus crawl traffic on a schedule you do not control |
| **Who the reader is** | An authenticated member of one workspace | An anonymous first-time visitor, or a bot |
| **Dominant rendering strategy** | Request-time rendering of tenant data; the shell is the chrome | Prerendered shell over the catalogue; a handful of small holes |
| **Where the cache lives** | Server cache, tagged per tenant entity; low sharing because each entry has one reader | Server cache with long lifetimes plus the CDN; one entry serves every visitor |
| **Why the cache is there** | Avoid re-querying inside and across a session | Keep requests from reaching a function at all |
| **State ownership** | URL for filters and the open card; server cache for rows; client store for the drag; overlay for the unconfirmed move | Same four owners; the URL rows are public assets, and the cart is per-visitor server state with a server-issued identity |
| **The authorization question** | *Which tenant is this, and may they see this row?* — asked on every entry point, every time | *Is this document public?* — usually yes, and where it is not (order, account) the answer is SprintDesk's |
| **Cost of a primary datastore outage** | Total: nothing renders, because nothing is shared or cacheable | Partial and graceful: the catalogue keeps serving from cache; carts and checkout stop, so revenue stops while browsing continues |
| **What the deploy pipeline optimises for** | Migration safety and correctness gates — a bad migration is the outage | Build time and enumeration budget — the prerender set is a per-deploy bill paid in CI minutes |
| **The metric the business watches** | Write correctness and per-tenant latency; churn is the lagging indicator | Cache hit rate and conversion — and they are the same number seen twice, because a miss costs five meters where a hit costs two |
| **The failure that hurts most** | A cross-tenant read: one workspace sees another's data | A silently lost prerender: no error, no alarm, a slower site and a larger bill |
| **The failure people actually prepare for** | Downtime | Downtime |

🔴 **The last row is the joke, and it is the reason both applications get hurt.** Neither of the two failures above announces itself. A cross-tenant read looks like a successful response. A lost prerender looks like a working site.

## Three decisions that look identical and are not

### 1 · "Filters go in the URL"

The same `searchParams` read, the same `<Link>`, the same reasoning about reload-safety and back/forward. But on SprintDesk the URL is a private convenience shared inside a workspace, and on the storefront it is a public asset — an indexable landing page, an ad destination, a row in an analytics report. That changes downstream obligations that have no SaaS counterpart: which facet URLs are canonical, which are `noindex`, what the sitemap contains, and whether an unbounded facet space is generating an unbounded set of indexable near-duplicates.

**Copy the code from SprintDesk and you get a working filter and an SEO problem nobody owns.** The origin constant from [ch12 · 06](../12-seo-metadata-and-accessibility/06-project-milestone-sprintdesk-public-pages-fully-indexed.md) is the same file in both applications and carries far more weight in one of them.

### 2 · "Cache the list query"

`use cache` with a tag, on both. On SprintDesk the entry has one reader — the tenant — so the win is avoiding repeat work inside a session and across a few requests, and the risk is that a tenant-scoped value ends up in a scope shared across tenants. On the storefront one entry serves every visitor on the site, so the win is orders of magnitude larger and the risk is inverted: the danger is not sharing too much but sharing too little, because a key with high cardinality produces a cache that never hits.

Same directive, same three lines, opposite failure modes. The tell is what you put in the cache key: on SprintDesk a missing tenant id in the key is a data leak; on the storefront a *present* per-visitor value in the key is a permanently cold cache. [ch5 · 10 · 01](../05-caching-ppr-and-cache-components/10-the-three-cache-directives/01-choosing-a-directive.md) frames the choice as a data-placement decision for exactly this reason.

### 3 · "Invalidate the tag after a write"

Both applications call something from `next/cache` after a mutation, and the call sites look interchangeable. They are not, because the relationship between the writer and the reader is different.

On SprintDesk the person who wrote is the person who must immediately see the result, and the write happens in a Server Action — which is precisely `updateTag`'s job description and precisely where it is callable. On the storefront the dominant write is a merchandiser publishing from a CMS, arriving at a Route Handler, for readers who are not the writer and who have never met them. `updateTag` is not available there at all, and the decision becomes which profile to pass to `revalidateTag` — long for a description, `{ expire: 0 }` for a price. [ch5 · 10 · 05b](../05-caching-ppr-and-cache-components/10-the-three-cache-directives/05b-revalidatetag-and-updatetag.md) has both signatures; the storefront-specific reasoning is in [02b](02b-the-storefronts-rendering-and-caching-decisions.md).

### 4 · The bonus one: "wrap the slow thing in Suspense"

On SprintDesk this is a loading-experience decision — the board is rendering at request time either way, and the boundary decides what the user stares at while it does. On the storefront the same boundary decides **whether the page prerenders at all**, because it is the thing that keeps a runtime read from taking the shell with it. Identical JSX, and in one application it is polish while in the other it is the architecture.

## Two decisions that look different and are the same

### A · Tenant scoping, and the anonymous cart cookie

These get filed under different headings — one is authorization, the other is session management for someone with no account — and they are one rule: **the server derives identity; it never accepts it from the client.** SprintDesk's version is that a Server Action re-verifies the caller through the data access layer rather than trusting a `boardId` in the payload. The storefront's version is that the cart id is generated server-side and stored `httpOnly`, so a cart cannot be read by asking for someone else's id.

The consequences are the same shape too. Get it wrong on SprintDesk and one workspace reads another's cards; get it wrong on the storefront and one visitor reads another's basket and, at checkout, their address. Both are silent, both return `200`, and both are found by a customer rather than by a test.

### B · The transactional digest enqueue, and payment idempotency

SprintDesk's queue chapter and the storefront's checkout look like different disciplines — one is background jobs, the other is money. They are the same dual-write problem: an effect that must happen exactly once, and a second system that cannot join your transaction. The only variable is whether you control the second system.

- **You control it** (a `jobs` table in your own database) → move the effect inside the transaction. The enqueue and the write commit together, which is the one capability a separate broker structurally cannot offer.
- **You do not control it** (a payment provider) → you cannot move it, so you make the other side recognise a repeat. That is the provider's idempotency key, with reconciliation as the fallback and a human as the last resort ([ch15 · 04ea](../15-databases-apis-and-full-stack-patterns/04ea-external-effects-and-provider-idempotency.md)).

**The reasoning is identical and the mechanism differs only in which side of the boundary the effect sits on.** Somebody who has internalised SprintDesk's digest job already understands checkout; they just have not noticed yet.

## Which one are you building?

Two questions settle it faster than any survey.

**1 · On your busiest route, would two different visitors receive the same document?** If yes, you are building the storefront shape, whatever your product sells — a documentation site, a news publication, a marketplace, a booking site's search results. If no, you are building the SprintDesk shape, and PPR will recover your chrome rather than your page.

**2 · Does anything you serve need to be in a search index?** If yes, the crawler path is part of your capacity plan and your data reachability rules, and the second rendering path over your content is a permanent design constraint rather than a footnote.

## When it is genuinely both

Most real applications are. A SaaS with a marketing site, a docs site and a pricing page. A storefront with a seller dashboard and an admin. A publication with a paywalled tier. The instinct is to pick one global answer and live with it being wrong for half the application; the book's answer, given repeatedly and in different chapters, is different: **the boundary between the two shapes is a layout boundary.**

```
app/
├── (public)/                     ← storefront shape: shell-heavy, indexable, cached long
│   ├── layout.tsx                🔴 must not read cookies() or headers()
│   ├── page.tsx
│   ├── c/[...category]/page.tsx
│   └── p/[slug]/page.tsx
├── (account)/                    ← SprintDesk shape: request-time, personal, noindex
│   ├── layout.tsx                reads the session; that is correct here
│   ├── cart/page.tsx
│   └── checkout/page.tsx
└── layout.tsx                    🔴 the root: static metadata only, no runtime reads
```

Two route groups, two sets of rules, and each half keeps the shared-to-personal ratio that justifies its own architecture. This works, and it keeps working, as long as one thing stays true.

🔴 **One `cookies()` read in a layout above the boundary collapses it.** Not gradually — completely, for every route underneath. That is the mechanism from [ch5 · 03](../05-caching-ppr-and-cache-components/03-partial-pre-rendering-ppr-static-shell-dynamic-holes-for-min.md) and [ch5 · 03b](../05-caching-ppr-and-cache-components/03b-maximizing-the-shell-the-app-shell-and-what-crawlers-get.md) running in the direction nobody plans for: prerendering proceeds top-down and stops at the first thing that cannot complete, so a runtime read at the root is a runtime read for the entire tree. The commit that does it is always small and always reasonable — a session-aware header, an experiment flag, a locale read, a feature toggle. The public half stops being prerendered, nothing errors, and the only evidence is a hosting bill and a cache hit rate.

**The rule that keeps the boundary honest:** anything in a shared layout that wants to know about the visitor goes behind its own `<Suspense>` boundary in a leaf, exactly as the cart badge does in [02c](02c-the-cart-checkout-and-where-state-lives.md). If a shared layout ever becomes `async`, treat it as an architectural change and review it as one.

## Gotchas

**★ Symptom: a "both shapes" application slowly loses its public prerenders over a quarter, with no single commit to blame.** Cause: successive small additions to a shared layout — a locale read, an experiment cookie, a session-aware banner — each of which is individually defensible and each of which is a runtime read above the boundary. Fix: make the root and public layouts non-async by policy, put every visitor-dependent fragment in a leaf behind its own boundary, and treat a diff that adds `async` to a shared layout as a design review rather than a rubber stamp.

**★ Symptom: the SaaS's caching conventions were adopted wholesale by the storefront team and the cache never hits.** Cause: SprintDesk's keys are per-tenant by necessity, so its conventions bake a per-reader value into every key. On a shared catalogue that is exactly the high-cardinality shape that guarantees a miss. Fix: port the decision procedure, not the key layout — the question is what varies the value, and on a catalogue the honest answer is usually the product slug and nothing else.

**★ Symptom: the storefront's conventions were adopted by an internal tool and a user saw another user's data.** Cause: the same transfer in the other direction. The storefront's habit is to cache widely because its documents are public; an internal tool's documents are not. Fix: the check for whether a cached scope may exist is not "is this slow" but "would two different readers accept the same bytes" — and where the answer is no, the read is a hole or `use cache: private`, never a shared entry.

**★ Symptom: a marketing team asks why the docs site inside the SaaS is slower than the competitor's, and the SaaS team has no answer.** Cause: the docs live under a layout that reads the session, so they are being rendered at request time despite being byte-identical for every reader. Fix: move them to their own route group with their own layout, and keep every session read on the other side of the boundary.

**★ Symptom: both applications have an incident postmortem that concludes "we should have had more monitoring", twice.** Cause: the failure that hurts most in each is silent by construction — a cross-tenant read returns `200`, a lost prerender returns a correct page. Neither produces the error-rate signal the dashboards are built around. Fix: monitor the property, not the errors: cache hit rate and prerender counts on the public side, and an assertion that every data-access path is tenant-scoped on the private side. Both are checks you write once and run in CI.

**★ Symptom: a team decides they are "not an e-commerce company" and dismisses this entire comparison.** Cause: reading the case study as being about shopping rather than about traffic shape. Fix: apply the two questions above. A documentation site, a news publication and a job board are all the storefront shape; an internal admin tool for a retailer is the SprintDesk shape despite being e-commerce.

**★ Symptom: a payment retry and a background-job retry were built by different people to different standards.** Cause: they were classified by domain — money versus email — instead of by structure. Fix: classify by whether you control the second system. If you do, the effect goes inside the transaction; if you do not, the other side must recognise the repeat. Two branches, one rule, and the second branch is where the money is.

**★ Symptom: the storefront survives a database outage and the team is surprised.** Cause: they were surprised because they had modelled availability on the SaaS, where nothing is cacheable and an outage is total. On a catalogue served from cache, browsing degrades gracefully and only the write paths — cart, checkout — stop. Fix: this is a property to design toward deliberately, not a lucky accident: know which routes survive on cached content and make the ones that cannot fail loudly and locally rather than taking the page down.

## Interview questions

**★ What is the single structural fact from which every difference in the comparison table follows?**
Whether the personal content on a typical page is the hole or the page. On the storefront, price, stock and cart badge are small holes inside a large shared document, so a prerendered shell captures nearly everything and cache hit rate becomes the dominant metric. On the SaaS the shared content is the chrome and everything of substance is tenant-scoped, so there is nothing to share between readers, request-time rendering is the baseline, and the dominant metric is write correctness. Rendering strategy, cache placement, outage blast radius, deploy priorities and the shape of the worst failure are all downstream of that one ratio.

**★ Give a decision that produces identical code in both applications and means something different in each.**
Wrapping a slow subtree in a `<Suspense>` boundary. On SprintDesk the route renders at request time regardless, so the boundary is a loading-experience decision: it chooses what the user looks at while the board loads. On the storefront the same boundary is what stops a runtime read from removing the whole page from the static shell, so it is the difference between a CDN-served catalogue and a per-request-rendered one. Identical JSX, polish in one application and architecture in the other — which is exactly why copying patterns between the two without copying the reasoning goes wrong quietly.

**★ Why is a per-tenant cache key on a catalogue query a bug, when the same key shape is mandatory on the SaaS?**
Because the two applications fail in opposite directions on cardinality. On the SaaS, omitting the tenant from the key means one tenant's data can be served to another — a leak, and the worst failure the product has. On the storefront, *including* anything per-visitor in the key means every request produces a distinct entry, so the cache never hits and you have paid the lookup cost to buy nothing. The general rule that covers both is that the key should contain exactly what varies the value, and the reason it feels like two rules is that on the SaaS the reader varies the value and on the catalogue it does not.

**★ Why can a merchandiser's publish not use `updateTag`, when the equivalent SprintDesk write does?**
Because `updateTag` is callable only inside Server Actions and exists to solve read-your-own-writes — the writer is the reader, and they must not be served stale. A CMS publish arrives at a Route Handler, from a person who is not any of the readers, so `updateTag` is both unavailable and conceptually wrong. That leaves `revalidateTag` and a required profile decision: a long window for content where serving stale during regeneration is harmless, and an immediate expiry for a price, where it is not. The two functions are not interchangeable tools for one job; they encode who is waiting for the result.

**★ Why is an anonymous cart cookie the same problem as tenant scoping?**
Because both are answers to "whose data is this", and both are only safe when the server derives the answer rather than accepting it. SprintDesk re-verifies the caller inside every Server Action instead of trusting an id in the payload; the storefront generates the cart id server-side and stores it `httpOnly` so no client can present someone else's. The failure is the same too — a successful response containing another person's data, discovered by a customer rather than a test — and it is unaffected by whether the person in question ever logged in.

**★ Two engineers argue about whether the digest-email queue and the checkout payment path are related. Settle it.**
They are the same problem: an effect that must happen exactly once, in a system that cannot participate in your database transaction. The only variable is whether you own the second system. Owning it lets you move the effect inside — a jobs table written in the same transaction as the change that justifies it, so the two commit or roll back together. Not owning it means no ordering of your commit and their call is safe, so the remaining move is to make the other side recognise a repeat, which is the provider's idempotency key, with reconciliation and then a human as the fallbacks. Same reasoning, one branch.

**★ An application has a public marketing site and an authenticated dashboard. How do you keep both fast without two codebases?**
Make the boundary between them a layout boundary — separate route groups, each with its own layout and its own rules — so the public half keeps a shell-heavy, long-cached, indexable architecture and the private half is request-time and `noindex`. The discipline that makes it hold is a single rule: nothing above the boundary may read runtime data. The root layout stays non-async with static metadata, and any visitor-dependent fragment that must appear on both sides lives in a leaf behind its own `<Suspense>` boundary. Get that wrong once and the public half stops being prerendered entirely, with no error to tell you.

**★ Why is one `cookies()` read in a shared layout described as collapsing the boundary rather than degrading it?**
Because prerendering proceeds top-down and stops at the first thing that cannot complete before a request exists. A runtime read at the root is therefore not a local cost — everything below it is never evaluated for the shell, so the entire public half moves to request-time rendering at once. There is no partial version of the failure and no gradual signal. The site keeps working, every page is correct, and the only evidence is that invocations went up and cache hit rate went down, which nobody attributes to a three-line change in a layout.

**★ Which of the two applications is more damaged by an outage of its primary datastore, and why is that the opposite of what people expect?**
The SaaS, decisively. People expect the storefront to suffer more because it has more traffic, but traffic is not the variable — shareability is. A catalogue served from cached, prerendered content keeps rendering while the database is unavailable, so browsing survives and only the write paths stop; the loss is revenue during the window, not availability. The SaaS has nothing cacheable, because no two readers share a document, so an outage of the datastore is an outage of the product. That asymmetry is worth designing toward on the storefront rather than discovering: know which routes survive on cached content, and make the ones that cannot fail loudly and locally instead of taking the page with them.

**★ What would make you conclude that a comparison like this had taught you nothing?**
If the takeaway were a list of settings. The two column headings are not configurations to copy; they are the output of running the same decision procedures — the eight rendering questions and the four ownership questions — against two different products. The transferable artefact is the procedures and the reasons, because the next application you build will be neither of these two, and the only thing that survives is the ability to ask what varies the value, who is waiting for the result, and whether two readers would accept the same bytes.

{/* FOOTER */}
