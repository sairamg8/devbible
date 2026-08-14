---
title: "Phase 18 — Building the store front end"
sidebar_label: "Overview"
sidebar_position: 0
---

*18 topics.* Ordered the way you would actually build the app: browse, then cart, then checkout,
then the operational surface. **This is the last phase**, and it composes everything the earlier
ones taught.

## Status — **Master tier COMPLETE** (2026-08-14)

**Master tier first.** Phase 18 has **seven** Master topics — 01 through 07 — and **all seven are
written**. They were the last seven Master topics in the corpus: 🔴 **every Master topic in the
JavaScript syllabus is now written.**

## Topics

| # | Topic | Tier | Status |
|---|---|---|---|
| 01 | **[The product grid](./01-product-grid/README.md)** | <span className="db-tier t-master">Master</span> | ✅ |
| 02 | **[Search with autocomplete](./02-search-autocomplete/README.md)** | <span className="db-tier t-master">Master</span> | ✅ |
| 03 | **[A resilient API client](./03-resilient-api-client/README.md)** | <span className="db-tier t-master">Master</span> | ✅ |
| 04 | **[The cart as a state machine](./04-cart-state-machine/README.md)** | <span className="db-tier t-master">Master</span> | ✅ |
| 05 | **[Money, quantities and rounding](./05-money-and-rounding/README.md)** | <span className="db-tier t-master">Master</span> | ✅ |
| 06 | **[Optimistic updates with rollback](./06-optimistic-updates/README.md)** | <span className="db-tier t-master">Master</span> | ✅ |
| 07 | **[Idempotency from the client](./07-idempotency/README.md)** | <span className="db-tier t-master">Master</span> | ✅ |
| 08–18 | Persisting the cart, auth in the browser, checkout forms, infinite scroll and lazy images, long lists without freezing, client-side routing, real-time order tracking, review uploads, dates and delivery estimates, failing in public, a performance budget | <span className="db-tier t-understand">Understand</span> | deferred |

## The phase gate

From the syllabus: **you can build a browse → cart → checkout flow with no framework, refresh at
any point without losing state, and explain every network request the page makes and why it is safe
to retry.** The Master tier covers browse (01, 02), the client (03), the cart (04, 05), and the two
things that make writes safe (06, 07).

## How these pages are verified

**Documentation-validated** against MDN — the History and URL APIs, `AbortSignal`, ARIA attributes,
`Intl`, and the numeric behaviour behind the money rules. **No page prints a timing or console
output**, because nothing was run.

## Where this connects

- [Phase 11 · Network, storage and data transfer](../phase-11-network-storage/README.md) — `fetch`, the wrapper, URLs and CORS
- [Phase 17 · Machine coding](../phase-17-machine-coding/README.md) — the `debounce`, `bind` and combinators this composes
- [Phase 9 · The DOM](../phase-9-dom/README.md) and [Phase 10 · Events](../phase-10-events/README.md) — the rendering and interaction layer
- [Phase 1 · Values, types and coercion](../phase-1-values-and-coercion/README.md) — why money is never a float

---

Start → [01 · The product grid](./01-product-grid/README.md)
