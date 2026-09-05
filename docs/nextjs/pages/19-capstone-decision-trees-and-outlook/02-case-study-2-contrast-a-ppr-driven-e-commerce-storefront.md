---
title: "A PPR-driven storefront and a multi-tenant SaaS are the same framework producing opposite architectures, because on a storefront the personal parts are small holes inside large shared pages and on SprintDesk the shared parts are small holes inside large personal pages"
sidebar_label: "02 · Case study 2: the storefront"
sidebar_position: 7
description: "The contrast case: the traffic shape a storefront actually has, the route map it produces, which surfaces are shared and which are personal, and the single inversion against SprintDesk that drives every rendering, caching and state decision in the rest of this topic."
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-09-05 — this page composes material already verified across chapters 5, 6, 8, 10 and 15 of this book against the Next.js 16.3.4 documentation. It introduces no new framework claims of its own; the storefront is a worked contrast case, not a product.
> Documentation-verified; **no sandbox run, no timings**.
> Target: **Next.js 16.3.4** · React canary bundled by the App Router · Node.js **24.20.0**.

**SprintDesk is behind a login on every route that matters, every read is tenant-scoped, and the hard problems are concurrency, invalidation across instances and authorization at each entry point. A storefront inverts all three: the traffic is overwhelmingly anonymous, the catalogue is one shared body of content that every visitor reads identically, and the revenue depends on a crawler being able to fetch a complete document. Both are App Router applications on the same version of the same framework, and they end up with almost nothing in common. That is the point of this topic — the difference is not taste, and it is not seniority. It falls out of one structural fact: on a storefront the personal parts are *small holes inside large shared pages*, and on SprintDesk the shared parts are *small holes inside large personal pages*. Everything downstream is a consequence.**

## Start from the traffic, not from the features

The two applications have feature lists that look superficially similar — both have lists, detail pages, forms, a search box, a settings area. Feature lists are the wrong input. Here is the input that actually decides the architecture:

| | SprintDesk | Storefront |
|---|---|---|
| Share of requests that are authenticated | nearly all | a minority, and they are the expensive ones |
| Two visitors on the same URL see | different documents (different tenants) | the same document, plus a few different fragments |
| Who reads the busiest route | a logged-in member of one workspace | an anonymous person who has never visited before, or a crawler |
| Value of a document being indexable | zero — it is `noindex` by inheritance | it *is* the acquisition channel |
| What a cache miss costs | one slow board render | a function invocation on a route that gets most of the site's traffic |
| What the interesting bugs are about | concurrency, invalidation, authorization | cache-key cardinality, staleness of price and stock, prerender loss |

That last row is worth pausing on. SprintDesk's chapter-15 milestone lists [six seams](../15-databases-apis-and-full-stack-patterns/06-project-milestone-sprintdesk-on-drizzle-neon-with-pooling.md) and five of them are about the write path — connection counts under write load, migrations, action-level authorization, transactional enqueue, cross-instance invalidation. A storefront has a write path too, and it is tiny: a cart mutation and an order. Its seams are almost entirely on the read path, which SprintDesk barely thinks about because SprintDesk's reads are per-tenant and cannot be shared anyway.

## The route map

```
storefront
├─ /                          home: merchandised rows, editorially curated
├─ /c/[...category]           category listing: facets, sort, pagination
├─ /p/[slug]                  product detail: the money page
├─ /search                    query-driven results
├─ /cart                      the anonymous cart
├─ /checkout                  address, shipping, payment
├─ /order/[id]                confirmation — one reader, once, ever
└─ /account/*                 orders, addresses, returns
```

Eight route families, and they split cleanly into three groups that want three different things:

**Group 1 — shared, indexable, cacheable at length.** `/`, `/c/[...category]`, `/p/[slug]`. This is the site as far as a search engine is concerned and as far as most sessions are concerned. Every visitor's document is byte-identical apart from a handful of fragments.

**Group 2 — shared in shape, never in content.** `/search`. Its parameters are effectively unbounded, so there is nothing per-URL to prerender; what it has is a route-level shell and holes. This is the shape [ch6 · 01d question 5](../06-ssg-isr-and-ssr-strategy/01d-the-decision-procedure-and-when-ssr-is-right.md) names as *"there is nothing to prerender per URL; the shell is the App Shell and the URL-specific parts are holes."*

**Group 3 — personal end to end.** `/cart`, `/checkout`, `/order/[id]`, `/account/*`. These are, structurally, SprintDesk pages that happen to live in a storefront. They are not interesting *as storefront pages*; they are interesting because of how small a fraction of traffic they take and how completely different their rules are.

