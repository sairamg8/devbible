---
title: "08 · The History API and client-side routing"
sidebar_label: "Overview"
sidebar_position: 0
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-08-15 against MDN — [History API](https://developer.mozilla.org/en-US/docs/Web/API/History_API), [Working with the History API](https://developer.mozilla.org/en-US/docs/Web/API/History_API/Working_with_the_History_API), [Navigation API](https://developer.mozilla.org/en-US/docs/Web/API/Navigation_API), [`URLPattern`](https://developer.mozilla.org/en-US/docs/Web/API/URLPattern). Documentation-validated; **no timings and no console output**.

The syllabus row is *`pushState`, `popstate`, scroll restoration, and what the Navigation API
changes*. The through-line: the History API changes the URL and nothing else, so **everything a
real navigation does for free becomes your job** — and the Navigation API is the platform taking
most of that job back.

🔴 **The four duties a client-side router inherits:** set the title, move focus into the new view,
announce the change, and get scroll right in both directions. A router that renders the right
component and does none of these is the common case, and it is broken for keyboard and
screen-reader users.

## Chunks

| # | Chunk | Covers |
|---|---|---|
| 01 | **[The History API](./01-the-history-api.md)** | `pushState` versus `replaceState` as a UX decision; the ignored title argument; why `popstate` never fires for your own calls; the state object's clone rules and size discipline; `scrollRestoration = 'manual'` and restoring after render; why `history.length` cannot answer "can I go back" |
| 02 | **[Building a router](./02-building-a-router.md)** | Every guard a link-click interceptor needs; `URLPattern` matching with a regex fallback; route-level code splitting; the overlapping-navigation race and checking `signal.aborted` after each `await`; the `afterNavigate` duties in full; the SPA fallback the server must provide; prefetching on intersection |
| 03 | **[What the Navigation API changes](./03-the-navigation-api.md)** | One `navigate` event for clicks, forms, programmatic calls and traversals; `canIntercept`, `hashChange`, `navigationType`, `signal`; `intercept({handler, focusReset, scroll})` and why a navigation with a duration fixes accessibility; cancelling Back; `entries()`, `canGoBack`, `traverseTo`; `state` versus transient `info`; adopting it behind a feature check |

## Three facts worth carrying out of this topic

- **`popstate` is only for the browser's traversals.** Your own `pushState` fires nothing — the
  router must call its own render.
- **Scroll and focus are asymmetric.** Forward goes to the top; Back returns to the stored offset,
  restored *after* the content lays out. Focus moves into the new view either way.
- **A client-side route is a real URL.** If the server does not serve `index.html` for it, the
  deep link 404s in production and works in development.

## Phase gate

You can move a 500 ms computation into a Web Worker, keep the page responsive, and prove it
in the performance panel.

## Where this connects

- [Phase 11 · 04 · The URL object](../../phase-11-network-storage/04-url-and-searchparams/01-the-url-object.md)
  — building and parsing the URLs a router matches on
- [Phase 10 · 04 · Event delegation](../../phase-10-events/04-event-delegation/README.md) — how
  one document-level click handler catches links rendered later
- [Phase 9 · 15 · 02 · Managing focus](../../phase-9-dom/15-focus-and-accessibility/02-managing-focus.md)
  and [15 · 04 · Live regions](../../phase-9-dom/15-focus-and-accessibility/04-live-regions.md) —
  the two things a route change must do for assistive technology
- [Phase 7 · 11 · Anti-patterns](../../phase-7-async/11-anti-patterns/README.md) — the latest-wins
  race that overlapping navigations are a special case of
- [04 · `IntersectionObserver`](../04-intersectionobserver/README.md) — prefetching a route's
  module when its link appears

---

Start → [01 · The History API](./01-the-history-api.md)
