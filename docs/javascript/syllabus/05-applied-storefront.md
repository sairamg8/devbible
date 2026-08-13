---
title: "Part 5 — Applied: the storefront"
sidebar_label: "5 · Applied storefront"
sidebar_position: 5
---

> **Phase 18 · 18 topics · 7 Master**
> Every earlier phase, composed into the front end of a real e-commerce
> application — **with no framework**, so nothing is hidden.

## Why this part exists

The other four parts teach the language honestly, but a topic list is not the
same as a capability. You can know closures, `IntersectionObserver` and
`AbortController` individually and still not be able to build a product grid
that filters, paginates, survives a refresh and does not fire a stale request.

This part closes that gap. Each row is **a thing a storefront actually needs** —
the cart, the search box, checkout, order tracking — solved end to end in plain
JavaScript, naming which earlier phases it composes.

**Framework-free on purpose.** React will do most of this for you later. The
point is that when React's version breaks at 2 a.m., you know what it was doing.
Every page here ends by naming what a framework replaces and what it does not.

## How it differs from Part 4

Part 4 asks *"can you implement `debounce`?"*. Part 5 asks *"the search box fires
on every keystroke, three responses land out of order, and the slowest one wins —
fix it."* Same primitives, real stakes.

---

## Phase 18 — Building the store front end

*18 topics.* Ordered the way you would actually build the app: browse, then
cart, then checkout, then the operational surface.

| Topic | Tier |
|---|---|
| **The product grid** — filtering, sorting and pagination with the **URL as the single source of truth**, so a filtered view is shareable and the back button works | <span className="db-tier t-master">Master</span> |
| **Search with autocomplete** — debounce the input, abort the in-flight request, and discard out-of-order responses; the three bugs every search box ships with | <span className="db-tier t-master">Master</span> |
| **A resilient API client** — timeout, retry with backoff and jitter, typed errors, auth header injection, and single-flight deduplication of identical requests | <span className="db-tier t-master">Master</span> |
| **The cart as a state machine** — immutable updates, derived totals, add/increment/remove/clear, and why the total is computed rather than stored | <span className="db-tier t-master">Master</span> |
| **Money, quantities and rounding** — integer minor units end to end, never a float, tax and discount ordering, and `Intl.NumberFormat` only at the edge | <span className="db-tier t-master">Master</span> |
| **Optimistic updates with rollback** — apply immediately, reconcile on response, restore on failure, and keeping the UI honest while it is in flight | <span className="db-tier t-master">Master</span> |
| **Idempotency from the client** — the double-submitted checkout, a client-generated idempotency key, and disabling the button is not a fix | <span className="db-tier t-master">Master</span> |
| **Persisting the cart** — `localStorage` with a schema version and a migration, quota failure, and cross-tab sync via the `storage` event or `BroadcastChannel` | <span className="db-tier t-understand">Understand</span> |
| **Auth in the browser** — where the token lives and what that decision costs, refresh-token races collapsed into one request, and logout across tabs | <span className="db-tier t-understand">Understand</span> |
| **Checkout forms** — multi-step state, the constraint-validation API, server-side error mapping back onto fields, and an accessible error summary | <span className="db-tier t-understand">Understand</span> |
| **Infinite scroll and lazy images** — `IntersectionObserver`, a sentinel element, `loading="lazy"`, `srcset`, and reserving space so the layout never shifts | <span className="db-tier t-understand">Understand</span> |
| **Long lists without freezing** — windowing/virtualisation written from scratch, and the point at which it beats rendering everything | <span className="db-tier t-understand">Understand</span> |
| **Client-side routing from scratch** — the History API, route matching, scroll restoration, focus management on navigation, and code-splitting per route | <span className="db-tier t-understand">Understand</span> |
| **Real-time order tracking** — SSE versus WebSocket for this specific job, reconnect with backoff, and reconciling state after a gap | <span className="db-tier t-understand">Understand</span> |
| **Review uploads** — `FormData`, upload progress, client-side image resize through Canvas, and validating a file you cannot trust | <span className="db-tier t-understand">Understand</span> |
| **Dates and delivery estimates** — the server sends an instant, the browser renders a local date; `Intl.DateTimeFormat`, `RelativeTimeFormat`, and the off-by-one-day bug | <span className="db-tier t-understand">Understand</span> |
| **Failing in public** — global error handlers, degrading a broken widget instead of a blank page, retry affordances, and what to report | <span className="db-tier t-understand">Understand</span> |
| **A performance budget** — code splitting, what actually moves LCP and INP on a product page, measuring before and after, and the long tasks to break up | <span className="db-tier t-understand">Understand</span> |

**Gate — you are done when:** you can build a browse → cart → checkout flow with
no framework, refresh at any point without losing state, and explain every
network request the page makes and why it is safe to retry.

---

## What this composes

| This phase's row | Leans on |
|---|---|
| Product grid, routing | Phase 11 (`URL`), Phase 12 (History API), Phase 5 (`sort`, `filter`) |
| Search box | Phase 3 (`debounce`), Phase 7 (races, `AbortController`) |
| API client | Phase 7 (retry, backoff, cancellation), Phase 8 (custom errors) |
| Cart, optimistic updates | Phase 1 (references), Phase 4 (immutable updates), Phase 14 (`Map`) |
| Money | Phase 1 (floats), Phase 5 (`Intl`) |
| Persistence, cross-tab | Phase 11 (storage), Phase 12 (`BroadcastChannel`) |
| Virtualisation, budget | Phase 9 (layout thrashing), Phase 13 (complexity) |

## Where this connects

- **→ React** — this is the phase React makes shorter. Reading these pages first
  turns hooks, keys, Suspense and Server Components into *named solutions to
  problems you have already hit*, rather than API surface to memorise.
- **→ Express / PostgreSQL** — idempotency keys, cursor pagination and auth
  refresh each have a server half. This part owns the client half only and links
  across; it never re-specifies an endpoint.
- **→ CSS** — layout shift, `content-visibility` and reduced motion are the CSS
  side of the same performance rows.
- **Deliberately not here:** payment-provider integration, SEO and SSR, and
  anything that is a product decision rather than a JavaScript one.

---

← [Part 4 — DSA & machine coding](./04-dsa-and-machine-coding.md) · [Overview](../README.md)