🔴 **Most of the design effort belongs to group 1, and most of the code you write will belong to group 3.** That mismatch is the trap in this shape. Checkout is fiddly, stateful and satisfying to build; the category page is where the money is and it looks like it is already done.

## Shared and personal, surface by surface

The whole architecture is legible from one table. For each surface, ask: is it the same for everyone, and does it have to be right *now*?

| Surface | Same for every reader? | Where it lives |
|---|---|---|
| Nav, footer, category tree | yes | static shell |
| Product title, description, images, specs | yes | static shell |
| Category grid, facet counts | yes | static shell, long lifetime |
| Reviews, ratings | yes | static shell, long lifetime |
| **Price** | no — tax, currency, member tier | a hole |
| **Stock badge** | yes in value, no in freshness | a hole |
| **Cart badge / mini-cart** | no | a hole |
| **"You recently viewed"** | no | a hole, or the client |
| **Personalised recommendations** | no | a hole |
| Checkout, orders, addresses | no | not shell material at all |

Nine rows of shell against five holes, and the holes are all small. Run the same exercise over SprintDesk's board and it comes out the other way round: the card rows, the counts, the filters and the permissions are all tenant-specific, and what remains shareable is the chrome. Same table, mirrored.

**That mirroring is the entire thesis of this topic**, and it has a mechanical consequence rather than a philosophical one. Partial Prerendering makes staticness a per-component property rather than a per-route one ([ch5 · 03](../05-caching-ppr-and-cache-components/03-partial-pre-rendering-ppr-static-shell-dynamic-holes-for-min.md)). When most of the tree is shared, that mechanism pays for the whole page. When most of the tree is personal, the same mechanism recovers only the chrome — still worth having, not transformative. **PPR is not equally valuable in both applications, and the reason is the ratio in this table.**

## The one fact that makes SEO a rendering decision here

The storefront's acquisition channel is an audience that does not get the shell. This is documented behaviour, and [ch5 · 03b](../05-caching-ppr-and-cache-components/03b-maximizing-the-shell-the-app-shell-and-what-crawlers-get.md) quotes it:

> *"Browsers receive the static shell instantly. Bots and crawlers are detected by their user agent and handled differently: because they need a complete document, Next.js skips the shell and renders the entire page dynamically at request time, then sends the finished HTML once the render completes."*

For SprintDesk this is a footnote — its indexable surface is a marketing site and a handful of public team pages ([ch12 · 06](../12-seo-metadata-and-accessibility/06-project-milestone-sprintdesk-public-pages-fully-indexed.md)), and the rest is `noindex` by inheritance. For the storefront it is a second rendering path over the entire catalogue, exercised by the visitor whose experience you can observe least and whose opinion is worth most. Every design decision in [02b](02b-the-storefronts-rendering-and-caching-decisions.md) has to be checked twice: once for a browser receiving a shell, once for a crawler receiving a full request-time render.

## The five decisions this topic argues

Each one is settled in a later chunk. Naming them here is the point of this page — they are the decisions that differ, and every one of them differs *because of the table above*, not because storefronts have a different best practice.

**1 · How much of the catalogue to prerender.** SprintDesk barely has a `generateStaticParams` problem; the storefront has category × facet × page, which is a cross product with no natural bound ([ch6 · 02c](../06-ssg-isr-and-ssr-strategy/02c-nested-segments-and-the-combinatorial-explosion.md)). → [02b](02b-the-storefronts-rendering-and-caching-decisions.md)

**2 · What the staleness budget is, per value.** SprintDesk's answer is mostly "on-demand, from a write we control". The storefront has five velocities on one page and a price row whose staleness has a regulatory cost ([ch6 · 01b](../06-ssg-isr-and-ssr-strategy/01b-data-velocity-and-the-staleness-budget.md)). → [02b](02b-the-storefronts-rendering-and-caching-decisions.md)

**3 · Whether a shared remote cache earns its cost.** For SprintDesk the compelling case for `use cache: remote` is cross-instance sharing of tenant reads; on the storefront it is a rate-limited pricing service with a handful of distinct keys — the same directive, a different argument, and a different failure mode when the cardinality is wrong ([ch5 · 10 · 03](../05-caching-ppr-and-cache-components/10-the-three-cache-directives/03-use-cache-remote.md)). → [02b](02b-the-storefronts-rendering-and-caching-decisions.md)

**4 · Where each piece of state lives.** The four owners from [ch8 · 07](../08-state-management-in-an-rsc-world/07-project-milestone-sprintdesk-board-filters-in-the-url.md) apply unchanged, and the answers land in different places — with one extra reason for the URL that SprintDesk does not have, and one case (the cart) that has no clean answer at all. → [02c](02c-the-cart-checkout-and-where-state-lives.md)

**5 · What the business actually watches.** SprintDesk watches write correctness. The storefront watches cache hit rate, because [ch17 · 05](../17-deployment-scaling-and-observability/05-cost-engineering-function-compute-bandwidth-and-edge-cache-h.md) shows a cached request touching two meters and a miss touching five — and it watches conversion, which is downstream of the same number. → [02d](02d-the-two-applications-side-by-side.md)

## What is *not* different, and why saying so matters

Half the value of a contrast case is knowing where the contrast stops. Three things are identical in both applications and the storefront gets no discount on any of them:

- **Every mutation re-verifies its caller.** A Server Action is a POST endpoint whoever can send the POST can call. "Add to cart" and "move card" have exactly the same obligation, and the storefront's version is worse because its actions are reachable without any login at all.
- **A write that must trigger an effect enqueues it in the same transaction.** "Send the digest" and "send the order confirmation" are the same problem with the same answer.
- **`revalidateTag` reaches the instance it ran on.** The storefront's version of the multi-instance invalidation seam is *worse*, because a stale price is worse than a stale board.

The rest of this topic is the differences. [02d](02d-the-two-applications-side-by-side.md) comes back to this short list and argues that two more decisions that *look* different are actually the same decision in different clothes.

## Gotchas

**★ Symptom: the storefront was designed by listing features, and the category page turns out to be the slowest route on the site.** Cause: feature lists rank by how much code a surface needs, and the category page needs almost none — so it gets designed last, by whoever is on it, usually as an ordinary `async` page. Fix: rank by traffic share and by cache-hit potential before writing anything, which is the table at the top of this page and takes an afternoon.

**★ Symptom: PPR was adopted on the strength of a SprintDesk-shaped demo and the win on the storefront is smaller than expected — or vice versa.** Cause: the value of PPR is proportional to the share of the tree that is shareable, and the two applications sit at opposite ends of that ratio. Fix: measure the ratio for your own tree using the shared/personal table before quoting anyone else's result; the mechanism is identical, the payoff is not.

**★ Symptom: the site is fine in QA and Search Console reports rendering errors on product pages.** Cause: the crawler path skips the shell and re-renders everything at request time, so anything the shell relied on that only exists at build time now runs — and fails — in the request-time environment. Fix: this is documented and already worked through with code at [ch5 · 03b](../05-caching-ppr-and-cache-components/03b-maximizing-the-shell-the-app-shell-and-what-crawlers-get.md); make the shell's data reachable at request time and check a product URL with a crawler user agent.

**★ Symptom: an "add to cart" action can be called by anyone, and nobody flagged it in review.** Cause: on SprintDesk every action sits behind a login, so "the action is its own entry point" reads as an authorization rule; on a storefront the cart action has no login to sit behind and the rule looks inapplicable. Fix: it is not an authorization rule, it is an *entry point* rule — the action still needs to validate its input, rate-limit, and bind to a cart identity it derives server-side rather than one the client sends. [02c](02c-the-cart-checkout-and-where-state-lives.md) works the cart identity through.

**★ Symptom: the checkout flow is beautifully engineered and the product page is where users leave.** Cause: group 3 is where the code is, so that is where the attention goes. Fix: budget effort by traffic share. The confirmation page is read once per order by one person; the product page is read by everyone who will never buy anything, and they decide whether anyone reaches checkout at all.

**★ Symptom: a "best practices" document copied from the SaaS build makes the storefront slower.** Cause: SprintDesk's practices are optimised for correctness under concurrent writes to tenant-scoped data — request-time reads, short lifetimes, on-demand invalidation everywhere. Applied to a catalogue those are exactly backwards. Fix: port the *questions* ([ch6 · 01d](../06-ssg-isr-and-ssr-strategy/01d-the-decision-procedure-and-when-ssr-is-right.md)'s eight, [ch8 · 07](../08-state-management-in-an-rsc-world/07-project-milestone-sprintdesk-board-filters-in-the-url.md)'s four) and re-run them. Never port the answers.

**★ Symptom: someone argues the storefront does not need PPR because "it is all static anyway".** Cause: the five holes in the table are easy to forget when you are looking at the nine shell rows — but a cart badge in the header is on *every* page. Fix: the ratio is the argument for PPR, not against it. Without it, one badge that reads a cookie in the header turns the entire catalogue into request-time rendering; that is the collapse [02d](02d-the-two-applications-side-by-side.md) closes on.

**★ Symptom: an application is genuinely both shapes and the team keeps re-litigating the architecture.** Cause: it *is* both — a SaaS with a marketing site, a storefront with a seller dashboard — and one global answer cannot be right for both halves. Fix: make the boundary a layout boundary and keep the shared/personal ratio of each half intact on its own side of it. [02d](02d-the-two-applications-side-by-side.md) closes on exactly this, including the one line that collapses it.

## Interview questions

**★ Two teams build on the same Next.js version and end up with opposite architectures. What is the single fact that predicts which they get?**
The ratio of shared to personal content in a typical page, and specifically which of the two is the *hole*. On a storefront the personal fragments — price, stock, cart badge — are small holes inside a large shared document, so a static shell plus a few dynamic holes captures nearly all of the page. On a multi-tenant SaaS the shared fragments are the chrome and everything of substance is tenant-scoped, so the same mechanism recovers only the frame. Both teams use PPR correctly and get very different amounts of value from it, and the difference is not skill — it is the shape of the traffic they serve.

**★ Why is SEO a rendering decision on a storefront and not merely a metadata one?**
Because the crawler does not receive the static shell. Next.js detects bots by user agent and renders the entire page dynamically at request time so they get a complete document. That makes the crawler path a second, full, request-time render of every URL you want indexed — with different environment guarantees than the build-time render that produced the shell. So indexability stops being "did I set the right tags" and becomes "does every input my shell depends on also exist at request time, and can my dynamic-render budget absorb a crawl of the catalogue". Neither of those is a metadata question.

**★ SprintDesk's chapter-15 milestone lists six seams. How many of them apply to a storefront, and does the emphasis change?**
All six apply, and the emphasis changes almost completely. Authorization at the entry point, transactional enqueue of external effects and cross-instance invalidation all transfer unchanged, and the last is more damaging on a storefront because the stale value is a price rather than a board. But the seams that dominated SprintDesk — connection arithmetic under write load, migration timing, stream buffering — are secondary here, because the storefront's write path is a cart mutation and an order. Its dominant failures are on the read path: cardinality, staleness budgets and the accidental loss of a prerender. SprintDesk essentially does not have a read-path cache-hit problem, because tenant-scoped reads cannot be shared between readers in the first place.

**★ Why is "most of the design effort belongs to group 1 and most of the code belongs to group 3" a warning rather than an observation?**
Because effort naturally follows code. Checkout has forms, validation, payment integration, error states and a state machine, so it consumes weeks and feels like the real work; the category page is a grid and a query and looks finished on day two. But the category and product pages carry the traffic, the indexing and the acquisition, and their failure modes are silent — a lost prerender, a stale price, a cache key with too much cardinality. If you let the code volume set the agenda you will ship an excellent checkout attached to a slow catalogue that nobody reaches.

**★ A colleague ports the SaaS's rendering guidelines directly to the storefront. What specifically breaks?**
The guidelines are tuned for data that cannot be shared and must be correct under concurrent writes, so they favour request-time reads, short lifetimes and on-demand invalidation on everything. Applied to a catalogue, request-time reads throw away the shell for pages that are identical for every visitor, short lifetimes turn a documented origin-load ceiling back into per-request work, and blanket on-demand invalidation over a large tag turns a merchandiser's publish into a site-wide re-render. Nothing errors. The site is simply slower and more expensive, and the cause is invisible in code review because every individual line matches a written standard.

**★ What is the argument that the cart badge, which is a few characters of text, is an architectural concern?**
Because it appears in the header on every route, and a runtime read in a shared header is a runtime read on the whole catalogue. Under the pre-Cache-Components model that made every one of those routes dynamic outright. Under PPR the badge can be a hole — but only if the read stays inside a boundary and nothing above it awaits runtime data. So a component whose entire output is a number decides whether the most-visited pages on the site are served from a CDN or rendered per request. It is the smallest piece of UI on the page and the largest single lever on the hosting bill.

← [01e · What SprintDesk still does not have](01e-what-sprintdesk-still-does-not-have.md) · [Chapter 19 overview](01-explanation.md) · Next → [02b · Rendering and caching](02b-the-storefronts-rendering-and-caching-decisions.md)
